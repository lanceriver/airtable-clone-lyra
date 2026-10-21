import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rowRouter } from "~/server/api/routers/row";
import { createCallerFactory } from "~/server/api/trpc";
import type { RowCursor } from "~/server/db/rows";
import { createFixture, resetDb, testDb } from "~/test/db";

vi.mock("~/server/auth", () => ({ auth: vi.fn() }));

const callerFor = (id: string) =>
  createCallerFactory(rowRouter)({
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

/** Owner fixture: Name (text) + Score (number), a view and 6 rows. */
async function setup(
  view: { filters?: unknown; sort?: unknown; search?: string } = {},
) {
  const owner = await createFixture([
    { name: "Name", type: "string" },
    { name: "Score", type: "number" },
  ]);
  const other = await createFixture([{ name: "Name", type: "string" }]);
  const [name, score] = owner.columns as [
    (typeof owner.columns)[number],
    (typeof owner.columns)[number],
  ];
  const v = await testDb.view.create({
    data: {
      name: "Grid view",
      tableId: owner.table.id,
      filters: (view.filters ?? []) as never,
      sort: (view.sort ?? undefined) as never,
      search: view.search ?? "",
    },
  });
  const people: [string, number][] = [
    ["Alice", 30],
    ["Bob", 10],
    ["Carol", 20],
    ["Dave", 40],
    ["Eve", 50],
    ["alan", 5],
  ];
  for (const [i, [n, s]] of people.entries()) {
    await testDb.row.create({
      data: {
        tableId: owner.table.id,
        order: i + 1,
        data: { [name.id]: n, [score.id]: s },
      },
    });
  }
  const ownerView = v;
  return { owner, other, name, score, view: ownerView };
}

const names = (rows: { data: Record<string, string | number> }[], id: string) =>
  rows.map((r) => r.data[id]);

beforeEach(resetDb);

describe("getRows", () => {
  it("returns rows in order with no config", async () => {
    const { owner, name, view } = await setup();
    const res = await callerFor(owner.user.id).getRows({ viewId: view.id });
    expect(names(res.rows, name.id)).toEqual([
      "Alice",
      "Bob",
      "Carol",
      "Dave",
      "Eve",
      "alan",
    ]);
    expect(res.nextCursor).toBeNull();
  });

  it("applies the saved filters and sort", async () => {
    const owner = await setup();
    const view = await testDb.view.create({
      data: {
        name: "Filtered",
        tableId: owner.owner.table.id,
        filters: [
          { id: "f1", columnId: owner.score.id, operator: "gte", value: 20 },
          {
            id: "f2",
            columnId: owner.name.id,
            operator: "isNot",
            value: "dave",
          },
          { nope: true },
        ],
        sort: { columnId: owner.score.id, direction: "desc" },
      },
    });
    const res = await callerFor(owner.owner.user.id).getRows({
      viewId: view.id,
    });
    expect(names(res.rows, owner.name.id)).toEqual(["Eve", "Alice", "Carol"]);
  });

  it("uses the saved search, and the search input overrides it", async () => {
    const { owner, name, view } = await setup({ search: "bob" });
    const caller = callerFor(owner.user.id);
    const saved = await caller.getRows({ viewId: view.id });
    expect(names(saved.rows, name.id)).toEqual(["Bob"]);
    const override = await caller.getRows({ viewId: view.id, search: "al" });
    expect(names(override.rows, name.id)).toEqual(["Alice", "alan"]);
    const cleared = await caller.getRows({ viewId: view.id, search: "" });
    expect(cleared.rows).toHaveLength(6);
  });

  it("paginates with nextCursor and returns every row once", async () => {
    const { owner, name, score, view } = await setup();
    const caller = callerFor(owner.user.id);
    for (const sortColumn of [null, score.id, name.id]) {
      await testDb.view.update({
        where: { id: view.id },
        data: {
          sort: sortColumn
            ? { columnId: sortColumn, direction: "desc" }
            : Prisma.JsonNull,
        },
      });
      const seen: unknown[] = [];
      let cursor: RowCursor | null = null;
      let pages = 0;
      do {
        const res: Awaited<ReturnType<typeof caller.getRows>> =
          await caller.getRows({ viewId: view.id, limit: 4, cursor });
        seen.push(...names(res.rows, name.id));
        cursor = res.nextCursor;
        pages++;
      } while (cursor && pages < 10);
      expect(pages).toBe(2);
      expect(seen).toHaveLength(6);
      expect(new Set(seen).size).toBe(6);
    }
  });

  it("serves offset pages equal to keyset pages, and continues by keyset", async () => {
    const { owner, name, score, view } = await setup();
    const caller = callerFor(owner.user.id);
    for (const sortColumn of [null, score.id, name.id]) {
      await testDb.view.update({
        where: { id: view.id },
        data: {
          sort: sortColumn
            ? { columnId: sortColumn, direction: "desc" }
            : Prisma.JsonNull,
        },
      });
      const all = await caller.getRows({ viewId: view.id, limit: 500 });
      expect(all.rows).toHaveLength(6);
      for (const limit of [1, 2, 4]) {
        for (let k = 0; k * limit < 6; k++) {
          const jumped = await caller.getRows({
            viewId: view.id,
            limit,
            offset: k * limit,
          });
          expect(jumped.rows).toEqual(
            all.rows.slice(k * limit, (k + 1) * limit),
          );
          const last = (k + 1) * limit >= 6;
          expect(jumped.nextCursor === null).toBe(last);
          if (jumped.nextCursor) {
            const next = await caller.getRows({
              viewId: view.id,
              limit,
              cursor: jumped.nextCursor,
            });
            expect(next.rows).toEqual(
              all.rows.slice((k + 1) * limit, (k + 2) * limit),
            );
          }
        }
      }
      const beyond = await caller.getRows({ viewId: view.id, offset: 6 });
      expect(beyond).toEqual({ rows: [], nextCursor: null });
    }
  });

  it("applies filters and search to offset pages", async () => {
    const { owner, name, view } = await setup();
    const caller = callerFor(owner.user.id);
    // "a" matches Alice, Carol, Dave, alan (in row order).
    const res = await caller.getRows({
      viewId: view.id,
      search: "a",
      limit: 2,
      offset: 2,
    });
    expect(names(res.rows, name.id)).toEqual(["Dave", "alan"]);
    expect(res.nextCursor).toBeNull();
  });

  it("rejects cursor together with offset as BAD_REQUEST", async () => {
    const { owner, view } = await setup();
    const caller = callerFor(owner.user.id);
    const page = await caller.getRows({ viewId: view.id, limit: 2 });
    expect(page.nextCursor).not.toBeNull();
    await expectCode(
      caller.getRows({
        viewId: view.id,
        limit: 2,
        cursor: page.nextCursor,
        offset: 2,
      }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.getRows({
        viewId: view.id,
        cursor: { key: "0abc", id: "x" },
        offset: 0,
      }),
      "BAD_REQUEST",
    );
    // A null cursor is the same as none.
    const ok = await caller.getRows({
      viewId: view.id,
      limit: 2,
      cursor: null,
      offset: 2,
    });
    expect(ok.rows).toHaveLength(2);
  });

  it("rejects an invalid offset", async () => {
    const { owner, view } = await setup();
    const caller = callerFor(owner.user.id);
    for (const offset of [-1, 1.5, 10_000_001]) {
      await expectCode(
        caller.getRows({ viewId: view.id, offset }),
        "BAD_REQUEST",
      );
    }
    const max = await caller.getRows({ viewId: view.id, offset: 10_000_000 });
    expect(max.rows).toEqual([]);
  });

  it("rejects an out-of-range limit", async () => {
    const { owner, view } = await setup();
    await expectCode(
      callerFor(owner.user.id).getRows({ viewId: view.id, limit: 501 }),
      "BAD_REQUEST",
    );
  });
});

describe("countRows", () => {
  it("returns the filtered count and the table total", async () => {
    const { owner, score, view } = await setup();
    const caller = callerFor(owner.user.id);
    expect(await caller.countRows({ viewId: view.id })).toEqual({
      count: 6,
      total: 6,
    });
    expect(await caller.countRows({ viewId: view.id, search: "al" })).toEqual({
      count: 2,
      total: 6,
    });
    await testDb.view.update({
      where: { id: view.id },
      data: {
        filters: [{ id: "f", columnId: score.id, operator: "gt", value: 25 }],
      },
    });
    expect(await caller.countRows({ viewId: view.id })).toEqual({
      count: 3,
      total: 6,
    });
  });
});

describe("createRow", () => {
  it("appends rows with increasing order and normalized data", async () => {
    const { owner, name, score } = await setup();
    const caller = callerFor(owner.user.id);
    const a = await caller.createRow({
      tableId: owner.table.id,
      data: { [name.id]: "Zed", [score.id]: " 7 " },
    });
    expect(a.order).toBe(7);
    expect(a.data).toEqual({ [name.id]: "Zed", [score.id]: 7 });
    const b = await caller.createRow({
      tableId: owner.table.id,
      data: { [name.id]: "", [score.id]: "" },
    });
    expect(b.order).toBe(8);
    expect(b.data).toEqual({});
    const c = await caller.createRow({ tableId: owner.table.id });
    expect(c.order).toBe(9);
    const stored = await testDb.row.findUniqueOrThrow({ where: { id: a.id } });
    expect(stored.data).toEqual(a.data);
    expect(stored.searchText).toContain("zed");
  });

  it("rejects unknown columns and bad numbers", async () => {
    const { owner, other, score } = await setup();
    const caller = callerFor(owner.user.id);
    await expectCode(
      caller.createRow({
        tableId: owner.table.id,
        data: { [other.columns[0]!.id]: "x" },
      }),
      "BAD_REQUEST",
    );
    await expectCode(
      caller.createRow({
        tableId: owner.table.id,
        data: { [score.id]: "abc" },
      }),
      "BAD_REQUEST",
    );
    expect(await testDb.row.count({ where: { tableId: owner.table.id } })).toBe(
      6,
    );
  });
});

describe("updateCell", () => {
  it("sets, clears and converts values", async () => {
    const { owner, name, score } = await setup();
    const caller = callerFor(owner.user.id);
    const row = await testDb.row.findFirstOrThrow({
      where: { tableId: owner.table.id, order: 1 },
    });

    const set = await caller.updateCell({
      rowId: row.id,
      columnId: name.id,
      value: "  Zelda  ",
    });
    expect(set.data[name.id]).toBe("  Zelda  ");
    expect(set.order).toBe(1);
    let stored = await testDb.row.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.searchText).toContain("zelda");
    expect(stored.searchText).not.toContain("alice");

    const num = await caller.updateCell({
      rowId: row.id,
      columnId: score.id,
      value: " 12.5 ",
    });
    expect(num.data[score.id]).toBe(12.5);

    const text = await caller.updateCell({
      rowId: row.id,
      columnId: name.id,
      value: 42,
    });
    expect(text.data[name.id]).toBe("42");

    const cleared = await caller.updateCell({
      rowId: row.id,
      columnId: name.id,
      value: "",
    });
    expect(cleared.data).toEqual({ [score.id]: 12.5 });
    const nulled = await caller.updateCell({
      rowId: row.id,
      columnId: score.id,
      value: null,
    });
    expect(nulled.data).toEqual({});
    stored = await testDb.row.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.data).toEqual({});
    expect(stored.searchText).toBe("");
  });

  it("rejects a non-numeric value for a number column", async () => {
    const { owner, score } = await setup();
    const row = await testDb.row.findFirstOrThrow({
      where: { tableId: owner.table.id, order: 1 },
    });
    const caller = callerFor(owner.user.id);
    for (const value of ["abc", "Infinity", "1e999"]) {
      await expectCode(
        caller.updateCell({ rowId: row.id, columnId: score.id, value }),
        "BAD_REQUEST",
      );
    }
    const after = await testDb.row.findUniqueOrThrow({ where: { id: row.id } });
    expect((after.data as Record<string, unknown>)[score.id]).toBe(30);
  });

  it("rejects a column from another table", async () => {
    const { owner, other } = await setup();
    const row = await testDb.row.findFirstOrThrow({
      where: { tableId: owner.table.id },
    });
    await expectCode(
      callerFor(owner.user.id).updateCell({
        rowId: row.id,
        columnId: other.columns[0]!.id,
        value: "x",
      }),
      "NOT_FOUND",
    );
  });
});

describe("deleteRows", () => {
  it("only deletes rows of the given table", async () => {
    const { owner, other } = await setup();
    const otherRow = await testDb.row.create({
      data: { tableId: other.table.id, order: 1, data: {} },
    });
    const mine = await testDb.row.findMany({
      where: { tableId: owner.table.id },
      orderBy: { order: "asc" },
      take: 2,
    });
    const res = await callerFor(owner.user.id).deleteRows({
      tableId: owner.table.id,
      rowIds: [...mine.map((r) => r.id), otherRow.id, "missing"],
    });
    expect(res).toEqual({ deleted: 2 });
    expect(await testDb.row.count({ where: { tableId: owner.table.id } })).toBe(
      4,
    );
    expect(
      await testDb.row.findUnique({ where: { id: otherRow.id } }),
    ).not.toBeNull();
  });

  it("validates the id list size", async () => {
    const { owner } = await setup();
    await expectCode(
      callerFor(owner.user.id).deleteRows({
        tableId: owner.table.id,
        rowIds: [],
      }),
      "BAD_REQUEST",
    );
  });
});

describe("addFakeRows", () => {
  it("inserts the requested number of rows after the existing ones", async () => {
    const { owner, name } = await setup();
    const res = await callerFor(owner.user.id).addFakeRows({
      tableId: owner.table.id,
      count: 500,
    });
    expect(res).toEqual({ inserted: 500 });
    expect(await testDb.row.count({ where: { tableId: owner.table.id } })).toBe(
      506,
    );
    const max = await testDb.row.aggregate({
      where: { tableId: owner.table.id },
      _max: { order: true },
    });
    expect(max._max.order).toBe(506);
    const sample = await testDb.row.findFirstOrThrow({
      where: { tableId: owner.table.id, order: 506 },
    });
    expect(typeof (sample.data as Record<string, unknown>)[name.id]).toBe(
      "string",
    );
  });

  it("rejects a count above 100000", async () => {
    const { owner } = await setup();
    await expectCode(
      callerFor(owner.user.id).addFakeRows({
        tableId: owner.table.id,
        count: 100_001,
      }),
      "BAD_REQUEST",
    );
  });
});

describe("access control", () => {
  it("returns NOT_FOUND for another user's view, table and row", async () => {
    const { owner, other, name, view } = await setup();
    const row = await testDb.row.findFirstOrThrow({
      where: { tableId: owner.table.id },
    });
    const intruder = callerFor(other.user.id);
    await expectCode(intruder.getRows({ viewId: view.id }), "NOT_FOUND");
    await expectCode(intruder.countRows({ viewId: view.id }), "NOT_FOUND");
    await expectCode(
      intruder.createRow({ tableId: owner.table.id }),
      "NOT_FOUND",
    );
    await expectCode(
      intruder.deleteRows({ tableId: owner.table.id, rowIds: [row.id] }),
      "NOT_FOUND",
    );
    await expectCode(
      intruder.updateCell({ rowId: row.id, columnId: name.id, value: "x" }),
      "NOT_FOUND",
    );
    await expectCode(
      intruder.addFakeRows({ tableId: owner.table.id, count: 1 }),
      "NOT_FOUND",
    );
    expect(await testDb.row.count({ where: { tableId: owner.table.id } })).toBe(
      6,
    );
  });

  it("returns NOT_FOUND for nonexistent ids", async () => {
    const { owner } = await setup();
    const caller = callerFor(owner.user.id);
    await expectCode(caller.getRows({ viewId: "nope" }), "NOT_FOUND");
    await expectCode(
      caller.updateCell({ rowId: "nope", columnId: "x", value: 1 }),
      "NOT_FOUND",
    );
  });
});
