/* eslint-disable
  @typescript-eslint/no-inferrable-types,
  @typescript-eslint/prefer-optional-chain,
  @typescript-eslint/no-unused-expressions,
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-unsafe-call,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/prefer-nullish-coalescing
*/
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

import { generateFakeData, type DefaultTableData } from "./table";

const operatorsMap = {
  "contains": (columnId: string, value: string | number) => ({
    "stringValue": { contains: String(value) }
  }),
  "does not contain": (columnId: string, value: string | number) => ({
    NOT: { "stringValue": { contains: String(value) } }
  }),
  "is": (columnId: string, value: string | number) => ({
    [typeof value === "string" ? "stringValue" : "numberValue"]: { equals: value }
  }),
  "is not": (columnId: string, value: string | number) => ({
    [typeof value === "string" ? "stringValue" : "numberValue"]: { not: value }
  }),
  "empty": (columnId: string) => ({
    "stringValue": null,
    "numberValue": null
  }),
  "is not empty": (columnName: string) => ({
    NOT: { "stringValue": null,
        "numberValue": null
     }
  }),
  "gt": (columnId: string, value: string | number) => ({
    [typeof value === "string" ? "stringValue" : "numberValue"]: { gt: value }
  }),
  "lt": (columnId: string, value: string | number) => ({
    [typeof value === "string" ? "stringValue" : "numberValue"]: { lt: value }
  }),
  "gte": (columnId: string, value: string | number) => ({
    [typeof value === "string" ? "stringValue" : "numberValue"]: { gte: value }
  }),
  "lte": (columnId: string, value: string | number) => ({
    [typeof value === "string" ? "stringValue" : "numberValue"]: { lte: value }
  })

};

type Operator = keyof typeof operatorsMap;

const buildSqlQuery = (
    tableId: string,
    filters?: { columnId?: string; operator: Operator; value?: string | number }[],
    sort?: { columnId: string; order: string },
    cursor?: {id?: string | null | undefined, value?: string | number | null},
    count: number = 100
) => {

    const params: (string | number)[] = [tableId];

    let query = `
    SELECT r.*, (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'rowId', c."rowId",
                'columnId', c."columnId",
                'stringValue', c."stringValue",
                'numberValue', c."numberValue"
            )
        )
        FROM "Cell" c 
        WHERE c."rowId" = r.id
    ) AS cells
    FROM "Row" r
    WHERE r."tableId" = $1
    `;

    console.log("params:", params);

    if (filters?.length) {
        filters.forEach((filter, index) => {
            if (!filter.columnId) {
                query += `
                AND EXISTS (
                    SELECT 1 FROM "Cell" c${index}
                    WHERE c${index}."rowId" = r.id
                    AND ${buildFilterQuery(index, filter, params)}
                    )`;
            }
            else {
                params.push(filter.columnId);
                query += `
                AND EXISTS (
                    SELECT 1 FROM "Cell" c${index}
                    WHERE c${index}."rowId" = r.id
                    AND c${index}."columnId" = $${params.length}
                    AND ${buildFilterQuery(index, filter, params)} 
                )`;
            }
            
        }); 
    }

    if (cursor && cursor.id !== undefined && cursor.id !== null) {
        params.push(cursor.id);
        query += `AND r.id > $${params.length}`
    }

    query += `
    GROUP BY r.id
    `;

    if (sort) {
        params.push(sort.columnId);
        const sortIndex = params.length;
        if (cursor && cursor.value !== undefined && cursor.value !== null) {
            params.push(cursor.value);
            query += `
            HAVING (
                SELECT c."stringValue"
                FROM "Cell" c
                WHERE c."rowId" = r.id
                AND c."columnId" = $${sortIndex}
            ) ${sort.order === "asc" ? ">" : "<"} $${params.length}
            ORDER BY (
                SELECT c."stringValue" 
                FROM "Cell" c
                WHERE c."rowId" = r.id
                AND c."columnId" = $${sortIndex}
            )
            ${sort.order === "asc" ? "ASC" : "DESC"},
            r.id ASC`;
        }
        else {
            query += `
            ORDER BY (
                SELECT c."stringValue" 
                FROM "Cell" c
                WHERE c."rowId" = r.id
                AND c."columnId" = $${sortIndex}
            )
            ${sort.order === "asc" ? "ASC" : "DESC"},
            r.id ASC`;
        }
    }
    

    params.push(count + 1);
    query += `
    LIMIT $${params.length}
    `;

    return { query, params };
};
//  Builds an SQL query based on provided filters.
const buildFilterQuery = (
    index: number, 
    filters: { operator: Operator; value?: string | number },
    params: ( string | number )[]
) => {

    switch (filters.operator) {
        case "contains":
            params.push(`%${filters.value}%`);
            return `c${index}."stringValue" ILIKE $${params.length}`;
        case "does not contain":
            params.push(`%${filters.value}%`);
            return `c${index}."stringValue" NOT ILIKE $${params.length}`;
        case "is":
            params.push(`%${filters.value}%`);
            if (typeof filters.value === "number") {
                return `c${index}."numberValue" = $${params.length}`;
            }
            else if (typeof filters.value === "string") {
                return `c${index}."stringValue" ILIKE $${params.length}`;
            }
        case "is not":
            params.push(`%${filters.value}%`);
            if (typeof filters.value === "number") {
                return `c${index}."numberValue" != $${params.length}`;
            }
            else if (typeof filters.value === "string") {
                return `c${index}."stringValue" NOT ILIKE $${params.length}`;
            }
        case "empty":
            return `c${index}."stringValue" IS NULL`;
        case "is not empty":
            return `c${index}."stringValue" IS NOT NULL`;
        case "gt":
            return `c${index}."numberValue" > $${params.length}`;
        case "lt":
            return `c${index}."numberValue" < $${params.length}`;
        case "gte":
            return `c${index}."numberValue" >= $${params.length}`;
        case "lte":
            return `c${index}."numberValue" <= $${params.length}`;
    }
}


