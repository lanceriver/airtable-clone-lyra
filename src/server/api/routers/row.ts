import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const rowRouter = createTRPCRouter({
    createRow: protectedProcedure
    .input(z.object({ position: z.number(), tableId: z.string().min(1), direction: z.string().optional()}))
    .mutation(async ({ ctx, input }) => {
        /* const existing = await ctx.db.row.findFirst({
            where: {
                tableId: input.tableId,
                position: input.position
            }
        });
        if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "Cannot add row in the same position!"})
        } */
       // Insert a new row above or below.
        if (input.direction === "above") {
            await ctx.db.row.updateMany({
                where: {
                    tableId: input.tableId,
                    position: { gte: input.position }
                },
                data: {
                    position: { increment: 1 }
                }
        });
        // Insert at input.position
        } else if (input.direction === "below") {
            await ctx.db.row.updateMany({
                where: {
                    tableId: input.tableId,
                    position: { gt: input.position }
                },
                data: {
                    position: { increment: 1 }
                }
            });
            input.position = input.position + 1; 
        }
        console.log("input pos is ", input.position);
        const row = await ctx.db.row.create({
            data: {
                position: input.position,
                tableId: input.tableId
            }
        })
        if (!row) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create row!"})
        }
        const columns = await ctx.db.column.findMany({
            where: {
                tableId: input.tableId,
            }
        })
        if (!columns) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get table!"})
        }
        const cells = await ctx.db.cell.createManyAndReturn({
            data: columns.map((column) => ({
                rowId: row.id,
                columnId: column.id,
                stringValue: null,
                numberValue: null
            }))
        });
        if (!cells) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create cells!"})
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
    // Mainly used to get the row data for a specific row, including all the cells in that row.
    queryRow: protectedProcedure
    .input(z.object({ rowId: z.string().min(1)}))
    .query(async ({ ctx, input}) => {
        const row = await ctx.db.row.findUnique({
            where: {
                id: input.rowId
            },
            include: {
                cells: true
            }
        })
        if (!row) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get row!"})
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
            take: input.count + 1,
            skip: input.offset,
            orderBy: {
                position: "asc"
            }
        })
        if (!rows) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
        }
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
        console.log(deleted.position);
        if (!deleted) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete row!"})
        }
        const updatePositions = await ctx.db.row.updateMany({
            where: {
                tableId: input.tableId,
                position: { gt: deleted.position }
            },
            data: {
                position: { decrement: 1}
            }
        });
        if (!updatePositions) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update positions!"})
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
    }),
    sortRows: protectedProcedure
    .input(z.object({ columnId: z.string().min(1), order: z.string().min(1)}))
    .query(async ({ ctx, input}) => {
        const cells = await ctx.db.cell.findMany({
            where: {
                columnId: input.columnId,
            },
            orderBy: {
                ...(input.order === "asc" ? { stringValue: "asc" } : { stringValue: "desc" })
            }
        })
        if (!cells) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get cells!"})
        }
        const rowIds = cells.map(cell => cell.rowId);
        const rows = await ctx.db.row.findMany({
            where: {
                id: { in: rowIds }
            },
            include: {
                cells: true
            }
        })
        if (!rows) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
        }
        const rowMap = new Map(rows.map(row => [row.id, row]));
        const sortedRows = rowIds.map(id => rowMap.get(id)).filter(Boolean);
        return sortedRows;
    })
})