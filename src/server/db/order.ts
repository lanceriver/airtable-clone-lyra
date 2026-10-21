import type { Prisma } from "@prisma/client";

/**
 * Takes a transaction-scoped advisory lock for the table and returns the first
 * free `order` value, reserving `count` slots. Must be called inside a
 * transaction: the lock is held until it ends, so concurrent callers on the
 * same table are serialised and never receive overlapping ranges as long as
 * they insert their rows before committing.
 */
export async function allocateOrder(
  tx: Prisma.TransactionClient,
  tableId: string,
  count: number,
): Promise<number> {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`allocateOrder: invalid count ${count}`);
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tableId}))`;
  const rows = await tx.$queryRaw<{ next: number }[]>`
    SELECT coalesce(max("order"), 0) + 1 AS next FROM "Row" WHERE "tableId" = ${tableId}
  `;
  // The slots [next, next + count) are reserved by the held lock.
  return Number(rows[0]?.next ?? 1);
}
