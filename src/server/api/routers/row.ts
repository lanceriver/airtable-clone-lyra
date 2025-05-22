import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const rowRouter = createTRPCRouter({
    createRow: protectedProcedure
    .input(z.object({ position: z.number(), tableId: z.string().min(1)}))
    .mutation(async ({ ctx, input }) => {
        const existing = await ctx.db.row.findFirst({
            where: {
                position: input.position
            }
        });
        if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "Cannot add row in the same position!"})
        }
        const row = await ctx.db.row.create({
            data: {
                position: input.position,
                tableId: input.tableId
            }
        })
        if (!existing) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create row!"})
        }
        const updateCount = await ctx.db.table.update({
            where: {
                id: input.tableId
            },
            data: {
                rowCount: {
                    increment: 1
                }
            }
        });
        if (!updateCount) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update count!"})
        }
        return row;
    }),
    // Construct table data from rows and columns to send to the client, makes it easier to render the table.
    getRows: protectedProcedure
    .input(z.object({ tableId: z.string().min(1), count: z.number().min(1).max(100), offset: z.number().min(0)}))
    .query(async ({ ctx, input}) => {
        const rows = await ctx.db.row.findMany({
            where: {
                tableId: input.tableId
            },
            include: {
                cells: true },
            take: input.count,
            skip: input.offset,
            orderBy: {
                position: "asc"
            }
        })
        if (!rows) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
        }
        console.log("rows are:",rows);
        return rows;
    }),
    deleteRow: protectedProcedure
    .input(z.object({ tableId: z.string().min(1), rowId: z.string().min(1)}))
    .mutation(async ({ ctx, input}) => {
        const deleted = await ctx.db.row.delete({
            where: {
                id: input.rowId
            }
        });
        if (!deleted) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete row!"})
        }
        const updateCount = await ctx.db.table.update({
            where: {
                id: input.tableId
            },
            data: {
                rowCount: {
                    decrement: 1
                }
            }
        });
        if (!updateCount) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update count!"})
        }
        return deleted;
    })
})