import { Prisma } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";

import { createFixture, resetDb, testDb } from "~/test/db";
import {
  assertSafeId,
  buildRowsQuery,
  countRows,
  dropSortIndexes,
  ensureSortIndex,
  queryRows,
  sortIndexName,
  type ColumnInfo,
  type RowCursor,
  type RowQuery,
  type ViewFilter,
  type ViewSort,
} from "./rows";

let filterSeq = 0;
function f(
  columnId: string,
  operator: ViewFilter["operator"],
  value?: string | number | null,
): ViewFilter {
  return { id: `f${++filterSeq}`, columnId, operator, value };
}

type Data = Record<string, string | number>;

async function insertRows(
  tableId: string,
  rows: { id: string; order: number; data: Data }[],
) {
  await testDb.row.createMany({
    data: rows.map((r) => ({ ...r, tableId })),
  });
}

async function indexNames(tableId: string): Promise<string[]> {
  const rows = await testDb.$queryRaw<{ indexname: string }[]>(
    Prisma.sql`SELECT indexname FROM pg_indexes WHERE tablename = 'Row' AND indexname LIKE 'rs\\_%' ORDER BY indexname`,
  );
  return rows.map((r) => r.indexname).filter((n) => n.includes(tableId));
}

/** Walks every page of a query and returns the concatenated ids. */
async function walk(
  q: RowQuery,
  limit: number,
): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let cursor: RowCursor | null = null;
  let pages = 0;
  do {
    const res: Awaited<ReturnType<typeof queryRows>> = await queryRows(testDb, {
      ...q,
      limit,
      cursor,
    });
    ids.push(...res.rows.map((r) => r.id));
    cursor = res.nextCursor;
    pages++;
    if (pages > 10_000) throw new Error("pagination did not terminate");
  } while (cursor);
  return { ids, pages };
}

