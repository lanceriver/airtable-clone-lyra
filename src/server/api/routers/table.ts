import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertBaseAccess, assertTableAccess } from "~/server/api/access";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { dropSortIndexes } from "~/server/db/rows";
import {
  createTableWithDefaults,
  isUniqueViolation,
  nextTableName,
} from "~/server/db/tables";

const nameSchema = z.string().trim().min(1).max(100);

const nameTaken = () =>
  new TRPCError({
    code: "CONFLICT",
    message: "A table with this name already exists",
  });

export const tableRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBaseAccess(ctx.db, ctx.session.user.id, input.baseId);
      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        select: { id: true, name: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
    }),

  get: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await assertTableAccess(
        ctx.db,
        ctx.session.user.id,
        input.tableId,
      );
      const views = await ctx.db.view.findMany({
        where: { tableId: table.id },
        select: { id: true, name: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return {
        id: table.id,
        name: table.name,
        baseId: table.baseId,
        columns: table.columns.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          order: c.order,
        })),
        views,
      };
    }),

  create: protectedProcedure
    .input(z.object({ baseId: z.string(), name: nameSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertBaseAccess(ctx.db, ctx.session.user.id, input.baseId);
      const name = input.name ?? (await nextTableName(ctx.db, input.baseId));
      try {
        const { table, viewId } = await createTableWithDefaults(ctx.db, {
          baseId: input.baseId,
          name,
        });
        return { id: table.id, name: table.name, viewId };
      } catch (e) {
        if (isUniqueViolation(e)) throw nameTaken();
        throw e;
      }
    }),

  rename: protectedProcedure
    .input(z.object({ tableId: z.string(), name: nameSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertTableAccess(ctx.db, ctx.session.user.id, input.tableId);
      try {
        const table = await ctx.db.table.update({
          where: { id: input.tableId },
          data: { name: input.name },
          select: { id: true, name: true },
        });
        return table;
      } catch (e) {
        if (isUniqueViolation(e)) throw nameTaken();
        throw e;
      }
    }),

  delete: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const table = await assertTableAccess(
        ctx.db,
        ctx.session.user.id,
        input.tableId,
      );
      const siblings = await ctx.db.table.count({
        where: { baseId: table.baseId },
      });
      if (siblings <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A base needs at least one table",
        });
      }
      await dropSortIndexes(ctx.db, { tableId: table.id });
      await ctx.db.table.delete({ where: { id: table.id } });
      return { id: table.id };
    }),
});
