import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { baseRouter } from "~/server/api/routers/base";
import { tableRouter } from "~/server/api/routers/table";
import { createCallerFactory } from "~/server/api/trpc";
import { ensureSortIndex } from "~/server/db/rows";
import { createFixture, resetDb, testDb } from "~/test/db";

vi.mock("~/server/auth", () => ({ auth: vi.fn() }));

const ctxFor = (id: string) =>
  ({
    db: testDb,
    session: { user: { id }, expires: "2099-01-01" },
    headers: new Headers(),
  }) as never;
const callerFor = (id: string) => createCallerFactory(tableRouter)(ctxFor(id));
const baseCallerFor = (id: string) =>
  createCallerFactory(baseRouter)(ctxFor(id));

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(TRPCError);
  expect((err as TRPCError).code).toBe(code);
  return err as TRPCError;
}

async function setup() {
  const owner = await createFixture();
  const other = await createFixture();
  const base = await baseCallerFor(owner.user.id).create({});
  return { owner, other, base };
}

beforeEach(resetDb);

describe("table.create", () => {
  it("defaults the name to the lowest free Table N", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    const t2 = await caller.create({ baseId: base.id });
    expect(t2.name).toBe("Table 2");
    const t3 = await caller.create({ baseId: base.id });
    expect(t3.name).toBe("Table 3");
    await caller.delete({ tableId: t2.id });
    const again = await caller.create({ baseId: base.id });
    expect(again.name).toBe("Table 2");
  });

  it("creates columns, a view, activeViewId and 50 rows", async () => {
    const { owner, base } = await setup();
    const t = await callerFor(owner.user.id).create({
      baseId: base.id,
      name: " Custom ",
    });
    expect(t.name).toBe("Custom");
    const row = await testDb.table.findUniqueOrThrow({
      where: { id: t.id },
      include: { columns: true, views: true },
    });
    expect(row.columns).toHaveLength(4);
    expect(row.views.map((v) => v.id)).toEqual([t.viewId]);
    expect(row.activeViewId).toBe(t.viewId);
    expect(await testDb.row.count({ where: { tableId: t.id } })).toBe(50);
  });

  it("returns CONFLICT for a duplicate name and validates names", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    await expectCode(
      caller.create({ baseId: base.id, name: "Table 1" }),
      "CONFLICT",
    );
    await expectCode(
      caller.create({ baseId: base.id, name: " " }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.create({ baseId: base.id, name: "x".repeat(101) }),
      "BAD_REQUEST",
    );
    expect(await testDb.table.count({ where: { baseId: base.id } })).toBe(1);
  });
});

describe("table.list and table.get", () => {
  it("lists tables by createdAt", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    await caller.create({ baseId: base.id, name: "Zed" });
    await caller.create({ baseId: base.id, name: "Alpha" });
    const list = await caller.list({ baseId: base.id });
    expect(list.map((t) => t.name)).toEqual(["Table 1", "Zed", "Alpha"]);
    expect(list[0]).toEqual({
      id: base.tableId,
      name: "Table 1",
      createdAt: expect.any(Date) as Date,
    });
  });

  it("gets columns ordered and views by createdAt", async () => {
    const { owner, base } = await setup();
    await testDb.view.create({
      data: { name: "Second", tableId: base.tableId },
    });
    const t = await callerFor(owner.user.id).get({ tableId: base.tableId });
    expect(t).toMatchObject({
      id: base.tableId,
      name: "Table 1",
      baseId: base.id,
    });
    expect(t.columns.map((c) => [c.name, c.type, c.order])).toEqual([
      ["Name", "string", 0],
      ["Email", "string", 1],
      ["Company", "string", 2],
      ["Score", "number", 3],
    ]);
    expect(Object.keys(t.columns[0]!).sort()).toEqual([
      "id",
      "name",
      "order",
      "type",
    ]);
    expect(t.views.map((v) => v.name)).toEqual(["Grid view", "Second"]);
  });
});

describe("table.rename", () => {
  it("renames and reports conflicts", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    const t2 = await caller.create({ baseId: base.id });
    expect(
      await caller.rename({ tableId: t2.id, name: " Renamed " }),
    ).toMatchObject({ id: t2.id, name: "Renamed" });
    await expectCode(
      caller.rename({ tableId: t2.id, name: "Table 1" }),
      "CONFLICT",
    );
    await expectCode(
      caller.rename({ tableId: t2.id, name: "" }),
      "BAD_REQUEST",
    );
  });
});

describe("table.delete", () => {
  it("refuses to delete the only table", async () => {
    const { owner, base } = await setup();
    const err = await expectCode(
      callerFor(owner.user.id).delete({ tableId: base.tableId }),
      "BAD_REQUEST",
    );
    expect(err.message).toBe("A base needs at least one table");
    expect(await testDb.table.count({ where: { id: base.tableId } })).toBe(1);
  });

  it("drops the table's sort indexes and cascades", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    const t2 = await caller.create({ baseId: base.id });
    const cols = await testDb.column.findMany({ where: { tableId: t2.id } });
    for (const c of cols.slice(0, 2)) {
      await ensureSortIndex(
        testDb,
        t2.id,
        { id: c.id, type: c.type === "number" ? "number" : "string" },
        "asc",
      );
    }
    // An index of another table must survive.
    const keep = await testDb.column.findFirstOrThrow({
      where: { tableId: base.tableId },
    });
    await ensureSortIndex(
      testDb,
      base.tableId,
      { id: keep.id, type: "string" },
      "desc",
    );

    const count = async (tableId: string) =>
      (
        await testDb.$queryRaw<{ indexname: string }[]>`
          SELECT indexname FROM pg_indexes WHERE indexname LIKE ${`rs_${tableId}_%`}`
      ).length;
    expect(await count(t2.id)).toBe(2);

    await caller.delete({ tableId: t2.id });
    expect(await count(t2.id)).toBe(0);
    expect(await count(base.tableId)).toBe(1);
    expect(await testDb.row.count({ where: { tableId: t2.id } })).toBe(0);
    expect(await testDb.column.count({ where: { tableId: t2.id } })).toBe(0);
    expect(await testDb.view.count({ where: { tableId: t2.id } })).toBe(0);
  });
});

describe("table ownership", () => {
  it("returns NOT_FOUND for another user's records", async () => {
    const { other, base } = await setup();
    const caller = callerFor(other.user.id);
    await expectCode(caller.list({ baseId: base.id }), "NOT_FOUND");
    await expectCode(caller.get({ tableId: base.tableId }), "NOT_FOUND");
    await expectCode(caller.create({ baseId: base.id }), "NOT_FOUND");
    await expectCode(
      caller.rename({ tableId: base.tableId, name: "x" }),
      "NOT_FOUND",
    );
    await expectCode(caller.delete({ tableId: base.tableId }), "NOT_FOUND");
    await expectCode(caller.get({ tableId: "nope" }), "NOT_FOUND");
    expect(await testDb.table.count({ where: { baseId: base.id } })).toBe(1);
  });
});
