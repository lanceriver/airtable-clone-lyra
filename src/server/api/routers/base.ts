import { z } from "zod";

import { assertBaseAccess } from "~/server/api/access";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { dropSortIndexes } from "~/server/db/rows";
import { createTableWithDefaults } from "~/server/db/tables";
import { BASE_COLORS, getBaseColor, randomBaseColor } from "~/lib/baseColors";

const nameSchema = z.string().trim().min(1).max(100);
const colorSchema = z.enum(BASE_COLORS);

export const baseRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const bases = await ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        tables: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 1,
          select: {
            id: true,
            views: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    return bases.map((b) => ({
      id: b.id,
      name: b.name,
      color: getBaseColor(b.color).name,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      firstTableId: b.tables[0]?.id ?? null,
      firstViewId: b.tables[0]?.views[0]?.id ?? null,
    }));
  }),

  create: protectedProcedure
    .input(
      z
        .object({ name: nameSchema.optional(), color: colorSchema.optional() })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.create({
        data: {
          name: input?.name ?? "Untitled Base",
          color: input?.color ?? randomBaseColor(),
          ownerId: ctx.session.user.id,
        },
      });
      try {
        const { table, viewId } = await createTableWithDefaults(ctx.db, {
          baseId: base.id,
          name: "Table 1",
        });
        return {
          id: base.id,
          name: base.name,
          color: getBaseColor(base.color).name,
          tableId: table.id,
          viewId,
        };
      } catch (e) {
        await ctx.db.base.delete({ where: { id: base.id } }).catch(() => null);
        throw e;
      }
    }),

  rename: protectedProcedure
    .input(z.object({ baseId: z.string(), name: nameSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertBaseAccess(ctx.db, ctx.session.user.id, input.baseId);
      return ctx.db.base.update({
        where: { id: input.baseId },
        data: { name: input.name },
        select: { id: true, name: true },
      });
    }),

  setColor: protectedProcedure
    .input(z.object({ baseId: z.string(), color: colorSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertBaseAccess(ctx.db, ctx.session.user.id, input.baseId);
      return ctx.db.base.update({
        where: { id: input.baseId },
        data: { color: input.color },
        select: { id: true, color: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const base = await assertBaseAccess(
        ctx.db,
        ctx.session.user.id,
        input.baseId,
      );
      const tables = await ctx.db.table.findMany({
        where: { baseId: base.id },
        select: { id: true },
      });
      for (const t of tables) {
        await dropSortIndexes(ctx.db, { tableId: t.id });
      }
      await ctx.db.base.delete({ where: { id: base.id } });
      return { id: base.id };
    }),
});
