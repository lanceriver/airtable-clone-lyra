import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { baseRouter } from "~/server/api/routers/base";
import { columnRouter } from "~/server/api/routers/column";
import { createCallerFactory } from "~/server/api/trpc";
import { ensureSortIndex } from "~/server/db/rows";
import { stripColumnKey } from "~/server/db/tables";
import { createFixture, resetDb, testDb } from "~/test/db";

vi.mock("~/server/auth", () => ({ auth: vi.fn() }));

const ctxFor = (id: string) =>
  ({
    db: testDb,
    session: { user: { id }, expires: "2099-01-01" },
    headers: new Headers(),
  }) as never;
const callerFor = (id: string) => createCallerFactory(columnRouter)(ctxFor(id));

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(TRPCError);
  expect((err as TRPCError).code).toBe(code);
  return err as TRPCError;
}

/** Owner with a default table (Name, Email, Company, Score + 50 rows). */
async function setup() {
  const owner = await createFixture();
  const other = await createFixture();
  const base = await createCallerFactory(baseRouter)(
    ctxFor(owner.user.id),
  ).create({});
  const columns = await testDb.column.findMany({
    where: { tableId: base.tableId },
    orderBy: { order: "asc" },
  });
  const [name, email, company, score] = columns as [
    (typeof columns)[number],
    (typeof columns)[number],
    (typeof columns)[number],
    (typeof columns)[number],
  ];
  return { owner, other, base, name, email, company, score };
}

