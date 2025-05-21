import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

import { faker } from "@faker-js/faker";


type DefaultTableData = {
    firstName: string;
    lastName: string;
    number: number;
    email: string;
}

export function generateFakeData(count: number, seed: number): DefaultTableData[] {
  faker.seed(seed);
  return Array.from({ length: count }, () => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    number: faker.number.int({ min: 0, max: 10000}),
    email: faker.internet.email(),
  }));
}

export const tableRouter = createTRPCRouter({
    createTable: protectedProcedure
        .input(z.object({ name: z.string().min(1), baseId: z.string().min(1), colCount: z.number().min(1), rowCount: z.number().min(1), seed: z.number().optional() }))   
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.table.findFirst({
                where: {
                    baseId: input.baseId,
                    name: input.name,
                }
            });
            if (existing) {
                throw new TRPCError({ code: "CONFLICT", message: "Table name must be unique!"})
            }
            const table = await ctx.db.table.create({
                data: {
                    name: input.name,
                    baseId: input.baseId,
                    createdAt: new Date(),
                    colCount: input.colCount,
                    rowCount: input.rowCount,
                    seed: input.seed,
                },
            });
            const data = generateFakeData(table.rowCount, table.seed ?? 0);
            await ctx.db.base.update({
                where: { id: input.baseId},
                data: {
                    tableCount: {
                        increment: 1}
                }
            })
            return table;
        }),
    getTables: protectedProcedure
        .input(z.object({ baseId: z.string().min(1)}))
        .query(async ({ ctx, input}) => {
            return ctx.db.table.findMany({
                where: { baseId: input.baseId},
                orderBy: { createdAt: "asc"}
            }); 
    }),
    deleteTable: protectedProcedure
        .input(z.object({ id: z.string().min(1)}))
        .mutation(async ({ ctx, input} ) => {
            const table = await ctx.db.table.findUnique({
                where: { id: input.id},
            });
            const baseId = table?.baseId;
            const base = await ctx.db.base.findUnique({
                where: { id: baseId}
            });
            if (base?.tableCount === 0) {
                throw new Error("Base must have at least one table)");
            }
            await ctx.db.base.update({
                where: { id: baseId},
                data: {
                    tableCount: {
                        decrement: 1
                    }
                }
            });
            return ctx.db.table.delete({
                where: { id: input.id }
            })
        }),
})


