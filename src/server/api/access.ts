import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Each helper resolves a record through its ownership chain in a single query.
// Missing and not-owned records are indistinguishable on purpose (NOT_FOUND).

function notFound(what: string): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: `${what} not found` });
}

export async function assertBaseAccess(db: Db, userId: string, baseId: string) {
  const base = await db.base.findFirst({
    where: { id: baseId, ownerId: userId },
  });
  if (!base) throw notFound("Base");
  return base;
}

/** Returns the table with its columns ordered by `order`, then `createdAt`. */
export async function assertTableAccess(
  db: Db,
  userId: string,
  tableId: string,
) {
  const table = await db.table.findFirst({
    where: { id: tableId, base: { ownerId: userId } },
    include: {
      columns: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!table) throw notFound("Table");
  return table;
}

export async function assertColumnAccess(
  db: Db,
  userId: string,
  columnId: string,
) {
  const column = await db.column.findFirst({
    where: { id: columnId, table: { base: { ownerId: userId } } },
  });
  if (!column) throw notFound("Column");
  return column;
}

export async function assertViewAccess(db: Db, userId: string, viewId: string) {
  const view = await db.view.findFirst({
    where: { id: viewId, table: { base: { ownerId: userId } } },
  });
  if (!view) throw notFound("View");
  return view;
}

/** Selects only id and tableId: rows can be large. */
export async function assertRowAccess(db: Db, userId: string, rowId: string) {
  const row = await db.row.findFirst({
    where: { id: rowId, table: { base: { ownerId: userId } } },
    select: { id: true, tableId: true },
  });
  if (!row) throw notFound("Row");
  return row;
}
