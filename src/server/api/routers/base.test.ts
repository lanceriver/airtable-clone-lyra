import { describe, expect, it, beforeEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

import { baseRouter } from "~/server/api/routers/base";
import { createCallerFactory } from "~/server/api/trpc";
import { ensureSortIndex } from "~/server/db/rows";
import { createFixture, resetDb, testDb } from "~/test/db";

vi.mock("~/server/auth", () => ({ auth: vi.fn() }));

const callerFor = (id: string) =>
  createCallerFactory(baseRouter)({
    db: testDb,
    session: { user: { id }, expires: "2099-01-01" },
    headers: new Headers(),
  } as never);

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(TRPCError);
  expect((err as TRPCError).code).toBe(code);
}

beforeEach(resetDb);

describe("base.create", () => {
  it("creates the base, a default table, view, columns and 50 rows", async () => {
    const { user } = await createFixture();
    const res = await callerFor(user.id).create({ name: "  My base " });
    expect(res.name).toBe("My base");

    const table = await testDb.table.findUniqueOrThrow({
      where: { id: res.tableId },
      include: { columns: { orderBy: { order: "asc" } }, views: true },
    });
    expect(table.baseId).toBe(res.id);
    expect(table.name).toBe("Table 1");
    expect(table.activeViewId).toBe(res.viewId);
    expect(table.columns.map((c) => [c.name, c.type, c.order])).toEqual([
      ["Name", "string", 0],
      ["Email", "string", 1],
      ["Company", "string", 2],
      ["Score", "number", 3],
    ]);
    expect(table.views.map((v) => [v.id, v.name])).toEqual([
      [res.viewId, "Grid view"],
    ]);
    expect(await testDb.row.count({ where: { tableId: table.id } })).toBe(50);
    const row = await testDb.row.findFirstOrThrow({
      where: { tableId: table.id },
    });
    const data = row.data as Record<string, unknown>;
    const [name, , , score] = table.columns;
    expect(typeof data[name!.id]).toBe("string");
    expect(typeof data[score!.id]).toBe("number");
  });

  it("defaults the name to Untitled Base", async () => {
    const { user } = await createFixture();
    const res = await callerFor(user.id).create({});
    expect(res.name).toBe("Untitled Base");
  });

  it("rejects empty and over-long names", async () => {
    const { user } = await createFixture();
    const caller = callerFor(user.id);
    await expectCode(caller.create({ name: "   " }), "BAD_REQUEST");
    await expectCode(caller.create({ name: "x".repeat(101) }), "BAD_REQUEST");
  });
});

describe("base.list", () => {
  it("returns the user's bases with their first table and view", async () => {
    const a = await createFixture();
    const b = await createFixture();
    const caller = callerFor(a.user.id);
    const first = await caller.create({ name: "First" });
    const second = await caller.create({ name: "Second" });
    // A later table and view must not change the "first" pointers.
    const extra = await testDb.table.create({
      data: { name: "Table 2", baseId: first.id },
    });
    await testDb.view.create({ data: { name: "Other", tableId: extra.id } });

    const list = await caller.list();
    // a.base is the fixture base: one table without any view.
    expect(list.map((x) => x.name)).toEqual([a.base.name, "First", "Second"]);
    expect(list[0]).toMatchObject({
      firstTableId: a.table.id,
      firstViewId: null,
    });
    expect(list[1]).toMatchObject({
      id: first.id,
      firstTableId: first.tableId,
      firstViewId: first.viewId,
    });
    expect(list[2]).toMatchObject({
      firstTableId: second.tableId,
      firstViewId: second.viewId,
    });
    expect(list[1]!.createdAt).toBeInstanceOf(Date);
    expect(list[1]!.updatedAt).toBeInstanceOf(Date);

    expect((await callerFor(b.user.id).list()).map((x) => x.id)).toEqual([
      b.base.id,
    ]);
  });
});

describe("base.delete", () => {
  it("drops the sort indexes of all its tables and cascades", async () => {
    const { user } = await createFixture();
    const caller = callerFor(user.id);
    const base = await caller.create({});
    const col = await testDb.column.findFirstOrThrow({
      where: { tableId: base.tableId, name: "Score" },
    });
    await ensureSortIndex(
      testDb,
      base.tableId,
      { id: col.id, type: "number" },
      "asc",
    );
    const indexes = () =>
      testDb.$queryRaw<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes WHERE indexname LIKE ${`rs_${base.tableId}_%`}`;
    expect(await indexes()).toHaveLength(1);

    await caller.delete({ baseId: base.id });
    expect(await indexes()).toHaveLength(0);
    expect(await testDb.table.count({ where: { id: base.tableId } })).toBe(0);
    expect(await testDb.row.count({ where: { tableId: base.tableId } })).toBe(
      0,
    );
  });
});
