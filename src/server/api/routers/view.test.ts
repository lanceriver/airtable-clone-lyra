import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { baseRouter } from "~/server/api/routers/base";
import { viewRouter } from "~/server/api/routers/view";
import { createCallerFactory } from "~/server/api/trpc";
import { createFixture, resetDb, testDb } from "~/test/db";

vi.mock("~/server/auth", () => ({ auth: vi.fn() }));

const ctxFor = (id: string) =>
  ({
    db: testDb,
    session: { user: { id }, expires: "2099-01-01" },
    headers: new Headers(),
  }) as never;
const callerFor = (id: string) => createCallerFactory(viewRouter)(ctxFor(id));

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

const sortIndexes = async (tableId: string) =>
  (
    await testDb.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes WHERE indexname LIKE ${`rs_${tableId}_%`}`
  ).map((r) => r.indexname);

beforeEach(resetDb);

describe("view.list / get", () => {
  it("lists views by createdAt and gets the parsed config", async () => {
    const { owner, base, name } = await setup();
    const caller = callerFor(owner.user.id);
    const v2 = await caller.create({ tableId: base.tableId, name: "Zed" });
    await caller.create({ tableId: base.tableId, name: "Alpha" });
    const list = await caller.list({ tableId: base.tableId });
    expect(list.map((v) => v.name)).toEqual(["Grid view", "Zed", "Alpha"]);
    expect(list[0]).toEqual({ id: base.viewId, name: "Grid view" });

    await testDb.view.update({
      where: { id: v2.id },
      data: {
        filters: [
          { id: "f1", columnId: name.id, operator: "is", value: "x" },
          { bogus: true },
        ],
        sort: { columnId: name.id, direction: "asc" },
        hiddenColumnIds: ["c"],
        search: "hello",
      },
    });
    expect(await caller.get({ viewId: v2.id })).toEqual({
      id: v2.id,
      name: "Zed",
      tableId: base.tableId,
      config: {
        filters: [{ id: "f1", columnId: name.id, operator: "is", value: "x" }],
        sort: { columnId: name.id, direction: "asc" },
        hiddenColumnIds: ["c"],
        search: "hello",
      },
    });
    expect((await caller.get({ viewId: base.viewId })).config).toEqual({
      filters: [],
      sort: null,
      hiddenColumnIds: [],
      search: "",
    });
  });
});

describe("view.create", () => {
  it("defaults to the lowest free Grid view N with default config", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    const a = await caller.create({ tableId: base.tableId });
    const b = await caller.create({ tableId: base.tableId });
    expect([a.name, b.name]).toEqual(["Grid view 1", "Grid view 2"]);
    await caller.delete({ viewId: a.id });
    expect((await caller.create({ tableId: base.tableId })).name).toBe(
      "Grid view 1",
    );
    expect((await caller.get({ viewId: b.id })).config).toEqual({
      filters: [],
      sort: null,
      hiddenColumnIds: [],
      search: "",
    });
  });

  it("rejects duplicate and invalid names", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    await expectCode(
      caller.create({ tableId: base.tableId, name: "Grid view" }),
      "CONFLICT",
    );
    await expectCode(
      caller.create({ tableId: base.tableId, name: "  " }),
      "BAD_REQUEST",
    );
    expect(await testDb.view.count({ where: { tableId: base.tableId } })).toBe(
      1,
    );
  });
});

describe("view.rename", () => {
  it("renames and reports conflicts within the table", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    const v = await caller.create({ tableId: base.tableId, name: "Second" });
    expect(await caller.rename({ viewId: v.id, name: " Third " })).toEqual({
      id: v.id,
      name: "Third",
    });
    await expectCode(
      caller.rename({ viewId: v.id, name: "Grid view" }),
      "CONFLICT",
    );
    await expectCode(
      caller.rename({ viewId: v.id, name: "x".repeat(101) }),
      "BAD_REQUEST",
    );
  });
});

describe("view.delete", () => {
  it("refuses to delete the last view", async () => {
    const { owner, base } = await setup();
    await expectCode(
      callerFor(owner.user.id).delete({ viewId: base.viewId }),
      "BAD_REQUEST",
    );
    expect(await testDb.view.count({ where: { tableId: base.tableId } })).toBe(
      1,
    );
  });

  it("deletes a view and repoints activeViewId", async () => {
    const { owner, base } = await setup();
    const caller = callerFor(owner.user.id);
    const v2 = await caller.create({ tableId: base.tableId, name: "Second" });
    await caller.delete({ viewId: base.viewId });
    const table = await testDb.table.findUniqueOrThrow({
      where: { id: base.tableId },
    });
    expect(table.activeViewId).toBe(v2.id);
    expect(await testDb.view.count({ where: { tableId: base.tableId } })).toBe(
      1,
    );
  });
});

describe("view.updateConfig", () => {
  it("updates only the provided keys and returns the new config", async () => {
    const { owner, base, name, score } = await setup();
    const caller = callerFor(owner.user.id);
    const filters = [
      { id: "f1", columnId: name.id, operator: "contains" as const, value: "" },
      { id: "f2", columnId: score.id, operator: "gte" as const, value: 10 },
    ];
    let config = await caller.updateConfig({ viewId: base.viewId, filters });
    expect(config).toEqual({
      filters,
      sort: null,
      hiddenColumnIds: [],
      search: "",
    });

    config = await caller.updateConfig({ viewId: base.viewId, search: "abc" });
    expect(config).toEqual({
      filters,
      sort: null,
      hiddenColumnIds: [],
      search: "abc",
    });

    config = await caller.updateConfig({
      viewId: base.viewId,
      hiddenColumnIds: [score.id],
    });
    expect(config.filters).toEqual(filters);
    expect(config.search).toBe("abc");
    expect(config.hiddenColumnIds).toEqual([score.id]);

    config = await caller.updateConfig({ viewId: base.viewId, filters: [] });
    expect(config.filters).toEqual([]);
    expect(config.hiddenColumnIds).toEqual([score.id]);

    // An empty update changes nothing.
    expect(await caller.updateConfig({ viewId: base.viewId })).toEqual(config);
    expect((await caller.get({ viewId: base.viewId })).config).toEqual(config);
  });

  it("creates the sort index when a sort is set and clears it with null", async () => {
    const { owner, base, score, name } = await setup();
    const caller = callerFor(owner.user.id);
    expect(await sortIndexes(base.tableId)).toEqual([]);

    const config = await caller.updateConfig({
      viewId: base.viewId,
      sort: { columnId: score.id, direction: "desc" },
    });
    expect(config.sort).toEqual({ columnId: score.id, direction: "desc" });
    expect(await sortIndexes(base.tableId)).toEqual([
      `rs_${base.tableId}_${score.id}_d`,
    ]);

    // Setting it again is idempotent; another column adds another index.
    await caller.updateConfig({
      viewId: base.viewId,
      sort: { columnId: score.id, direction: "desc" },
    });
    await caller.updateConfig({
      viewId: base.viewId,
      sort: { columnId: name.id, direction: "asc" },
    });
    expect((await sortIndexes(base.tableId)).sort()).toEqual(
      [
        `rs_${base.tableId}_${score.id}_d`,
        `rs_${base.tableId}_${name.id}_a`,
      ].sort(),
    );

    const cleared = await caller.updateConfig({
      viewId: base.viewId,
      sort: null,
    });
    expect(cleared.sort).toBeNull();
  });

  it("rejects invalid filters and sorts with BAD_REQUEST", async () => {
    const { owner, base, name, score } = await setup();
    const caller = callerFor(owner.user.id);
    const f = (columnId: string, operator: string) => ({
      id: "f",
      columnId,
      operator: operator as never,
      value: "1",
    });
    await expectCode(
      caller.updateConfig({ viewId: base.viewId, filters: [f("nope", "is")] }),
      "BAD_REQUEST",
    );
    // number operator on a text column, and text operator on a number column
    await expectCode(
      caller.updateConfig({ viewId: base.viewId, filters: [f(name.id, "gt")] }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.updateConfig({
        viewId: base.viewId,
        filters: [f(score.id, "contains")],
      }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.updateConfig({
        viewId: base.viewId,
        filters: [f(name.id, "bogus")],
      }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.updateConfig({
        viewId: base.viewId,
        sort: { columnId: "nope", direction: "asc" },
      }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.updateConfig({
        viewId: base.viewId,
        filters: Array.from({ length: 21 }, () => f(name.id, "is")),
      }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.updateConfig({ viewId: base.viewId, search: "x".repeat(201) }),
      "BAD_REQUEST",
    );
    // A column of another table is unknown, too.
    const foreign = await testDb.column.create({
      data: {
        name: "Foreign",
        type: "string",
        tableId: (
          await testDb.table.create({ data: { name: "T2", baseId: base.id } })
        ).id,
      },
    });
    await expectCode(
      caller.updateConfig({
        viewId: base.viewId,
        sort: { columnId: foreign.id, direction: "asc" },
      }),
      "BAD_REQUEST",
    );
    // Nothing was saved or indexed by the rejected calls.
    expect((await caller.get({ viewId: base.viewId })).config).toEqual({
      filters: [],
      sort: null,
      hiddenColumnIds: [],
      search: "",
    });
    expect(await sortIndexes(base.tableId)).toEqual([]);
  });

  it("silently drops unknown and duplicate hidden column ids", async () => {
    const { owner, base, name, email } = await setup();
    const config = await callerFor(owner.user.id).updateConfig({
      viewId: base.viewId,
      hiddenColumnIds: [name.id, "nope", email.id, name.id],
    });
    expect(config.hiddenColumnIds).toEqual([name.id, email.id]);
  });
});

describe("view ownership", () => {
  it("returns NOT_FOUND for another user's records", async () => {
    const { other, base, name } = await setup();
    const caller = callerFor(other.user.id);
    await expectCode(caller.list({ tableId: base.tableId }), "NOT_FOUND");
    await expectCode(caller.get({ viewId: base.viewId }), "NOT_FOUND");
    await expectCode(caller.create({ tableId: base.tableId }), "NOT_FOUND");
    await expectCode(
      caller.rename({ viewId: base.viewId, name: "x" }),
      "NOT_FOUND",
    );
    await expectCode(caller.delete({ viewId: base.viewId }), "NOT_FOUND");
    await expectCode(
      caller.updateConfig({ viewId: base.viewId, search: "x" }),
      "NOT_FOUND",
    );
    await expectCode(
      caller.updateConfig({
        viewId: base.viewId,
        sort: { columnId: name.id, direction: "asc" },
      }),
      "NOT_FOUND",
    );
    expect(await sortIndexes(base.tableId)).toEqual([]);
    await expectCode(caller.get({ viewId: "nope" }), "NOT_FOUND");
  });
});