const indexCount = async (tableId: string, columnId?: string) =>
  (
    await testDb.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE indexname LIKE ${`rs_${tableId}_${columnId ?? ""}%`}`
  ).length;

beforeEach(resetDb);

describe("column.create", () => {
  it("appends a column with order max+1 and writes no rows", async () => {
    const { owner, base } = await setup();
    const before = await testDb.row.findFirstOrThrow({
      where: { tableId: base.tableId },
    });
    const col = await callerFor(owner.user.id).create({
      tableId: base.tableId,
      name: " Notes ",
      type: "string",
    });
    expect(col).toMatchObject({
      name: "Notes",
      type: "string",
      order: 4,
      tableId: base.tableId,
    });
    const after = await testDb.row.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(after.data).toEqual(before.data);
    expect(after.updatedAt).toEqual(before.updatedAt);

    const next = await callerFor(owner.user.id).create({
      tableId: base.tableId,
      name: "Age",
      type: "number",
    });
    expect(next.order).toBe(5);
  });

  it("enforces case-insensitive unique names per table", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    const err = await expectCode(
      caller.create({ tableId: base.tableId, name: "nAmE", type: "string" }),
      "CONFLICT",
    );
    expect(err.message).toBe("A field with this name already exists");
    // Same name in another table is fine.
    const table2 = await testDb.table.create({
      data: { name: "T2", baseId: base.id },
    });
    await caller.create({ tableId: table2.id, name: "Name", type: "string" });
  });

  it("validates input", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    await expectCode(
      caller.create({ tableId: base.tableId, name: "  ", type: "string" }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.create({
        tableId: base.tableId,
        name: "x".repeat(101),
        type: "string",
      }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.create({
        tableId: base.tableId,
        name: "ok",
        type: "date" as never,
      }),
      "BAD_REQUEST",
    );
  });
});

describe("column.rename", () => {
  it("renames, allows changing only the case, and rejects clashes", async () => {
    const { owner, name, email } = await setup();
    const caller = callerFor(owner.user.id);
    expect(
      (await caller.rename({ columnId: name.id, name: "NAME" })).name,
    ).toBe("NAME");
    expect(
      (await caller.rename({ columnId: name.id, name: " Full name " })).name,
    ).toBe("Full name");
    await expectCode(
      caller.rename({ columnId: name.id, name: "EMAIL" }),
      "CONFLICT",
    );
    await expectCode(
      caller.rename({ columnId: email.id, name: "" }),
      "BAD_REQUEST",
    );
  });
});

describe("column.delete", () => {
  it("strips the key from every row, keeps search_text and other keys", async () => {
    const { owner, base, name, email } = await setup();
    await testDb.row.create({
      data: {
        tableId: base.tableId,
        order: 9999,
        data: { [name.id]: "zebraunique", [email.id]: "kept@example.com" },
      },
    });
    const withName = () =>
      testDb.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "Row"
        WHERE "tableId" = ${base.tableId} AND "data" ? ${name.id}::text`;
    expect((await withName())[0]!.n).toBe(51);

    await callerFor(owner.user.id).delete({ columnId: name.id });

    expect((await withName())[0]!.n).toBe(0);
    expect(await testDb.column.count({ where: { id: name.id } })).toBe(0);
    const row = await testDb.row.findFirstOrThrow({
      where: { tableId: base.tableId, order: 9999 },
    });
    expect(row.data).toEqual({ [email.id]: "kept@example.com" });
    expect(row.searchText).not.toContain("zebraunique");
    expect(row.searchText).toContain("kept@example.com");
    expect(await testDb.row.count({ where: { tableId: base.tableId } })).toBe(
      51,
    );
  });

  it("stripColumnKey covers every order across small batches", async () => {
    const { base, name, email } = await setup();
    // Orders 1..50 exist from the defaults; add sparse and distant ones.
    const extra = [51, 52, 120, 121, 122, 400, 999, 1000, 1001];
    for (const order of extra) {
      await testDb.row.create({
        data: {
          tableId: base.tableId,
          order,
          data: { [name.id]: `n${order}`, [email.id]: `e${order}` },
        },
      });
    }
    await stripColumnKey(testDb, {
      tableId: base.tableId,
      columnId: name.id,
      batchSize: 7,
    });
    const left = await testDb.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "Row"
      WHERE "tableId" = ${base.tableId} AND "data" ? ${name.id}::text`;
    expect(left[0]!.n).toBe(0);
    const emails = await testDb.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "Row"
      WHERE "tableId" = ${base.tableId} AND "data" ? ${email.id}::text`;
    expect(emails[0]!.n).toBe(59);
  });

  it("stripColumnKey on an empty table is a no-op", async () => {
    const { owner } = await setup();
    const empty = await testDb.table.create({
      data: {
        name: "Empty",
        baseId: (
          await testDb.base.findFirstOrThrow({
            where: { ownerId: owner.user.id },
          })
        ).id,
      },
    });
    await stripColumnKey(testDb, { tableId: empty.id, columnId: "abc" });
  });

  it("removes the column from views and drops its sort indexes", async () => {
    const { owner, base, name, email, score } = await setup();
    const view = await testDb.view.findFirstOrThrow({
      where: { tableId: base.tableId },
    });
    const untouched = await testDb.view.create({
      data: {
        name: "Untouched",
        tableId: base.tableId,
        filters: [
          { id: "f", columnId: email.id, operator: "contains", value: "a" },
        ],
        sort: { columnId: email.id, direction: "asc" },
        hiddenColumnIds: [email.id],
      },
    });
    await testDb.view.update({
      where: { id: view.id },
      data: {
        filters: [
          { id: "f1", columnId: name.id, operator: "contains", value: "a" },
          { id: "f2", columnId: score.id, operator: "gt", value: 5 },
        ],
        sort: { columnId: name.id, direction: "desc" },
        hiddenColumnIds: [name.id, email.id],
      },
    });
    await ensureSortIndex(
      testDb,
      base.tableId,
      { id: name.id, type: "string" },
      "asc",
    );
    await ensureSortIndex(
      testDb,
      base.tableId,
      { id: name.id, type: "string" },
      "desc",
    );
    await ensureSortIndex(
      testDb,
      base.tableId,
      { id: email.id, type: "string" },
      "asc",
    );
    expect(await indexCount(base.tableId, name.id)).toBe(2);

    await callerFor(owner.user.id).delete({ columnId: name.id });

    const after = await testDb.view.findUniqueOrThrow({
      where: { id: view.id },
    });
    expect(after.filters).toEqual([
      { id: "f2", columnId: score.id, operator: "gt", value: 5 },
    ]);
    expect(after.sort).toBeNull();
    expect(after.hiddenColumnIds).toEqual([email.id]);
    const same = await testDb.view.findUniqueOrThrow({
      where: { id: untouched.id },
    });
    expect(same.filters).toEqual(untouched.filters);
    expect(same.sort).toEqual(untouched.sort);
    expect(same.hiddenColumnIds).toEqual([email.id]);

    expect(await indexCount(base.tableId, name.id)).toBe(0);
    expect(await indexCount(base.tableId, email.id)).toBe(1);
  });

  it("keeps a sort on another column", async () => {
    const { owner, base, name, email } = await setup();
    const view = await testDb.view.findFirstOrThrow({
      where: { tableId: base.tableId },
    });
    await testDb.view.update({
      where: { id: view.id },
      data: { sort: { columnId: email.id, direction: "asc" } },
    });
    await callerFor(owner.user.id).delete({ columnId: name.id });
    const after = await testDb.view.findUniqueOrThrow({
      where: { id: view.id },
    });
    expect(after.sort).toEqual({ columnId: email.id, direction: "asc" });
  });

  it("refuses to delete the last column", async () => {
    const { owner } = await setup();
    const t = await testDb.table.create({
      data: {
        name: "Solo",
        baseId: (
          await testDb.base.findFirstOrThrow({
            where: { ownerId: owner.user.id },
          })
        ).id,
      },
    });
    const only = await testDb.column.create({
      data: { name: "Only", type: "string", tableId: t.id },
    });
    await expectCode(
      callerFor(owner.user.id).delete({ columnId: only.id }),
      "BAD_REQUEST",
    );
    expect(await testDb.column.count({ where: { id: only.id } })).toBe(1);
  });
});

describe("column ownership", () => {
  it("returns NOT_FOUND for another user's records", async () => {
    const { other, base, name } = await setup();
    const caller = callerFor(other.user.id);
    await expectCode(
      caller.create({ tableId: base.tableId, name: "x", type: "string" }),
      "NOT_FOUND",
    );
    await expectCode(
      caller.rename({ columnId: name.id, name: "x" }),
      "NOT_FOUND",
    );
    await expectCode(caller.delete({ columnId: name.id }), "NOT_FOUND");
    await expectCode(caller.delete({ columnId: "nope" }), "NOT_FOUND");
    expect(
      await testDb.column.count({ where: { tableId: base.tableId } }),
    ).toBe(4);
    expect(
      await testDb.row.count({
        where: { tableId: base.tableId },
      }),
    ).toBe(50);
  });
});
