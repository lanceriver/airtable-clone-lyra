import { PrismaClient } from "@prisma/client";

/** Prisma client bound to the test database (see src/test/setup.ts). */
export const testDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

/** Removes all app data. Call in beforeEach/beforeAll of integration tests. */
export async function resetDb() {
  await testDb.$executeRawUnsafe(
    `TRUNCATE "User", "Base", "Table", "Column", "Row", "views", "Account", "Session" RESTART IDENTITY CASCADE`,
  );
}

let counter = 0;

/** Creates a user, base, table and the given columns. Returns their ids. */
export async function createFixture(
  columns: { name: string; type: "string" | "number" }[] = [],
) {
  const n = ++counter;
  const user = await testDb.user.create({ data: { name: `user${n}` } });
  const base = await testDb.base.create({
    data: { name: `base${n}`, ownerId: user.id },
  });
  const table = await testDb.table.create({
    data: { name: `table${n}`, baseId: base.id },
  });
  const cols = [];
  for (const [i, c] of columns.entries()) {
    cols.push(
      await testDb.column.create({
        data: { name: c.name, type: c.type, tableId: table.id, order: i },
      }),
    );
  }
  return { user, base, table, columns: cols };
}
