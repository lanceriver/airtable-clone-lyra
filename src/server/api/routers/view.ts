import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertTableAccess, assertViewAccess } from "~/server/api/access";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  NUMBER_OPERATORS,
  TEXT_OPERATORS,
  ensureSortIndex,
  viewFilterSchema,
  viewSortSchema,
} from "~/server/db/rows";
import { isUniqueViolation } from "~/server/db/tables";
import {
  MAX_COLUMN_WIDTH_ENTRIES,
  clampColumnWidth,
  parseViewConfig,
  toColumnInfo,
  type ViewConfig,
} from "~/server/db/viewConfig";

const nameSchema = z.string().trim().min(1).max(100);

const nameTaken = () =>
  new TRPCError({
    code: "CONFLICT",
    message: "A view with this name already exists",
  });

const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

export const viewRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertTableAccess(ctx.db, ctx.session.user.id, input.tableId);
      return ctx.db.view.findMany({
        where: { tableId: input.tableId },
        select: { id: true, name: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
    }),

  get: protectedProcedure
    .input(z.object({ viewId: z.string() }))
    .query(async ({ ctx, input }) => {
      const view = await assertViewAccess(
        ctx.db,
        ctx.session.user.id,
        input.viewId,
      );
      return {
        id: view.id,
        name: view.name,
        tableId: view.tableId,
        config: parseViewConfig(view),
      };
    }),

  create: protectedProcedure
    .input(z.object({ tableId: z.string(), name: nameSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertTableAccess(ctx.db, ctx.session.user.id, input.tableId);
      let name = input.name;
      if (!name) {
        const existing = await ctx.db.view.findMany({
          where: { tableId: input.tableId },
          select: { name: true },
        });
        const taken = new Set(existing.map((v) => v.name));
        let n = 2; // "Grid view" itself is view 1
        while (taken.has(`Grid view ${n}`)) n++;
        name = `Grid view ${n}`;
      }
      try {
        return await ctx.db.view.create({
          data: { tableId: input.tableId, name },
          select: { id: true, name: true },
        });
      } catch (e) {
        if (isUniqueViolation(e)) throw nameTaken();
        throw e;
      }
    }),

  rename: protectedProcedure
    .input(z.object({ viewId: z.string(), name: nameSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertViewAccess(ctx.db, ctx.session.user.id, input.viewId);
      try {
        return await ctx.db.view.update({
          where: { id: input.viewId },
          data: { name: input.name },
          select: { id: true, name: true },
        });
      } catch (e) {
        if (isUniqueViolation(e)) throw nameTaken();
        throw e;
      }
    }),

  delete: protectedProcedure
    .input(z.object({ viewId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const view = await assertViewAccess(
        ctx.db,
        ctx.session.user.id,
        input.viewId,
      );
      await ctx.db.$transaction(async (tx) => {
        const remaining = await tx.view.findMany({
          where: { tableId: view.tableId, id: { not: view.id } },
          select: { id: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        const [next] = remaining;
        if (!next) throw badRequest("A table needs at least one view");
        await tx.table.updateMany({
          where: { id: view.tableId, activeViewId: view.id },
          data: { activeViewId: next.id },
        });
        await tx.view.delete({ where: { id: view.id } });
      });
      return { id: view.id };
    }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        filters: z.array(viewFilterSchema).max(20).optional(),
        sort: viewSortSchema.optional(),
        hiddenColumnIds: z.array(z.string()).optional(),
        search: z.string().max(200).optional(),
        columnWidths: z
          .record(z.string(), z.number().finite())
          .refine(
            (widths) => Object.keys(widths).length <= MAX_COLUMN_WIDTH_ENTRIES,
            `At most ${MAX_COLUMN_WIDTH_ENTRIES} column widths`,
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ViewConfig> => {
      const userId = ctx.session.user.id;
      const view = await assertViewAccess(ctx.db, userId, input.viewId);
      const table = await assertTableAccess(ctx.db, userId, view.tableId);
      const columns = toColumnInfo(table.columns);
      const byId = new Map(columns.map((c) => [c.id, c]));

      const data: Prisma.ViewUpdateInput = {};

      if (input.filters !== undefined) {
        for (const f of input.filters) {
          const col = byId.get(f.columnId);
          if (!col) throw badRequest(`Unknown field: ${f.columnId}`);
          const valid =
            col.type === "number" ? NUMBER_OPERATORS : TEXT_OPERATORS;
          if (!valid.includes(f.operator)) {
            throw badRequest(
              `Operator "${f.operator}" is not valid for a ${col.type} field`,
            );
          }
        }
        data.filters = input.filters;
      }

      if (input.sort !== undefined) {
        if (input.sort === null) {
          data.sort = Prisma.DbNull;
        } else {
          const col = byId.get(input.sort.columnId);
          if (!col) throw badRequest(`Unknown field: ${input.sort.columnId}`);
          // Outside any transaction (CREATE INDEX CONCURRENTLY), and before the
          // sort is saved so a saved sort always has its index.
          await ensureSortIndex(ctx.db, table.id, col, input.sort.direction);
          data.sort = input.sort;
        }
      }

      if (input.hiddenColumnIds !== undefined) {
        // The primary field (first by order) can't be hidden, as in Airtable.
        const primaryId = columns[0]?.id;
        data.hiddenColumnIds = [
          ...new Set(
            input.hiddenColumnIds.filter(
              (id) => byId.has(id) && id !== primaryId,
            ),
          ),
        ];
      }

      if (input.search !== undefined) data.search = input.search;

      if (input.columnWidths !== undefined) {
        // Replaces the saved map; unknown fields are dropped, widths clamped.
        data.columnWidths = Object.fromEntries(
          Object.entries(input.columnWidths)
            .filter(([id]) => byId.has(id))
            .map(([id, width]) => [id, clampColumnWidth(width)]),
        );
      }

      const updated = await ctx.db.view.update({
        where: { id: view.id },
        data,
      });
      return parseViewConfig(updated);
    }),
});