// ---------------------------------------------------------------------------
describe("assertSafeId", () => {
  it("accepts lowercase alphanumeric ids and returns them", () => {
    expect(assertSafeId("abc123")).toBe("abc123");
    expect(assertSafeId("a".repeat(40))).toBe("a".repeat(40));
  });

  it("rejects anything else", () => {
    for (const bad of [
      "t1'; drop table x; --",
      "ABC",
      "",
      "a-b",
      "a_b",
      "a b",
      "a".repeat(41),
      '"',
    ]) {
      expect(() => assertSafeId(bad)).toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
describe("filters and search", () => {
  let tableId: string;
  let name: string;
  let score: string;
  let note: string;
  let columns: ColumnInfo[];

  beforeAll(async () => {
    await resetDb();
    const fx = await createFixture([
      { name: "Name", type: "string" },
      { name: "Score", type: "number" },
      { name: "Note", type: "string" },
    ]);
    tableId = fx.table.id;
    name = fx.columns[0]!.id;
    score = fx.columns[1]!.id;
    note = fx.columns[2]!.id;
    columns = [
      { id: name, type: "string" },
      { id: score, type: "number" },
      { id: note, type: "string" },
    ];
    await insertRows(tableId, [
      { id: "r01", order: 1, data: { [name]: "Alice Smith", [score]: 10 } },
      { id: "r02", order: 2, data: { [name]: "alice", [score]: 20 } },
      { id: "r03", order: 3, data: { [name]: "Bob", [score]: 5.5 } },
      { id: "r04", order: 4, data: {} },
      { id: "r05", order: 5, data: { [name]: "50% off", [score]: -3 } },
      { id: "r06", order: 6, data: { [name]: "a_b" } },
      { id: "r07", order: 7, data: { [name]: "axb", [score]: 20 } },
      { id: "r08", order: 8, data: { [score]: 0 } },
      { id: "r09", order: 9, data: { [name]: "c:\\dir" } },
      { id: "r10", order: 10, data: { [name]: "ab", [note]: "cd" } },
    ]);
  });

  async function ids(
    filters: ViewFilter[] = [],
    extra: Partial<RowQuery> = {},
  ): Promise<string[]> {
    const res = await queryRows(testDb, {
      tableId,
      columns,
      filters,
      limit: 500,
      ...extra,
    });
    return res.rows.map((r) => r.id);
  }

  const ALL = [
    "r01",
    "r02",
    "r03",
    "r04",
    "r05",
    "r06",
    "r07",
    "r08",
    "r09",
    "r10",
  ];
  const except = (...x: string[]) => ALL.filter((i) => !x.includes(i));

  it("returns id, order and parsed data", async () => {
    const res = await queryRows(testDb, { tableId, columns, limit: 2 });
    expect(res.rows).toEqual([
      { id: "r01", order: 1, data: { [name]: "Alice Smith", [score]: 10 } },
      { id: "r02", order: 2, data: { [name]: "alice", [score]: 20 } },
    ]);
    expect(res.nextCursor).toEqual({ order: 2, id: "r02" });
  });

  describe("text operators", () => {
    it("contains is case-insensitive substring", async () => {
      expect(await ids([f(name, "contains", "ALICE")])).toEqual(["r01", "r02"]);
      expect(await ids([f(name, "contains", "smith")])).toEqual(["r01"]);
    });

    it("contains does not treat % _ \\ as wildcards", async () => {
      expect(await ids([f(name, "contains", "50%")])).toEqual(["r05"]);
      expect(await ids([f(name, "contains", "%")])).toEqual(["r05"]);
      expect(await ids([f(name, "contains", "a_b")])).toEqual(["r06"]);
      expect(await ids([f(name, "contains", "_")])).toEqual(["r06"]);
      expect(await ids([f(name, "contains", "\\")])).toEqual(["r09"]);
      expect(await ids([f(name, "contains", "c:\\d")])).toEqual(["r09"]);
    });

    it("notContains matches empty cells", async () => {
      expect(await ids([f(name, "notContains", "alice")])).toEqual(
        except("r01", "r02"),
      );
      expect(await ids([f(name, "notContains", "a_b")])).toEqual(except("r06"));
    });

    it("is is exact and case-insensitive", async () => {
      expect(await ids([f(name, "is", "ALICE")])).toEqual(["r02"]);
      expect(await ids([f(name, "is", "alice smith")])).toEqual(["r01"]);
      expect(await ids([f(name, "is", "ali")])).toEqual([]);
    });

    it("isNot matches empty cells", async () => {
      expect(await ids([f(name, "isNot", "Alice")])).toEqual(except("r02"));
    });

    it("isEmpty / isNotEmpty", async () => {
      expect(await ids([f(name, "isEmpty")])).toEqual(["r04", "r08"]);
      expect(await ids([f(name, "isNotEmpty")])).toEqual(except("r04", "r08"));
    });
  });

  describe("number operators", () => {
    it("eq", async () => {
      expect(await ids([f(score, "eq", 20)])).toEqual(["r02", "r07"]);
      expect(await ids([f(score, "eq", "20")])).toEqual(["r02", "r07"]);
      expect(await ids([f(score, "eq", " 20 ")])).toEqual(["r02", "r07"]);
      expect(await ids([f(score, "eq", 5.5)])).toEqual(["r03"]);
    });

    it("zero is a real value, not empty", async () => {
      expect(await ids([f(score, "eq", 0)])).toEqual(["r08"]);
      expect(await ids([f(score, "eq", "0")])).toEqual(["r08"]);
    });

    it("neq matches empty cells", async () => {
      expect(await ids([f(score, "neq", 20)])).toEqual(except("r02", "r07"));
    });

    it("gt / lt / gte / lte", async () => {
      expect(await ids([f(score, "gt", 5.5)])).toEqual(["r01", "r02", "r07"]);
      expect(await ids([f(score, "lt", 5.5)])).toEqual(["r05", "r08"]);
      expect(await ids([f(score, "gte", 5.5)])).toEqual([
        "r01",
        "r02",
        "r03",
        "r07",
      ]);
      expect(await ids([f(score, "lte", 5.5)])).toEqual(["r03", "r05", "r08"]);
      expect(await ids([f(score, "lt", -1)])).toEqual(["r05"]);
    });

    it("empty cells never satisfy gt / lt / eq", async () => {
      const lt = await ids([f(score, "lt", 1000)]);
      expect(lt).not.toContain("r04");
      expect(lt).toHaveLength(6);
    });

    it("isEmpty / isNotEmpty", async () => {
      expect(await ids([f(score, "isEmpty")])).toEqual([
        "r04",
        "r06",
        "r09",
        "r10",
      ]);
      expect(await ids([f(score, "isNotEmpty")])).toEqual([
        "r01",
        "r02",
        "r03",
        "r05",
        "r07",
        "r08",
      ]);
    });
  });

  it("combines filters with AND", async () => {
    expect(await ids([f(name, "contains", "a"), f(score, "eq", 20)])).toEqual([
      "r02",
      "r07",
    ]);
    expect(
      await ids([f(name, "contains", "alice"), f(score, "gt", 10)]),
    ).toEqual(["r02"]);
  });

  describe("ignored filters", () => {
    it("unknown column", async () => {
      expect(await ids([f("deletedcolumn", "contains", "x")])).toEqual(ALL);
      expect(await ids([f("deletedcolumn", "isEmpty")])).toEqual(ALL);
    });

    it("operator invalid for the column type", async () => {
      expect(await ids([f(score, "contains", "1")])).toEqual(ALL);
      expect(await ids([f(score, "is", "1")])).toEqual(ALL);
      expect(await ids([f(name, "gt", 1)])).toEqual(ALL);
      expect(await ids([f(name, "eq", "alice")])).toEqual(ALL);
    });

    it("missing value", async () => {
      expect(await ids([f(name, "contains", "")])).toEqual(ALL);
      expect(await ids([f(name, "contains", null)])).toEqual(ALL);
      expect(await ids([f(name, "isNot")])).toEqual(ALL);
      expect(await ids([f(score, "gt", "")])).toEqual(ALL);
      expect(await ids([f(score, "eq", null)])).toEqual(ALL);
    });

    it("non-numeric value for a number filter", async () => {
      expect(await ids([f(score, "eq", "abc")])).toEqual(ALL);
      expect(await ids([f(score, "gt", "  ")])).toEqual(ALL);
      expect(await ids([f(score, "lt", "1e999")])).toEqual(ALL);
      expect(await ids([f(score, "lt", Infinity)])).toEqual(ALL);
      expect(await ids([f(score, "lt", NaN)])).toEqual(ALL);
    });

    it("ignored filters do not affect valid ones", async () => {
      expect(
        await ids([
          f("deletedcolumn", "contains", "x"),
          f(score, "contains", "x"),
          f(name, "is", "alice"),
        ]),
      ).toEqual(["r02"]);
    });

    it("unknown sort column is ignored", async () => {
      const res = await queryRows(testDb, {
        tableId,
        columns,
        sort: { columnId: "deletedcolumn", direction: "desc" },
        limit: 3,
      });
      expect(res.rows.map((r) => r.id)).toEqual(["r01", "r02", "r03"]);
      expect(res.nextCursor).toEqual({ order: 3, id: "r03" });
    });
  });

  describe("search", () => {
    it("matches any cell, case-insensitively", async () => {
      expect(await ids([], { search: "alice" })).toEqual(["r01", "r02"]);
      expect(await ids([], { search: "ALICE SMI" })).toEqual(["r01"]);
      expect(await ids([], { search: "5.5" })).toEqual(["r03"]);
      expect(await ids([], { search: "cd" })).toEqual(["r10"]);
    });

    it("does not match across cell boundaries", async () => {
      // r10 has cells "ab" and "cd"
      expect(await ids([], { search: "ab" })).toEqual(["r10"]);
      expect(await ids([], { search: "bc" })).toEqual([]);
      expect(await ids([], { search: "abcd" })).toEqual([]);
    });

    it("escapes LIKE wildcards", async () => {
      expect(await ids([], { search: "50%" })).toEqual(["r05"]);
      expect(await ids([], { search: "a_b" })).toEqual(["r06"]);
      expect(await ids([], { search: "\\" })).toEqual(["r09"]);
    });

    it("blank search is ignored", async () => {
      expect(await ids([], { search: "" })).toEqual(ALL);
      expect(await ids([], { search: "   " })).toEqual(ALL);
    });

    it("combines with filters", async () => {
      expect(await ids([f(score, "eq", 20)], { search: "alice" })).toEqual([
        "r02",
      ]);
    });
  });

  describe("countRows", () => {
    it("counts with filters and search", async () => {
      expect(await countRows(testDb, { tableId, columns })).toBe(10);
      expect(
        await countRows(testDb, {
          tableId,
          columns,
          filters: [f(name, "contains", "alice")],
        }),
      ).toBe(2);
      expect(
        await countRows(testDb, {
          tableId,
          columns,
          filters: [f(score, "isEmpty")],
        }),
      ).toBe(4);
      expect(
        await countRows(testDb, {
          tableId,
          columns,
          filters: [f(score, "gt", 0)],
          search: "alice",
        }),
      ).toBe(2);
      expect(await countRows(testDb, { tableId, columns, search: "bc" })).toBe(
        0,
      );
    });

    it("ignores invalid filters", async () => {
      expect(
        await countRows(testDb, {
          tableId,
          columns,
          filters: [f("deletedcolumn", "isEmpty"), f(name, "contains", "")],
        }),
      ).toBe(10);
    });

    it("is scoped to the table", async () => {
      expect(await countRows(testDb, { tableId: "nosuchtable", columns })).toBe(
        0,
      );
    });
  });

  describe("unsafe identifiers", () => {
    const evil = 'x\'; drop table "Row"; --';

    it("rejects an unsafe table id", async () => {
      await expect(
        queryRows(testDb, { tableId: evil, columns, limit: 10 }),
      ).rejects.toThrow(/Unsafe identifier/);
      await expect(
        countRows(testDb, { tableId: "ABC", columns }),
      ).rejects.toThrow(/Unsafe identifier/);
    });

    it("rejects an unsafe column id in columns, even if unused", async () => {
      await expect(
        queryRows(testDb, {
          tableId,
          columns: [...columns, { id: evil, type: "string" }],
          limit: 10,
        }),
      ).rejects.toThrow(/Unsafe identifier/);
      await expect(
        countRows(testDb, {
          tableId,
          columns: [{ id: evil, type: "number" }],
          filters: [f(evil, "eq", 1)],
        }),
      ).rejects.toThrow(/Unsafe identifier/);
    });

    it("rejects unsafe ids in index helpers", async () => {
      await expect(
        ensureSortIndex(testDb, tableId, { id: evil, type: "string" }, "asc"),
      ).rejects.toThrow(/Unsafe identifier/);
      await expect(dropSortIndexes(testDb, { tableId: evil })).rejects.toThrow(
        /Unsafe identifier/,
      );
      expect(() => sortIndexName(tableId, evil, "asc")).toThrow();
    });

    it("did not execute injected SQL", async () => {
      expect(await testDb.row.count()).toBe(10);
    });
  });

  describe("pagination edge cases", () => {
    it("clamps limit to 1..500", async () => {
      const one = await queryRows(testDb, { tableId, columns, limit: 0 });
      expect(one.rows).toHaveLength(1);
      expect(one.nextCursor).toEqual({ order: 1, id: "r01" });
      const neg = await queryRows(testDb, { tableId, columns, limit: -5 });
      expect(neg.rows).toHaveLength(1);
      const sql = buildRowsQuery({ tableId, columns, limit: 99999 });
      expect(sql.values).toContain(501);
    });

    it("no cursor on the last page", async () => {
      const res = await queryRows(testDb, { tableId, columns, limit: 10 });
      expect(res.rows).toHaveLength(10);
      expect(res.nextCursor).toBeNull();
    });

    it("cursor of the wrong shape starts over", async () => {
      const sort: ViewSort = { columnId: score, direction: "asc" };
      const sorted = await queryRows(testDb, {
        tableId,
        columns,
        sort,
        limit: 3,
        cursor: { order: 5, id: "r05" },
      });
      const fresh = await queryRows(testDb, {
        tableId,
        columns,
        sort,
        limit: 3,
      });
      expect(sorted.rows).toEqual(fresh.rows);

      const unsorted = await queryRows(testDb, {
        tableId,
        columns,
        limit: 3,
        cursor: { key: "0abc", id: "r05" },
      });
      expect(unsorted.rows.map((r) => r.id)).toEqual(["r01", "r02", "r03"]);
    });

    it("a malformed numeric cursor key starts over instead of erroring", async () => {
      const res = await queryRows(testDb, {
        tableId,
        columns,
        sort: { columnId: score, direction: "asc" },
        limit: 3,
        cursor: { key: "not a number", id: "r05" },
      });
      expect(res.rows).toHaveLength(3);
    });
  });
});

// ---------------------------------------------------------------------------
describe("pagination completeness (5,000 rows)", () => {
  const N = 5000;
  let tableId: string;
  let text: string;
  let num: string;
  let columns: ColumnInfo[];
  type Truth = { id: string; order: number; data: Data };
  let truth: Truth[];

  function mulberry32(seed: number) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  beforeAll(async () => {
    await resetDb();
    const fx = await createFixture([
      { name: "Text", type: "string" },
      { name: "Num", type: "number" },
    ]);
    tableId = fx.table.id;
    text = fx.columns[0]!.id;
    num = fx.columns[1]!.id;
    columns = [
      { id: text, type: "string" },
      { id: num, type: "number" },
    ];

    const rand = mulberry32(12345);
    const pool = [
      "Apple",
      "apple",
      "BANANA",
      "banana",
      "cherry",
      "Date",
      "elderberry",
      "fig",
      "grape",
      "Honeydew",
    ];
    const suffix = ["", "", " pie", " Tart", " an"];
    const usedIds = new Set<string>();
    truth = [];
    for (let i = 0; i < N; i++) {
      let id: string;
      do {
        id = Math.floor(rand() * 36 ** 6)
          .toString(36)
          .padStart(6, "0");
      } while (usedIds.has(id));
      usedIds.add(id);
      const data: Data = {};
      if (rand() >= 0.1) {
        data[text] =
          pool[Math.floor(rand() * pool.length)]! +
          suffix[Math.floor(rand() * suffix.length)]!;
      }
      if (rand() >= 0.1) {
        // many duplicates, some negatives and decimals
        data[num] = Math.floor(rand() * 60) - 20 + (rand() < 0.2 ? 0.5 : 0);
      }
      truth.push({ id, order: i, data });
    }
    await insertRows(tableId, truth);
  });

  const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  function sortTruth(sort: ViewSort, rows: Truth[] = truth): string[] {
    if (!sort) {
      return [...rows]
        .sort((a, b) => a.order - b.order || cmpStr(a.id, b.id))
        .map((r) => r.id);
    }
    const dir = sort.direction === "asc" ? 1 : -1;
    const isNum = sort.columnId === num;
    const key = (r: Truth): string | number => {
      const v = r.data[sort.columnId];
      if (isNum) {
        if (v === undefined) return dir === 1 ? Infinity : -Infinity;
        return v as number;
      }
      const lower = v === undefined ? "" : (v as string).toLowerCase();
      if (dir === 1) return v === undefined ? "1" : "0" + lower;
      return v === undefined ? "0" : "1" + lower;
    };
    return [...rows]
      .sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        const c =
          typeof ka === "number" && typeof kb === "number"
            ? ka === kb
              ? 0
              : ka < kb
                ? -1
                : 1
            : cmpStr(ka as string, kb as string);
        return (c || cmpStr(a.id, b.id)) * dir;
      })
      .map((r) => r.id);
  }

  function expectCompleteWalk(got: string[], expected: string[]) {
    expect(new Set(got).size).toBe(got.length); // no duplicates
    expect(got.length).toBe(expected.length); // no gaps
    expect(got).toEqual(expected);
  }

  it("has duplicates and ~10% empty cells", () => {
    const emptyText = truth.filter((r) => r.data[text] === undefined).length;
    const emptyNum = truth.filter((r) => r.data[num] === undefined).length;
    expect(emptyText).toBeGreaterThan(N * 0.05);
    expect(emptyNum).toBeGreaterThan(N * 0.05);
    const distinctNums = new Set(truth.map((r) => r.data[num]));
    expect(distinctNums.size).toBeLessThan(N / 10);
  });

  it("unsorted", async () => {
    const { ids, pages } = await walk({ tableId, columns }, 137);
    expect(pages).toBe(Math.ceil(N / 137));
    expectCompleteWalk(ids, sortTruth(null));
  });

  it("text asc", async () => {
    const sort: ViewSort = { columnId: text, direction: "asc" };
    const { ids } = await walk({ tableId, columns, sort }, 137);
    expectCompleteWalk(ids, sortTruth(sort));
  });

  it("text desc", async () => {
    const sort: ViewSort = { columnId: text, direction: "desc" };
    const { ids } = await walk({ tableId, columns, sort }, 137);
    expectCompleteWalk(ids, sortTruth(sort));
  });

  it("number asc", async () => {
    const sort: ViewSort = { columnId: num, direction: "asc" };
    const { ids } = await walk({ tableId, columns, sort }, 137);
    expectCompleteWalk(ids, sortTruth(sort));
  });

  it("number desc", async () => {
    const sort: ViewSort = { columnId: num, direction: "desc" };
    const { ids } = await walk({ tableId, columns, sort }, 137);
    expectCompleteWalk(ids, sortTruth(sort));
  });

  it("empties are last in both directions", async () => {
    for (const columnId of [text, num]) {
      for (const direction of ["asc", "desc"] as const) {
        const { rows } = await queryRows(testDb, {
          tableId,
          columns,
          sort: { columnId, direction },
          limit: 500,
        });
        expect(rows[0]!.data[columnId]).not.toBeUndefined();
      }
    }
    const all = sortTruth({ columnId: num, direction: "desc" });
    const byId = new Map(truth.map((r) => [r.id, r]));
    const firstEmpty = all.findIndex(
      (i) => byId.get(i)!.data[num] === undefined,
    );
    expect(
      all.slice(firstEmpty).every((i) => byId.get(i)!.data[num] === undefined),
    ).toBe(true);
  });

  it("number asc + filter + search", async () => {
    const sort: ViewSort = { columnId: num, direction: "asc" };
    const filters = [f(num, "gt", 0), f(text, "notContains", "pie")];
    const search = "AN";
    const matches = truth.filter((r) => {
      const n = r.data[num] as number | undefined;
      if (n === undefined || !(n > 0)) return false;
      const t = r.data[text] as string | undefined;
      if (t?.toLowerCase().includes("pie")) return false;
      const st = Object.values(r.data).join("\x1f").toLowerCase();
      return st.includes("an");
    });
    expect(matches.length).toBeGreaterThan(100);
    const expected = sortTruth(sort, matches);

    const { ids } = await walk(
      { tableId, columns, sort, filters, search },
      137,
    );
    expectCompleteWalk(ids, expected);
    expect(await countRows(testDb, { tableId, columns, filters, search })).toBe(
      expected.length,
    );
  });

  it("text desc + isEmpty filter on the other column", async () => {
    const sort: ViewSort = { columnId: text, direction: "desc" };
    const filters = [f(num, "isEmpty")];
    const matches = truth.filter((r) => r.data[num] === undefined);
    const { ids } = await walk({ tableId, columns, sort, filters }, 137);
    expectCompleteWalk(ids, sortTruth(sort, matches));
  });

  it("a different page size gives the same result", async () => {
    const sort: ViewSort = { columnId: num, direction: "desc" };
    const { ids } = await walk({ tableId, columns, sort }, 500);
    expectCompleteWalk(ids, sortTruth(sort));
  });

  it("nextCursor is built from the last returned row", async () => {
    const sort: ViewSort = { columnId: num, direction: "asc" };
    const res = await queryRows(testDb, { tableId, columns, sort, limit: 10 });
    expect(res.rows).toHaveLength(10);
    expect(res.nextCursor?.id).toBe(res.rows[9]!.id);
  });

  it("countRows matches the ground truth", async () => {
    expect(await countRows(testDb, { tableId, columns })).toBe(N);
    expect(
      await countRows(testDb, {
        tableId,
        columns,
        filters: [f(text, "isNotEmpty")],
      }),
    ).toBe(truth.filter((r) => r.data[text] !== undefined).length);
    expect(
      await countRows(testDb, {
        tableId,
        columns,
        filters: [f(num, "neq", 5)],
      }),
    ).toBe(truth.filter((r) => r.data[num] !== 5).length);
  });

  // -------------------------------------------------------------------------
  describe("offset pages", () => {
    type Page = Awaited<ReturnType<typeof queryRows>>;
    type Walked = { q: RowQuery; limit: number; pages: Page[] };

    async function walkPages(q: RowQuery, limit: number): Promise<Walked> {
      const pages: Page[] = [];
      let cursor: RowCursor | null = null;
      do {
        const res: Page = await queryRows(testDb, { ...q, limit, cursor });
        pages.push(res);
        cursor = res.nextCursor;
        if (pages.length > 10_000) throw new Error("did not terminate");
      } while (cursor);
      return { q, limit, pages };
    }

    /** A spread of page numbers: first, second, a few interior ones, last. */
    function samplePages(count: number): number[] {
      const picks = new Set([0, 1, 2, Math.floor(count / 3), count - 2]);
      for (let i = 1; i <= 5; i++) picks.add(Math.floor((count * i) / 7));
      picks.add(count - 1);
      return [...picks]
        .filter((k) => k >= 0 && k < count)
        .sort((a, b) => a - b);
    }

    const views: { label: string; q: () => RowQuery }[] = [
      { label: "unsorted", q: () => ({ tableId, columns }) },
      {
        label: "text asc",
        q: () => ({
          tableId,
          columns,
          sort: { columnId: text, direction: "asc" },
        }),
      },
      {
        label: "text desc",
        q: () => ({
          tableId,
          columns,
          sort: { columnId: text, direction: "desc" },
        }),
      },
      {
        label: "number asc",
        q: () => ({
          tableId,
          columns,
          sort: { columnId: num, direction: "asc" },
        }),
      },
      {
        label: "number desc",
        q: () => ({
          tableId,
          columns,
          sort: { columnId: num, direction: "desc" },
        }),
      },
      {
        label: "filter + search",
        q: () => ({
          tableId,
          columns,
          filters: [f(num, "gt", 0), f(text, "notContains", "pie")],
          search: "an",
        }),
      },
      {
        label: "sorted + filter + search",
        q: () => ({
          tableId,
          columns,
          sort: { columnId: num, direction: "desc" },
          filters: [f(text, "isNotEmpty")],
          search: "e",
        }),
      },
    ];

    for (const view of views) {
      it(`${view.label}: offset page k equals keyset page k`, async () => {
        for (const limit of [25, 137, 500]) {
          const walked = await walkPages(view.q(), limit);
          const { pages } = walked;
          const all = pages.flatMap((p) => p.rows);
          expect(all.length).toBeGreaterThan(limit); // more than one page
          for (const k of samplePages(pages.length)) {
            const res = await queryRows(testDb, {
              ...view.q(),
              limit,
              offset: k * limit,
            });
            const expected = pages[k]!;
            expect(
              res.rows.map((r) => r.id),
              `${view.label} limit=${limit} page ${k}`,
            ).toEqual(expected.rows.map((r) => r.id));
            expect(res.rows).toEqual(expected.rows);
            // nextCursor is built exactly like a keyset page's.
            expect(res.nextCursor).toEqual(expected.nextCursor);
          }
        }
      });

      it(`${view.label}: keyset continues correctly after an offset page`, async () => {
        for (const limit of [25, 137]) {
          const { pages } = await walkPages(view.q(), limit);
          for (const k of samplePages(pages.length - 1)) {
            const jumped = await queryRows(testDb, {
              ...view.q(),
              limit,
              offset: k * limit,
            });
            expect(jumped.nextCursor).not.toBeNull();
            const next = await queryRows(testDb, {
              ...view.q(),
              limit,
              cursor: jumped.nextCursor,
            });
            expect(next.rows.map((r) => r.id)).toEqual(
              pages[k + 1]!.rows.map((r) => r.id),
            );
          }
        }
      });

      it(`${view.label}: offset at or beyond the end returns no rows`, async () => {
        const total = await countRows(testDb, view.q());
        for (const offset of [total, total + 1, total + 1000, 9_999_999]) {
          const res = await queryRows(testDb, {
            ...view.q(),
            limit: 50,
            offset,
          });
          expect(res.rows).toEqual([]);
          expect(res.nextCursor).toBeNull();
        }
        // The last row alone, and a partial last page.
        const last = await queryRows(testDb, {
          ...view.q(),
          limit: 50,
          offset: total - 1,
        });
        expect(last.rows).toHaveLength(1);
        expect(last.nextCursor).toBeNull();
        const partial = await queryRows(testDb, {
          ...view.q(),
          limit: 50,
          offset: total - 20,
        });
        expect(partial.rows).toHaveLength(20);
        expect(partial.nextCursor).toBeNull();
      });
    }

    it("offset 0 is the first page, and offset is optional", async () => {
      const q = { tableId, columns, limit: 25 };
      const first = await queryRows(testDb, q);
      expect(await queryRows(testDb, { ...q, offset: 0 })).toEqual(first);
      expect(await queryRows(testDb, { ...q, offset: undefined })).toEqual(
        first,
      );
    });

    it("an unsorted offset page matches the ground truth", async () => {
      const ids = sortTruth(null);
      const res = await queryRows(testDb, {
        tableId,
        columns,
        limit: 100,
        offset: 2345,
      });
      expect(res.rows.map((r) => r.id)).toEqual(ids.slice(2345, 2445));
      expect(res.nextCursor).toEqual({
        order: res.rows[99]!.order,
        id: res.rows[99]!.id,
      });
    });

    it("a sorted offset page matches the ground truth", async () => {
      const sort: ViewSort = { columnId: text, direction: "desc" };
      const res = await queryRows(testDb, {
        tableId,
        columns,
        sort,
        limit: 100,
        offset: 3210,
      });
      expect(res.rows.map((r) => r.id)).toEqual(
        sortTruth(sort).slice(3210, 3310),
      );
    });

    it("rejects cursor together with offset", async () => {
      const unsortedCursor = { order: 5, id: "abc" };
      await expect(
        queryRows(testDb, {
          tableId,
          columns,
          limit: 10,
          cursor: unsortedCursor,
          offset: 10,
        }),
      ).rejects.toThrow(/mutually exclusive/);
      await expect(
        queryRows(testDb, {
          tableId,
          columns,
          limit: 10,
          cursor: unsortedCursor,
          offset: 0,
        }),
      ).rejects.toThrow(/mutually exclusive/);
      expect(() =>
        buildRowsQuery({
          tableId,
          columns,
          sort: { columnId: num, direction: "asc" },
          limit: 10,
          cursor: { key: "1", id: "abc" },
          offset: 10,
        }),
      ).toThrow(/mutually exclusive/);
      // A null cursor is the same as none.
      const res = await queryRows(testDb, {
        tableId,
        columns,
        limit: 10,
        cursor: null,
        offset: 10,
      });
      expect(res.rows).toHaveLength(10);
    });

    it("rejects an invalid offset", async () => {
      for (const offset of [-1, 1.5, Number.NaN, 10_000_001]) {
        await expect(
          queryRows(testDb, { tableId, columns, limit: 10, offset }),
        ).rejects.toThrow(/offset/);
      }
      const max = await queryRows(testDb, {
        tableId,
        columns,
        limit: 10,
        offset: 10_000_000,
      });
      expect(max.rows).toEqual([]);
    });

    it("binds the offset and limit as parameters", () => {
      const sql = buildRowsQuery({
        tableId,
        columns,
        limit: 10,
        offset: 1234,
      });
      expect(sql.text).toMatch(/OFFSET \$\d+ LIMIT 1\)/);
      expect(sql.values).toContain(1234);
      expect(sql.values).toContain(11);
    });

    it("filtered and sorted offsets use a plain OFFSET", () => {
      const filtered = buildRowsQuery({
        tableId,
        columns,
        filters: [f(num, "gt", 0)],
        limit: 10,
        offset: 1234,
      });
      expect(filtered.text).toMatch(/ORDER BY "order" ASC OFFSET \$\d+ LIMIT/);
      expect(filtered.text).not.toContain('SELECT "order"');
      const sorted = buildRowsQuery({
        tableId,
        columns,
        sort: { columnId: num, direction: "asc" },
        limit: 10,
        offset: 1234,
      });
      expect(sorted.text).toMatch(/, "id" ASC OFFSET \$\d+ LIMIT/);
    });

    // -----------------------------------------------------------------------
    describe("backward pages and prevCursor", () => {
      for (const view of views) {
        it(`${view.label}: backward page from page k's prevCursor equals page k-1`, async () => {
          for (const limit of [137]) {
            const { pages } = await walkPages(view.q(), limit);
            expect(pages.length).toBeGreaterThan(2);
            expect(pages[0]!.prevCursor).toBeNull();
            for (let k = 1; k < pages.length; k++) {
              const prev = pages[k]!.prevCursor;
              expect(
                prev,
                `${view.label} limit=${limit} page ${k}`,
              ).not.toBeNull();
              const back = await queryRows(testDb, {
                ...view.q(),
                limit,
                cursor: prev,
                direction: "backward",
              });
              // Rows, nextCursor and prevCursor all match the forward page.
              expect(
                back,
                `${view.label} limit=${limit} page ${k - 1}`,
              ).toEqual(pages[k - 1]);
            }
          }
        });

        it(`${view.label}: prevCursor matches offset pages exactly`, async () => {
          const limit = 137;
          const { pages } = await walkPages(view.q(), limit);
          for (const k of samplePages(pages.length)) {
            const jumped = await queryRows(testDb, {
              ...view.q(),
              limit,
              offset: k * limit,
            });
            expect(jumped.prevCursor).toEqual(pages[k]!.prevCursor);
            expect(jumped.prevCursor === null).toBe(k === 0);
            if (k > 0) {
              const back = await queryRows(testDb, {
                ...view.q(),
                limit,
                cursor: jumped.prevCursor,
                direction: "backward",
              });
              expect(back).toEqual(
                await queryRows(testDb, {
                  ...view.q(),
                  limit,
                  offset: (k - 1) * limit,
                }),
              );
            }
          }
        });

        it(`${view.label}: walking backward from the last page covers everything`, async () => {
          for (const limit of [137]) {
            const { pages } = await walkPages(view.q(), limit);
            const all = pages.flatMap((p) => p.rows.map((r) => r.id));
            const lastIndex = pages.length - 1;
            const last = await queryRows(testDb, {
              ...view.q(),
              limit,
              offset: lastIndex * limit,
            });
            expect(last.rows).toEqual(pages[lastIndex]!.rows);

            const walked: Page[] = [];
            let cursor: RowCursor | null = last.prevCursor;
            while (cursor) {
              const back: Page = await queryRows(testDb, {
                ...view.q(),
                limit,
                cursor,
                direction: "backward",
              });
              walked.push(back);
              cursor = back.prevCursor;
              if (walked.length > 10_000) throw new Error("did not terminate");
            }
            // Page by page, the backward walk is the forward pages reversed.
            expect(walked.map((p) => p.rows)).toEqual(
              pages
                .slice(0, lastIndex)
                .map((p) => p.rows)
                .reverse(),
            );
            const reassembled = [
              ...walked.reverse().flatMap((p) => p.rows.map((r) => r.id)),
              ...last.rows.map((r) => r.id),
            ];
            expect(new Set(reassembled).size).toBe(reassembled.length);
            expect(reassembled).toEqual(all);
          }
        });

        it(`${view.label}: an arbitrary backward window matches the full order`, async () => {
          const { pages } = await walkPages(view.q(), 500);
          const all = pages.flatMap((p) => p.rows);
          // Row cursors come from the forward pages at the same indexes.
          const small = (await walkPages(view.q(), 7)).pages;
          const cursors = small.slice(1).map((p) => p.prevCursor!);
          for (const [pi, cursor] of cursors.entries()) {
            if (pi % 26 !== 0) continue;
            const index = (pi + 1) * 7; // index of the cursor row
            for (const limit of [1, 5, 50, 333]) {
              const back = await queryRows(testDb, {
                ...view.q(),
                limit,
                cursor,
                direction: "backward",
              });
              const from = Math.max(0, index - limit);
              expect(back.rows.map((r) => r.id)).toEqual(
                all.slice(from, index).map((r) => r.id),
              );
              // Rows precede the window unless it reaches the top.
              expect(back.prevCursor === null).toBe(from === 0);
              // nextCursor points at the cursor row, which directly follows.
              const following = await queryRows(testDb, {
                ...view.q(),
                limit: 1,
                cursor: back.nextCursor,
              });
              expect(following.rows.map((r) => r.id)).toEqual([all[index]!.id]);
            }
          }
        });
      }

      it("backward from the first row is empty with no cursors", async () => {
        const first = await queryRows(testDb, { tableId, columns, limit: 3 });
        const back = await queryRows(testDb, {
          tableId,
          columns,
          limit: 10,
          cursor: { order: first.rows[0]!.order, id: first.rows[0]!.id },
          direction: "backward",
        });
        expect(back).toEqual({ rows: [], nextCursor: null, prevCursor: null });
      });

      it("a backward window reaching the top has no prevCursor, even when exactly full", async () => {
        const q = { tableId, columns };
        const { rows } = await queryRows(testDb, { ...q, limit: 11 });
        const cursor = { order: rows[10]!.order, id: rows[10]!.id };
        // Exactly 10 rows before the cursor row.
        const exact = await queryRows(testDb, {
          ...q,
          limit: 10,
          cursor,
          direction: "backward",
        });
        expect(exact.rows).toEqual(rows.slice(0, 10));
        expect(exact.prevCursor).toBeNull();
        // One fewer: the extra row exists.
        const short = await queryRows(testDb, {
          ...q,
          limit: 9,
          cursor,
          direction: "backward",
        });
        expect(short.rows).toEqual(rows.slice(1, 10));
        expect(short.prevCursor).toEqual({
          order: rows[1]!.order,
          id: rows[1]!.id,
        });
      });

      it("prevCursor is null exactly at the start of forward and offset pages", async () => {
        const q = { tableId, columns, limit: 10 };
        expect((await queryRows(testDb, q)).prevCursor).toBeNull();
        expect(
          (await queryRows(testDb, { ...q, cursor: null })).prevCursor,
        ).toBeNull();
        expect(
          (await queryRows(testDb, { ...q, offset: 0 })).prevCursor,
        ).toBeNull();
        const second = await queryRows(testDb, { ...q, offset: 10 });
        expect(second.prevCursor).toEqual({
          order: second.rows[0]!.order,
          id: second.rows[0]!.id,
        });
        // Past the end there is no first row to point at.
        expect(
          (await queryRows(testDb, { ...q, offset: 9_000_000 })).prevCursor,
        ).toBeNull();
        // An explicit forward direction behaves like the default.
        expect(
          await queryRows(testDb, { ...q, direction: "forward", offset: 20 }),
        ).toEqual(await queryRows(testDb, { ...q, offset: 20 }));
      });

      it("rejects a backward page without a cursor, with offset, or with the wrong cursor kind", async () => {
        const q = {
          tableId,
          columns,
          limit: 10,
          direction: "backward",
        } as const;
        await expect(queryRows(testDb, q)).rejects.toThrow(/require a cursor/);
        await expect(queryRows(testDb, { ...q, cursor: null })).rejects.toThrow(
          /require a cursor/,
        );
        await expect(queryRows(testDb, { ...q, offset: 0 })).rejects.toThrow(
          /require a cursor/,
        );
        await expect(
          queryRows(testDb, {
            ...q,
            cursor: { order: 5, id: "abc" },
            offset: 10,
          }),
        ).rejects.toThrow(/offset/);
        // A key cursor on an unsorted view, and an order cursor on a sorted one.
        await expect(
          queryRows(testDb, { ...q, cursor: { key: "0a", id: "abc" } }),
        ).rejects.toThrow(/does not match/);
        await expect(
          queryRows(testDb, {
            ...q,
            sort: { columnId: text, direction: "asc" },
            cursor: { order: 5, id: "abc" },
          }),
        ).rejects.toThrow(/does not match/);
        await expect(
          queryRows(testDb, {
            ...q,
            sort: { columnId: num, direction: "asc" },
            cursor: { key: "not a number", id: "abc" },
          }),
        ).rejects.toThrow(/does not match/);
      });

      it("backward SQL flips the comparison and the ORDER BY", () => {
        const base = { tableId, columns, limit: 10 };
        const un = buildRowsQuery({
          ...base,
          cursor: { order: 9, id: "x" },
          direction: "backward",
        });
        expect(un.text).toMatch(/"order" < \$\d+/);
        expect(un.text).toContain('ORDER BY "order" DESC LIMIT');
        const asc = buildRowsQuery({
          ...base,
          sort: { columnId: num, direction: "asc" },
          cursor: { key: "1", id: "x" },
          direction: "backward",
        });
        expect(asc.text).toMatch(/, "id"\) < \(/);
        expect(asc.text).toMatch(/DESC, "id" DESC LIMIT/);
        const desc = buildRowsQuery({
          ...base,
          sort: { columnId: num, direction: "desc" },
          cursor: { key: "1", id: "x" },
          direction: "backward",
        });
        expect(desc.text).toMatch(/, "id"\) > \(/);
        expect(desc.text).toMatch(/ASC, "id" ASC LIMIT/);
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("unsorted pages use the unique order index", () => {
    async function explain(query: Prisma.Sql): Promise<string> {
      return testDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
        await tx.$executeRawUnsafe("SET LOCAL enable_bitmapscan = off");
        const plan = await tx.$queryRaw<{ "QUERY PLAN": string }[]>(
          Prisma.sql`EXPLAIN ${query}`,
        );
        return plan.map((p) => p["QUERY PLAN"]).join("\n");
      });
    }

    it('orders and pages by "order" alone', () => {
      const first = buildRowsQuery({ tableId, columns, limit: 10 });
      expect(first.text).toContain('ORDER BY "order" ASC LIMIT');
      expect(first.text).not.toContain('"id" ASC');
      const next = buildRowsQuery({
        tableId,
        columns,
        limit: 10,
        cursor: { order: 7, id: "ignored" },
      });
      expect(next.text).toMatch(/"order" > \$\d+/);
      expect(next.values).toContain(7);
      expect(next.values).not.toContain("ignored");
    });

    it("first, keyset and offset pages are index scans without a sort", async () => {
      const queries = {
        first: { tableId, columns, limit: 100 },
        keyset: {
          tableId,
          columns,
          limit: 100,
          cursor: { order: 2000, id: "" },
        },
        offset: { tableId, columns, limit: 100, offset: 2500 },
      };
      for (const [label, q] of Object.entries(queries)) {
        const plan = await explain(buildRowsQuery(q));
        expect(plan, label).toContain("Row_tableId_order_key");
        expect(plan, label).not.toMatch(/Sort/);
      }
    });

    it("backward pages are reverse index scans without a sort", async () => {
      const plan = await explain(
        buildRowsQuery({
          tableId,
          columns,
          limit: 100,
          cursor: { order: 2000, id: "" },
          direction: "backward",
        }),
      );
      expect(plan).toContain("Index Scan Backward");
      expect(plan).toContain("Row_tableId_order_key");
      expect(plan).not.toMatch(/Sort/);
    });

    it("the database enforces unique orders per table", async () => {
      const other = await createFixture([]);
      await testDb.row.create({
        data: { tableId: other.table.id, order: 1, data: {} },
      });
      await expect(
        testDb.row.create({
          data: { tableId: other.table.id, order: 1, data: {} },
        }),
      ).rejects.toThrow();
      // The same order in another table is fine.
      await testDb.row.create({ data: { tableId, order: N + 100, data: {} } });
      await testDb.row.create({
        data: { tableId: other.table.id, order: N + 100, data: {} },
      });
      await testDb.row.deleteMany({
        where: { tableId, order: N + 100 },
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("sort indexes", () => {
    const cases: {
      label: string;
      col: () => ColumnInfo;
      direction: "asc" | "desc";
    }[] = [
      { label: "text asc", col: () => columns[0]!, direction: "asc" },
      { label: "text desc", col: () => columns[0]!, direction: "desc" },
      { label: "number asc", col: () => columns[1]!, direction: "asc" },
      { label: "number desc", col: () => columns[1]!, direction: "desc" },
    ];

    async function explain(query: Prisma.Sql): Promise<string> {
      return testDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
        await tx.$executeRawUnsafe("SET LOCAL enable_bitmapscan = off");
        const plan = await tx.$queryRaw<{ "QUERY PLAN": string }[]>(
          Prisma.sql`EXPLAIN ${query}`,
        );
        return plan.map((p) => p["QUERY PLAN"]).join("\n");
      });
    }

    it("sortIndexName format", () => {
      expect(sortIndexName("t1", "c1", "asc")).toBe("rs_t1_c1_a");
      expect(sortIndexName("t1", "c1", "desc")).toBe("rs_t1_c1_d");
      expect(sortIndexName(tableId, text, "asc").length).toBeLessThanOrEqual(
        63,
      );
      expect(() =>
        sortIndexName("a".repeat(40), "b".repeat(40), "asc"),
      ).toThrow();
    });

    it("sorted queries use the index after ensureSortIndex", async () => {
      for (const c of cases) {
        await ensureSortIndex(testDb, tableId, c.col(), c.direction);
      }
      await testDb.$executeRawUnsafe(`ANALYZE "Row"`);
      expect(await indexNames(tableId)).toEqual(
        [
          sortIndexName(tableId, text, "asc"),
          sortIndexName(tableId, text, "desc"),
          sortIndexName(tableId, num, "asc"),
          sortIndexName(tableId, num, "desc"),
        ].sort(),
      );

      for (const c of cases) {
        const name = sortIndexName(tableId, c.col().id, c.direction);
        const sort: ViewSort = { columnId: c.col().id, direction: c.direction };
        const first = buildRowsQuery({ tableId, columns, sort, limit: 100 });
        const planFirst = await explain(first);
        expect(planFirst, `${c.label} first page\n${planFirst}`).toContain(
          name,
        );
        // Never a separate sort step over the whole table.
        expect(planFirst).not.toMatch(/Sort Key/);

        const next = buildRowsQuery({
          tableId,
          columns,
          sort,
          limit: 100,
          cursor: {
            key: c.col().type === "number" ? "5" : "0apple",
            id: "abc",
          },
        });
        const planNext = await explain(next);
        expect(planNext, `${c.label} cursor page\n${planNext}`).toContain(name);
      }
    });

    it("backward pages use the same index, with no sort step", async () => {
      for (const c of cases) {
        const name = sortIndexName(tableId, c.col().id, c.direction);
        const sort: ViewSort = { columnId: c.col().id, direction: c.direction };
        const cursor = {
          key: c.col().type === "number" ? "5" : "0apple",
          id: "abc",
        };
        const forward = await explain(
          buildRowsQuery({ tableId, columns, sort, limit: 100, cursor }),
        );
        const backward = await explain(
          buildRowsQuery({
            tableId,
            columns,
            sort,
            limit: 100,
            cursor,
            direction: "backward",
          }),
        );
        expect(backward, `${c.label}\n${backward}`).toContain(name);
        expect(backward).not.toMatch(/Sort/);
        // The two directions scan the one index in opposite directions.
        expect(forward.includes("Index Scan Backward")).not.toBe(
          backward.includes("Index Scan Backward"),
        );
      }
    });

    it("the index is used with filter + search without a seq-scan sort", async () => {
      const sort: ViewSort = { columnId: num, direction: "asc" };
      const plan = await explain(
        buildRowsQuery({
          tableId,
          columns,
          sort,
          filters: [f(text, "isNotEmpty")],
          limit: 100,
        }),
      );
      expect(plan).toContain(sortIndexName(tableId, num, "asc"));
    });

    it("ensureSortIndex is idempotent", async () => {
      const before = await indexNames(tableId);
      await ensureSortIndex(testDb, tableId, columns[1]!, "asc");
      await ensureSortIndex(testDb, tableId, columns[1]!, "asc");
      expect(await indexNames(tableId)).toEqual(before);
    });

    it("rebuilds an INVALID index", async () => {
      const name = sortIndexName(tableId, num, "asc");
      await testDb.$executeRawUnsafe(
        `UPDATE pg_index SET indisvalid = false WHERE indexrelid = '"${name}"'::regclass`,
      );
      const valid = async () =>
        (
          await testDb.$queryRaw<{ v: boolean }[]>(
            Prisma.sql`SELECT i.indisvalid AS v FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ${name}`,
          )
        ).map((r) => r.v);
      expect(await valid()).toEqual([false]);
      await ensureSortIndex(testDb, tableId, columns[1]!, "asc");
      expect(await valid()).toEqual([true]);
    });

    it("results are the same with the indexes in place", async () => {
      const sort: ViewSort = { columnId: text, direction: "desc" };
      const { ids } = await walk({ tableId, columns, sort }, 137);
      expectCompleteWalk(ids, sortTruth(sort));
    });

    it("dropSortIndexes removes by column, then by table, leaving other tables", async () => {
      const other = await createFixture([{ name: "X", type: "number" }]);
      const otherCol: ColumnInfo = { id: other.columns[0]!.id, type: "number" };
      await ensureSortIndex(testDb, other.table.id, otherCol, "asc");

      await dropSortIndexes(testDb, { tableId, columnId: text });
      expect(await indexNames(tableId)).toEqual(
        [
          sortIndexName(tableId, num, "asc"),
          sortIndexName(tableId, num, "desc"),
        ].sort(),
      );

      await dropSortIndexes(testDb, { tableId });
      expect(await indexNames(tableId)).toEqual([]);
      expect(await indexNames(other.table.id)).toEqual([
        sortIndexName(other.table.id, otherCol.id, "asc"),
      ]);

      // Dropping when nothing exists is a no-op; also works in a transaction.
      await testDb.$transaction((tx) => dropSortIndexes(tx, { tableId }));
      await dropSortIndexes(testDb, { tableId: other.table.id });
      expect(await indexNames(other.table.id)).toEqual([]);
    });

    it("queries still work without the indexes", async () => {
      const sort: ViewSort = { columnId: num, direction: "asc" };
      const res = await queryRows(testDb, { tableId, columns, sort, limit: 5 });
      expect(res.rows.map((r) => r.id)).toEqual(sortTruth(sort).slice(0, 5));
    });
  });
});
