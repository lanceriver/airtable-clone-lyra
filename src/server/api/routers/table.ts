import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

import { faker } from "@faker-js/faker";
import { create } from "domain";


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
            const data: DefaultTableData[] = generateFakeData(table.rowCount, table.seed ?? 0);
            // Create the columns, using the first row of data to determine the column types.
            const columns = data[0] ? Object.keys(data[0]).map((key) => {
                const typedKey = key as keyof DefaultTableData;
                return {
                    heading: key,
                    type: typeof data[0]![typedKey],
                };
            }) : [];
            // Create the columns in the db.
            const columnIds: string[] = [];
            for (let i = 0; i < columns.length; i++) {
                const column = await ctx.db.column.create({
                    data: {
                        tableId: table.id,
                        position: i,
                        name: columns[i]!.heading,
                        type: columns[i]!.type,
                    }
                })
                if (!column) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create column!"})
                }
                columnIds.push(column.id);
            }
            // Create DB rows
            for (let i = 0; i < table.rowCount; i++) {
                const row = await ctx.db.row.create({
                    data: {
                        position: i,
                        tableId: table.id
                    }
                })
                if (!row) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create row!"})
                }
                // Create DB cells
                for (let j = 0; j < columns.length; j++) {
                    const cellData = data[i]![columns[j]!.heading as keyof DefaultTableData];
                    const cellValue: string | number | boolean = cellData;
                    let stringValue: string | undefined;
                    let numberValue: number | undefined;
                    if (typeof cellValue === "string") {
                        stringValue = cellValue;
                    }
                    else if (typeof cellValue === "number") {
                        numberValue = cellValue;
                    }
                    const columnId = columnIds[j];
                    if (!columnId) {
                        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid columnId!" });
                    }
                    const cell = await ctx.db.cell.create({
                        data: {
                            rowId: row.id,
                            columnId: columnId,
                            stringValue: stringValue,
                            numberValue: numberValue,
                        }
                    })
                    if (!cell) {
                        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create cell!"});
                    }
                }
            }
            // Create an additional empty row
            const extraRow = await ctx.db.row.create({
            data: {
                position: table.rowCount, // one after the last index
                tableId: table.id,
            }
            });

            if (!extraRow) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create extra row!",
            });
            }
            // Create empty cells in the extra row
            for (let j = 0; j < columns.length; j++) {
                const columnId = columnIds[j];
                if (!columnId) {
                    throw new TRPCError({
                            code: "INTERNAL_SERVER_ERROR",
                            message: "Invalid columnId!",
                });
            }
            const emptyCell = await ctx.db.cell.create({
                data: {
                rowId: extraRow.id,
                columnId: columnId,
                stringValue: null,
                numberValue: null,
                },
            });
            if (!emptyCell) {
                throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create empty cell in extra row!",
                });
            }
            }
            await ctx.db.table.update({
                where: { id: table.id },
                data: {
                    rowCount: {
                        increment: 1 // Increment the row count by 1 for the extra row
                    }
                }
            }); 
            // Update the base table count      
            await ctx.db.base.update({
                where: { id: input.baseId},
                data: {
                    tableCount: {
                        increment: 1
                    }
                }
            });
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


