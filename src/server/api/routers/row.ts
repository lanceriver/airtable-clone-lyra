import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  assertRowAccess,
  assertTableAccess,
  assertViewAccess,
} from "~/server/api/access";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { insertFakeRows } from "~/server/db/fakeRows";
import { allocateOrder } from "~/server/db/order";
import {
  countRows,
  queryRows,
  rowCursorSchema,
  rowOffsetSchema,
  RowQueryInputError,
  type RowRecord,
} from "~/server/db/rows";
import { parseViewConfig, toColumnInfo } from "~/server/db/viewConfig";

const cellValueSchema = z.union([z.string(), z.number()]);

function badRequest(message: string) {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

/**
 * Validates a value against a column type. Returns the value to store, or
 * null when the cell is empty (the key is then removed from the row's data).
 */
function normalizeValue(
  type: string,
  value: string | number | null,
): string | number | null {
  if (value === null) return null;
  if (type === "number") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      value = Number(trimmed);
    }
    if (!Number.isFinite(value)) throw badRequest("Value must be a number");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw badRequest("Value must be finite");
    return String(value);
  }
  return value === "" ? null : value;
}

export const rowRouter = createTRPCRouter({
  getRows: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        limit: z.number().int().min(1).max(500).default(200),
        // Continue after the previous page (keyset). Exclusive with offset.
        cursor: rowCursorSchema.nullish(),
        // Jump to a page that has no cursor: skip this many matching rows.
        offset: rowOffsetSchema.optional(),
        // "backward" returns the rows just before `cursor` (requires cursor).
        direction: z.enum(["forward", "backward"]).optional(),
        search: z.string().max(200).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.cursor && input.offset !== undefined) {
        throw badRequest("cursor and offset are mutually exclusive");
      }
      if (input.direction === "backward") {
        if (!input.cursor) throw badRequest("backward pages require a cursor");
        if (input.offset !== undefined) {
          throw badRequest("backward pages cannot be combined with offset");
        }
      }
      const userId = ctx.session.user.id;
      const view = await assertViewAccess(ctx.db, userId, input.viewId);
      const table = await assertTableAccess(ctx.db, userId, view.tableId);
      const config = parseViewConfig(view);
      try {
        return await queryRows(ctx.db, {
          tableId: table.id,
          columns: toColumnInfo(table.columns),
          filters: config.filters,
          sort: config.sort,
          search: input.search ?? config.search,
          limit: input.limit,
          cursor: input.cursor,
          offset: input.offset,
          direction: input.direction,
        });
      } catch (error) {
        if (error instanceof RowQueryInputError) {
          throw badRequest(error.message);
        }
        throw error;
      }
    }),

  countRows: protectedProcedure
    .input(
      z.object({ viewId: z.string(), search: z.string().max(200).optional() }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const view = await assertViewAccess(ctx.db, userId, input.viewId);
      const table = await assertTableAccess(ctx.db, userId, view.tableId);
      const config = parseViewConfig(view);
      const columns = toColumnInfo(table.columns);
      const [count, total] = await Promise.all([
        countRows(ctx.db, {
          tableId: table.id,
          columns,
          filters: config.filters,
          search: input.search ?? config.search,
        }),
        ctx.db.row.count({ where: { tableId: table.id } }),
      ]);
      return { count, total };
    }),

  createRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        data: z.record(z.string(), cellValueSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<RowRecord> => {
      const table = await assertTableAccess(
        ctx.db,
        ctx.session.user.id,
        input.tableId,
      );
      const typeById = new Map(table.columns.map((c) => [c.id, c.type]));
      const data: Record<string, string | number> = {};
      for (const [columnId, value] of Object.entries(input.data ?? {})) {
        const type = typeById.get(columnId);
        if (type === undefined) throw badRequest(`Unknown column: ${columnId}`);
        const normalized = normalizeValue(type, value);
        if (normalized !== null) data[columnId] = normalized;
      }
      return ctx.db.$transaction(async (tx) => {
        const order = await allocateOrder(tx, table.id, 1);
        const row = await tx.row.create({
          data: { tableId: table.id, order, data },
          select: { id: true, order: true },
        });
        return { id: row.id, order: row.order, data };
      });
    }),

  deleteRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowIds: z.array(z.string()).min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTableAccess(ctx.db, ctx.session.user.id, input.tableId);
      const { count } = await ctx.db.row.deleteMany({
        where: { tableId: input.tableId, id: { in: input.rowIds } },
      });
      return { deleted: count };
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        rowId: z.string(),
        columnId: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<RowRecord> => {
      const row = await assertRowAccess(
        ctx.db,
        ctx.session.user.id,
        input.rowId,
      );
      const column = await ctx.db.column.findFirst({
        where: { id: input.columnId, tableId: row.tableId },
      });
      if (!column) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Column not found" });
      }
      const value = normalizeValue(column.type, input.value);
      const update =
        value === null
          ? Prisma.sql`"data" - ${column.id}::text`
          : Prisma.sql`jsonb_set("data", ARRAY[${column.id}]::text[], ${JSON.stringify(value)}::jsonb)`;
      const rows = await ctx.db.$queryRaw<RowRecord[]>(
        Prisma.sql`UPDATE "Row" SET "data" = ${update}, "updatedAt" = now() WHERE id = ${row.id} AND "tableId" = ${row.tableId} RETURNING id, "order", data`,
      );
      const updated = rows[0];
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });
      }
      return updated;
    }),

  addFakeRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().int().min(1).max(100_000).default(100_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await assertTableAccess(
        ctx.db,
        ctx.session.user.id,
        input.tableId,
      );
      return insertFakeRows(ctx.db, {
        tableId: table.id,
        columns: table.columns.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type === "number" ? "number" : "string",
        })),
        count: input.count,
      });
    }),
});
