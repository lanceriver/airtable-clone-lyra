import { beforeEach, describe, expect, it } from "vitest";

import { createFixture, resetDb, testDb } from "~/test/db";
import { insertFakeRows, type FakeColumn } from "./fakeRows";

type DbRow = {
  order: number;
  data: Record<string, unknown>;
  search_text: string;
};

const defaultColumns = [
  { name: "Name", type: "string" as const },
  { name: "Email", type: "string" as const },
  { name: "Company", type: "string" as const },
  { name: "Score", type: "number" as const },
];

async function setup(columns: { name: string; type: "string" | "number" }[]) {
  const fx = await createFixture(columns);
  const cols: FakeColumn[] = fx.columns.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type as "string" | "number",
  }));
  return { tableId: fx.table.id, cols };
}

const readOrders = async (tableId: string) =>
  (
    await testDb.$queryRaw<{ order: number }[]>`
      SELECT "order" FROM "Row" WHERE "tableId" = ${tableId} ORDER BY "order"`
  ).map((r) => r.order);

describe("insertFakeRows", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("inserts 100k varied rows quickly", async () => {
    const { tableId, cols } = await setup(defaultColumns);
    const [name, email, company, score] = cols as [
      FakeColumn,
      FakeColumn,
      FakeColumn,
      FakeColumn,
    ];

    const start = performance.now();
    const res = await insertFakeRows(testDb, {
      tableId,
      columns: cols,
      count: 100_000,
    });
    const ms = performance.now() - start;
    console.log(`insertFakeRows: 100,000 rows in ${Math.round(ms)} ms`);

    expect(res.inserted).toBe(100_000);
    expect(ms).toBeLessThan(10_000);

    const [cnt] = await testDb.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "Row" WHERE "tableId" = ${tableId}`;
    expect(Number(cnt!.n)).toBe(100_000);

    const [stats] = await testDb.$queryRaw<
      {
        names: bigint;
        emails: bigint;
        companies: bigint;
        scores: bigint;
        bad_email: bigint;
        bad_score: bigint;
        empty_search: bigint;
      }[]
    >`
      SELECT count(DISTINCT data->>${name.id}) AS names,
             count(DISTINCT data->>${email.id}) AS emails,
             count(DISTINCT data->>${company.id}) AS companies,
             count(DISTINCT data->>${score.id}) AS scores,
             count(*) FILTER (WHERE data->>${email.id} IS NULL
               OR data->>${email.id} NOT LIKE '%@%'
               OR data->>${email.id} <> lower(data->>${email.id})) AS bad_email,
             count(*) FILTER (WHERE jsonb_typeof(data->${score.id}) <> 'number'
               OR (data->>${score.id})::numeric NOT BETWEEN 0 AND 9999
               OR (data->>${score.id})::numeric <> floor((data->>${score.id})::numeric)) AS bad_score,
             count(*) FILTER (WHERE search_text = '') AS empty_search
      FROM "Row" WHERE "tableId" = ${tableId}`;
    const distinctNames = Number(stats!.names);
    console.log(`distinct names: ${distinctNames}`);
    expect(distinctNames).toBeGreaterThan(50_000);
    expect(Number(stats!.emails)).toBeGreaterThan(50_000);
    expect(Number(stats!.companies)).toBeGreaterThan(100);
    expect(Number(stats!.scores)).toBeGreaterThan(5_000);
    expect(Number(stats!.bad_email)).toBe(0);
    expect(Number(stats!.bad_score)).toBe(0);
    expect(Number(stats!.empty_search)).toBe(0);

    // Email is built from the same first/last as the row's name.
    const sample = await testDb.$queryRaw<{ name: string; email: string }[]>`
      SELECT data->>${name.id} AS name, data->>${email.id} AS email
      FROM "Row" WHERE "tableId" = ${tableId} LIMIT 200`;
    for (const r of sample) {
      const [first, ...rest] = r.name.split(" ");
      const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      expect(r.email.startsWith(`${slug(first!)}.${slug(rest.join(""))}`)).toBe(
        true,
      );
    }
  });

  it("continues order with no gaps across successive calls", async () => {
    const { tableId, cols } = await setup(defaultColumns);
    await insertFakeRows(testDb, {
      tableId,
      columns: cols,
      count: 1_000,
      chunkSize: 300,
    });
    await insertFakeRows(testDb, { tableId, columns: cols, count: 500 });
    const orders = await readOrders(tableId);
    expect(orders).toEqual(Array.from({ length: 1_500 }, (_, i) => i + 1));
  });

  it("gives concurrent inserts on one table non-overlapping, gap-free orders", async () => {
    const { tableId, cols } = await setup(defaultColumns);
    const [a, b] = await Promise.all([
      insertFakeRows(testDb, {
        tableId,
        columns: cols,
        count: 3_000,
        chunkSize: 700,
      }),
      insertFakeRows(testDb, {
        tableId,
        columns: cols,
        count: 2_000,
        chunkSize: 500,
      }),
    ]);
    expect(a.inserted + b.inserted).toBe(5_000);
    const orders = await readOrders(tableId);
    expect(orders).toEqual(Array.from({ length: 5_000 }, (_, i) => i + 1));
  });

  it("inserts empty objects for a table with no columns", async () => {
    const { tableId } = await setup([]);
    await insertFakeRows(testDb, { tableId, columns: [], count: 50 });
    const rows = await testDb.$queryRaw<DbRow[]>`
      SELECT "order", data, search_text FROM "Row" WHERE "tableId" = ${tableId}`;
    expect(rows).toHaveLength(50);
    for (const r of rows) {
      expect(r.data).toEqual({});
      expect(r.search_text).toBe("");
    }
  });

  it("fills unknown text columns with 2-4 lorem words and handles number columns by type", async () => {
    const { tableId, cols } = await setup([
      { name: "Notes", type: "string" },
      { name: "First Name", type: "string" },
      { name: "Last Name", type: "string" },
      { name: "Name", type: "number" },
    ]);
    await insertFakeRows(testDb, { tableId, columns: cols, count: 2_000 });
    const rows = await testDb.$queryRaw<DbRow[]>`
      SELECT "order", data, search_text FROM "Row" WHERE "tableId" = ${tableId}`;
    const [notes, first, last, numName] = cols as [
      FakeColumn,
      FakeColumn,
      FakeColumn,
      FakeColumn,
    ];
    const lengths = new Set<number>();
    const distinctNotes = new Set<string>();
    for (const r of rows) {
      const text = r.data[notes.id];
      expect(typeof text).toBe("string");
      expect(text as string).toMatch(/^[a-z]+( [a-z]+){1,3}$/);
      lengths.add((text as string).split(" ").length);
      distinctNotes.add(text as string);
      expect(typeof r.data[first.id]).toBe("string");
      expect(typeof r.data[last.id]).toBe("string");
      expect(typeof r.data[numName.id]).toBe("number");
    }
    expect([...lengths].sort()).toEqual([2, 3, 4]);
    expect(distinctNotes.size).toBeGreaterThan(1_000);
  });
});