export const rowRouter = createTRPCRouter({
    createRow: protectedProcedure
    .input(z.object({ position: z.number(), tableId: z.string().min(1), direction: z.string().optional()}))
    .mutation(async ({ ctx, input }) => {
        const row = await ctx.db.row.create({
            data: {
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
    // Construct table data from rows and columns to send to the client, makes it easier to render the table. Also takes filter and sort if specified by frontend.
    getRows: protectedProcedure
    .input(z.object({ tableId: z.string().min(1), count: z.number().min(1).max(1000), offset: z.number().min(0), cursor: z.object({id: z.string().optional(), value: z.union([z.string(), z.number()]).optional()}).nullish(), direction: z.enum(['forward', 'backward']).optional(),
            sort: z.object({columnId: z.string().min(1), order: z.string().min(1)}).optional(), 
            filters: z.object({columnId: z.string().optional(), operator: z.enum(['contains', 'does not contain', 'is', 'is not', 'empty', 'is not empty']), 
                value: z.union([z.string().min(1), z.number()]).optional(),
            }).optional()
    }))
    .query(async ({ ctx, input}) => {
        const { cursor, sort, filters, count, tableId } = input;
        // Dynamically construct query based on args provided (sort / filter)

        console.log("Input for getRows:", input);

        if (!filters && !sort) {
            const rows = await ctx.db.row.findMany({
                take: input.count + 1,
                where: {
                    tableId: input.tableId
                },
                include: {
                    cells: true 
                },
                cursor: cursor ? {id: cursor.id} : undefined,
                orderBy: {
                        id: 'asc',
                    },
            }) 
            if (!rows) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
            }
            let nextCursor: typeof cursor | undefined = undefined;
            if (rows.length > input.count) {
                const nextItem = rows.pop();
                nextCursor = {
                        id: nextItem?.id,
                }
            }
            return {
                rows,
                nextCursor
            };
        }

        if (filters || sort) {
            console.log(cursor);
            console.log(count);
            const { query, params } = buildSqlQuery(
                tableId,
                filters ? [filters] : undefined,
                sort,
                cursor ?? undefined,
                count + 1
            );
            const rows = await ctx.db.$queryRawUnsafe<any[]>(query, ...params);
            if (!rows) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
            }
            let nextCursor: typeof cursor | undefined = undefined;
            if (rows.length > input.count) {
                const nextItem = rows.pop();
                let nextValue = nextItem?.cells.find((cell: any) => cell.columnId === sort?.columnId)?.stringValue;
                if (nextValue === null || nextValue === undefined) {
                    nextValue = nextItem?.cells.find((cell: any) => cell.columnId === sort?.columnId)?.numberValue;
                }
                nextCursor = {
                    id: nextItem?.id,
                    value: nextValue
                };
                console.log("Next item:", nextCursor);
            }
            return {
                rows: rows,
                nextCursor
            }
        }

        /* const cellsQuery: Prisma.CellFindManyArgs = {
            take: count + 1,
            cursor: cursor ? {id: cursor} : undefined
        }

        if (filters) {
            if (
                filters.operator === "empty" ||
                filters.operator === "is not empty"
            ) {
                const queryObj = buildQuery(filters.columnId, "" as string, filters.operator);
                cellsQuery.where = {
                    ...(cellsQuery.where ?? {}),
                    columnId: filters.columnId,
                    ...queryObj
                }
            } else if (filters.value !== undefined) {
                const queryObj = buildQuery(filters.columnId, filters.value, filters.operator);
                cellsQuery.where = {
                    ...(cellsQuery.where ?? {}),
                    columnId: filters.columnId,
                    ...queryObj
                }
            } else {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Filter value is required for this operator." });
            }
        }
        // Gets filtered cells based on filter parameters
        if (sort) {
            cellsQuery.where = {
                ...(cellsQuery.where ?? {}),
                    columnId: sort.columnId
            }
    
            cellsQuery.orderBy = {
                    ...(sort.order === "asc" ? { stringValue: "asc" } : { stringValue: "desc" })
            }
        }
        console.log("Cells query:", cellsQuery);
        
        const cells = await ctx.db.cell.findMany({
            ...cellsQuery
        })
        if (!cells) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get cells!"})
        }
        const rowIds = cells.map(cell => cell.rowId);
        let rows = await ctx.db.row.findMany({
            take: input.count + 1,
            where: {
                id: { in: rowIds },
                tableId: tableId
            },
            include: {
                cells: true
            },
        })
        if (!rows) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
        }
        console.log("Rows before sorting:", rows);
        if (sort) {
            const rowMap = new Map(rows.map(row => [row.id, row]));
            rows = rowIds.map(id => rowMap.get(id)).filter(row => row !== undefined);
            if (!rows) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to sort rows!"});
            }
        }
        
        let nextCursor: typeof cursor | undefined = undefined;
        if (cells.length > input.count) {
            const nextItem = cells.pop();
            nextCursor = nextItem?.id;
        }
        return {
            rows, nextCursor
        }; */
        /* if (input.filters) {
            const cells = await ctx.db.cell.findMany({
                take: input.count + 1,
                where: {
                    columnId: input.filters.columnId,
                    stringValue: {
                        equals: input.filters.string
                    },
                },
                cursor: cursor ? {id: cursor} : undefined
            });
            if (!cells) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get cells!"})
            }
            const rowIds = cells.map(cell => cell.rowId);
            let rows = await ctx.db.row.findMany({
                take: input.count + 1,
                where: {
                    id: { in: rowIds }
                },
                include: {
                    cells: true
                },
            })
            if (!rows) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
            }
            let nextCursor: typeof cursor | undefined = undefined;
            if (rows.length > input.count) {
                const nextItem = rows.pop();
                nextCursor = nextItem?.id;
            }
            if (!input.sort) {
                return {
                    rows,
                    nextCursor
                };
            }
        }
        // TODO: account for the case when it is filtered but not sorted yet
        if (input.sort) {
            let cells;
            if (!input.filters) {
                const sortedCells = await ctx.db.cell.findMany({
                take: input.count + 1,
                where: {
                    columnId: input.sort.columnId
                },
                orderBy: {
                    ...(input.sort.order === "asc" ? { stringValue: "asc" } : { stringValue: "desc" })
                },
                cursor: cursor ? {id: cursor} : undefined
            })
                if (!sortedCells) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get cells!"})
                }
                cells = sortedCells;
            }
            else {
                cells = filteredCells;
            }
            

            const rowIds = cells!.map(cell => cell.rowId);
            let rows = await ctx.db.row.findMany({
                take: input.count + 1,
                where: {
                    id: { in: rowIds }
                },
                include: {
                    cells: true
                },
            })
            if (!rows) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
            }
            //console.log("rows are:", rows);
            
            let nextCursor: typeof cursor | undefined = undefined;
            if (cells!.length > input.count) {
                const nextItem = cells!.pop();
                nextCursor = nextItem?.id;
            }
            return {
                rows, nextCursor
            };
        }
        else {
            const rows = await ctx.db.row.findMany({
                take: input.count + 1,
                where: {
                    tableId: input.tableId
                },
                include: {
                    cells: true 
                },
                cursor: cursor ? {id: cursor} : undefined,
                orderBy: {
                        id: 'asc',
                    },
            }) 
            if (!rows) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
            }
            let nextCursor: typeof cursor | undefined = undefined;
            if (rows.length > input.count) {
                const nextItem = rows.pop();
                nextCursor = nextItem?.id;
            }
            return {
                rows,
                nextCursor
            };
        } */
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
            },
        })
        if (!rows) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get rows!"})
        }
        const rowMap = new Map(rows.map(row => [row.id, row]));
        const sortedRows = rowIds.map(id => rowMap.get(id)).filter(row => row !== undefined);
        if (!sortedRows) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to sort rows!"});
        }
        return sortedRows;
    }),
    create100krows: protectedProcedure
    .input(z.object({ tableId: z.string().min(1), seed: z.string().min(1).optional()}))
    .mutation(async ({ ctx, input}) => {
        const columns = await ctx.db.column.findMany({
            where: {
                tableId: input.tableId,
                }
            });
        if (!columns) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get table!"})
        }
        const columnIds = columns.map(columns => columns.id);
        const columnNames = columns.map(columns => columns.name);
        const batchSize = 5000;
        for (let i = 0; i < 100000; i += batchSize) {
            await ctx.db.$transaction(async (tx) => {
                const created = await tx.row.createMany({
                    data: Array.from({ length: batchSize }, () => ({
                        tableId: input.tableId,
                    }))
                });
                if (!created) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create batch!"})
                }
                const newRows = await tx.row.findMany({
                    where: {
                        tableId: input.tableId,
                    },
                    orderBy: { id: "desc" },
                    take: batchSize,
                });
                const fakeData: DefaultTableData[] = generateFakeData(
                    batchSize,
                    input.seed ? Number(input.seed) : 0
                );
                // seed with fake data
                const cells = await tx.cell.createMany({
                    data: newRows.flatMap((row, index) => {
                        const data = fakeData[index];
                        return columnIds.map((columnId, colIndex) => {
                            const key = columnNames[colIndex] as keyof DefaultTableData;
                            const cellValue = data ? data[key] ?? "" : "";
                            let stringValue: string | undefined;
                            let numberValue: number | undefined;
                            if (typeof cellValue === "string") {
                                stringValue = cellValue;
                            }
                            else if (typeof cellValue === "number") {
                                numberValue = cellValue;
                            }
                            return {
                                rowId: row.id,
                                columnId: columnId,
                                stringValue: stringValue,
                                numberValue: numberValue
                            };
                        });          
                    }).flat()
                });
                if (!cells) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create batch of cellsS!"})
                }
            }, {
                maxWait: 10000,
                timeout: 20000,
            });
        }
        await ctx.db.table.update({
            where: {
                id: input.tableId
            },
            data: {
                rowCount: {
                    increment: 100000
                }
            }
        })
        return { success: true, message: "100k rows created successfully!" };
    }),
})