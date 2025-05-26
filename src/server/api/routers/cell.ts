import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const cellRouter = createTRPCRouter({
    createCell: protectedProcedure
    .input(z.object({rowId: z.string().min(1), columnId: z.string().min(1), stringValue: z.string().optional(),
        numberValue: z.number().optional()
    }))
    .mutation(async ({ ctx, input}) => {
        const cell = await ctx.db.cell.create({
            data: {
                rowId: input.rowId,
                columnId: input.columnId,
                ...(input.stringValue !== undefined ? {stringValue: input.stringValue} : {}),
                ...(input.numberValue !== undefined ? {numberValue: input.numberValue} : {})
            }
        })
        if (!cell) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create cell!"});
        }
        return cell;
    }),
    updateCell: protectedProcedure
    .input(z.object({id: z.string().min(1).optional(), stringValue: z.string().optional(),
        numberValue: z.number().optional(), rowId: z.string().min(1), columnId: z.string().min(1)
    }))
    .mutation(async ({ ctx, input}) => {
        const cell = await ctx.db.cell.update({
            where: {
                rowId_columnId: {
                    rowId: input.rowId,
                    columnId: input.columnId
                }
            },
            data: {
                ...(input.stringValue !== undefined ? {stringValue: input.stringValue} : {}),
                ...(input.numberValue !== undefined ? {numberValue: input.numberValue} : {})
            }
        })
        if (!cell) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update cell!"});
        }
        return cell;
    }),
    sortCell: protectedProcedure
    .input(z.object({rowId: z.string().min(1), columnId: z.string().min(1), order: z.string().min(1)}))
    .mutation(async ({ ctx, input}) => {
        const cell = await ctx.db.cell.findMany({
            where: {
                columnId: input.columnId,
            },
            orderBy: {
                
            }
        })
    })
});