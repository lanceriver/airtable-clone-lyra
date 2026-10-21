import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertColumnAccess, assertTableAccess } from "~/server/api/access";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { dropSortIndexes } from "~/server/db/rows";
import { stripColumnKey } from "~/server/db/tables";
import { parseViewConfig } from "~/server/db/viewConfig";

const nameSchema = z.string().trim().min(1).max(100);

const nameTaken = () =>
  new TRPCError({
    code: "CONFLICT",
    message: "A field with this name already exists",
  });

export const columnRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: nameSchema,
        type: z.enum(["string", "number"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await assertTableAccess(
        ctx.db,
        ctx.session.user.id,
        input.tableId,
      );
      // No per-row writes: a missing key in a row's JSONB data is an empty cell.
      return ctx.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"col:" + table.id}))`;
        const clash = await tx.column.findFirst({
          where: {
            tableId: table.id,
            name: { equals: input.name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (clash) throw nameTaken();
        const max = await tx.column.aggregate({
          where: { tableId: table.id },
          _max: { order: true },
        });
        return tx.column.create({
          data: {
            tableId: table.id,
            name: input.name,
            type: input.type,
            order: (max._max.order ?? -1) + 1,
          },
        });
      });
    }),

  rename: protectedProcedure
    .input(z.object({ columnId: z.string(), name: nameSchema }))
    .mutation(async ({ ctx, input }) => {
      const column = await assertColumnAccess(
        ctx.db,
        ctx.session.user.id,
        input.columnId,
      );
      return ctx.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"col:" + column.tableId}))`;
        const clash = await tx.column.findFirst({
          where: {
            tableId: column.tableId,
            id: { not: column.id },
            name: { equals: input.name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (clash) throw nameTaken();
        return tx.column.update({
          where: { id: column.id },
          data: { name: input.name },
        });
      });
    }),

  delete: protectedProcedure
    .input(z.object({ columnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const column = await assertColumnAccess(
        ctx.db,
        ctx.session.user.id,
        input.columnId,
      );
      const count = await ctx.db.column.count({
        where: { tableId: column.tableId },
      });
      if (count <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A table needs at least one field",
        });
      }

      await stripColumnKey(ctx.db, {
        tableId: column.tableId,
        columnId: column.id,
      });

      const views = await ctx.db.view.findMany({
        where: { tableId: column.tableId },
      });
      await ctx.db.$transaction(async (tx) => {
        for (const view of views) {
          const config = parseViewConfig(view);
          const filters = config.filters.filter(
            (f) => f.columnId !== column.id,
          );
          const hidden = config.hiddenColumnIds.filter(
            (id) => id !== column.id,
          );
          const sortCleared = config.sort?.columnId === column.id;
          const touched =
            filters.length !== config.filters.length ||
            hidden.length !== config.hiddenColumnIds.length ||
            sortCleared;
          if (!touched) continue;
          await tx.view.update({
            where: { id: view.id },
            data: {
              filters,
              hiddenColumnIds: hidden,
              ...(sortCleared ? { sort: Prisma.DbNull } : {}),
            },
          });
        }
        await tx.column.delete({ where: { id: column.id } });
      });

      await dropSortIndexes(ctx.db, {
        tableId: column.tableId,
        columnId: column.id,
      });
      return { id: column.id };
    }),
});
