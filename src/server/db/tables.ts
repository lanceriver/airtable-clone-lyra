/**
 * Table-level helpers shared by the base, table and column routers.
 */
import { Prisma, type PrismaClient } from "@prisma/client";

import { insertFakeRows } from "./fakeRows";

type Db = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_VIEW_NAME = "Grid view";
export const DEFAULT_FAKE_ROW_COUNT = 50;
export const DELETE_BATCH_SIZE = 50_000;

const DEFAULT_COLUMNS = [
  { name: "Name", type: "string" },
  { name: "Email", type: "string" },
  { name: "Company", type: "string" },
  { name: "Score", type: "number" },
] as const;

/** Lowest "Table N" not already used in the base. */
export async function nextTableName(db: Db, baseId: string): Promise<string> {
  const tables = await db.table.findMany({
    where: { baseId },
    select: { name: true },
  });
  const taken = new Set(tables.map((t) => t.name));
  let n = 1;
  while (taken.has(`Table ${n}`)) n++;
  return `Table ${n}`;
}

/**
 * Creates a table with the default columns (Name, Email, Company, Score) and a
 * "Grid view" in one transaction, then fills it with 50 fake rows.
 */
export async function createTableWithDefaults(
  db: PrismaClient,
  opts: { baseId: string; name: string },
): Promise<{ table: { id: string; name: string }; viewId: string }> {
  const { table, columns, viewId } = await db.$transaction(async (tx) => {
    const table = await tx.table.create({
      data: { name: opts.name, baseId: opts.baseId },
    });
    const columns = [];
    for (const [order, c] of DEFAULT_COLUMNS.entries()) {
      columns.push(
        await tx.column.create({
          data: { name: c.name, type: c.type, order, tableId: table.id },
          select: { id: true, name: true, type: true },
        }),
      );
    }
    const view = await tx.view.create({
      data: { name: DEFAULT_VIEW_NAME, tableId: table.id },
    });
    await tx.table.update({
      where: { id: table.id },
      data: { activeViewId: view.id },
    });
    return { table, columns, viewId: view.id };
  });

  await insertFakeRows(db, {
    tableId: table.id,
    columns: columns.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type === "number" ? "number" : "string",
    })),
    count: DEFAULT_FAKE_ROW_COUNT,
  });
  return { table: { id: table.id, name: table.name }, viewId };
}

/**
 * Removes a column's key from every row of the table, in batches by `order`
 * range (each batch its own statement, so no long transaction). The UPDATE
 * keeps `search_text` correct through the row trigger.
 */
export async function stripColumnKey(
  db: Db,
  opts: { tableId: string; columnId: string; batchSize?: number },
): Promise<void> {
  const { tableId, columnId } = opts;
  const batchSize = opts.batchSize ?? DELETE_BATCH_SIZE;
  const range = await db.row.aggregate({
    where: { tableId },
    _min: { order: true },
    _max: { order: true },
  });
  const min = range._min.order;
  const max = range._max.order;
  if (min === null || max === null) return;

  for (let lo = min - 1; lo < max; lo += batchSize) {
    const hi = lo + batchSize;
    await db.$executeRaw(
      Prisma.sql`UPDATE "Row" SET "data" = "data" - ${columnId}::text, "updatedAt" = now() WHERE "tableId" = ${tableId} AND "order" > ${lo} AND "order" <= ${hi} AND "data" ? ${columnId}::text`,
    );
  }
}

export function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}
