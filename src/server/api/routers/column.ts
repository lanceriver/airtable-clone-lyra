import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";

export const columnRouter = createTRPCRouter({
    createColumn: protectedProcedure
        .input(z.object({ tableId: z.string().min(1), position: z.number(),
            name: z.string().min(1), type: z.string().min(1)
        }))
        .mutation(async ({ctx, input}) => {
            const existing = await ctx.db.column.findFirst({
                where: {
                    tableId: input.tableId,
                    name: input.name
                }
            })
            if (existing) {
                throw new TRPCError({ code: "CONFLICT", message: "Column name must be unique!"})
            }
            const column = await ctx.db.column.create({
                data: {
                    position: input.position,
                    name: input.name,
                    tableId: input.tableId,
                    type: input.type
                }
            })
            if (!column) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create column!"})
            }
            const updateCount = await ctx.db.table.update({
            where: {
                id: input.tableId
            },
            data: {
                colCount: {
                    increment: 1
                }
            }
            });
            if (!updateCount) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update count!"})
            }
            return column;
        }),
    deleteColumn: protectedProcedure
        .input(z.object({ tableId: z.string().min(1), columnId: z.string().min(1)
        }))
        .mutation(async ({ctx, input}) => {
            const column = await ctx.db.column.delete({
                where: {
                    id: input.columnId,
                }
            })
            if (!column) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete column!"})
            }
            const updateCount = await ctx.db.table.update({
            where: {
                id: input.tableId
            },
            data: {
                colCount: {
                    decrement: 1
                }
            }
            });
            if (!updateCount) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update count!"})
            }
            return column;
        }),
    editColumn: protectedProcedure
        .input(z.object({ tableId: z.string().min(1), columnId: z.string().min(1),
            newName: z.string().optional(), newType: z.string().optional()
        }))
        .mutation(async ({ctx, input}) => {
            const column = await ctx.db.column.update({
                where: {
                    id: input.columnId,
                },
                data: {
                    ...(input.newName !== undefined ? { name: input.newName } : {}),
                    ...(input.newType !== undefined ? { type: input.newType } : {}),
                }
            });
            if (!column) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update column!"});
            }
            return column;
        }),
    getColumns: protectedProcedure
        .input(z.object({ tableId: z.string().min(1)}))
        .query(async ({ ctx, input}) => {
            const columns = await ctx.db.column.findMany({
                where: { tableId: input.tableId},
                orderBy: { position: "asc"}
            });
            if (!columns) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get columns!"})
            }
            return columns;
        }),
})
