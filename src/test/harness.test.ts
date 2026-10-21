import { afterAll, beforeEach, expect, test } from "vitest";
import { createFixture, resetDb, testDb } from "./db";

beforeEach(resetDb);
afterAll(() => testDb.$disconnect());

test("trigger maintains search_text", async () => {
  const { table } = await createFixture([{ name: "Name", type: "string" }]);
  const row = await testDb.row.create({
    data: { tableId: table.id, order: 1, data: { a: "Hello", b: 42 } },
  });
  expect(row.searchText).toBe("hello\u001f42");
});
