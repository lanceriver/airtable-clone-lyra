/**
 * Benchmark of the real row query builder on a large table.
 *
 *   npm run bench                      # 1,000,000 rows
 *   npm run bench -- --rows=100000     # smaller table
 *   npm run bench -- --reuse           # reuse the existing "bench-<N>" table
 *
 * Connects with its own PrismaClient (it does not import ~/server/db or ~/env)
 * to BENCH_DATABASE_URL, and writes docs/benchmarks.md.
 */
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { Prisma, PrismaClient } from "@prisma/client";

import { insertFakeRows } from "~/server/db/fakeRows";
import {
  buildRowsQuery,
  countRows,
  dropSortIndexes,
  ensureSortIndex,
  queryRows,
  sortIndexName,
  type ColumnInfo,
  type PageQuery,
  type RowCursor,
  type RowQuery,
  type ViewFilter,
} from "~/server/db/rows";

const DEFAULT_URL =
  "postgresql://postgres@localhost:5433/airtable_bench?host=/tmp";
const PAGE_SIZE = 200;
const TIMED_RUNS = 5;
const SLOW_MS = 300;
const OUT_FILE = path.resolve(process.cwd(), "docs/benchmarks.md");

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { rows: number; reuse: boolean } {
  let rows = 1_000_000;
  let reuse = false;
  for (const arg of argv) {
    if (arg === "--reuse") {
      reuse = true;
    } else if (arg.startsWith("--rows=")) {
      rows = Number(arg.slice("--rows=".length).replace(/_/g, ""));
      if (!Number.isInteger(rows) || rows < 1000) {
        throw new Error(`--rows must be an integer >= 1000, got "${arg}"`);
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { rows, reuse };
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

type Result = {
  label: string;
  median: number;
  p95: number;
  returned: number;
  /** Set for page queries, so a slow one can be explained. */
  query?: PageQuery;
  /** EXPLAIN (ANALYZE, BUFFERS) output, captured when the median > SLOW_MS. */
  plan?: string;
};

/** Runs EXPLAIN on the page query the builder generates. */
async function explain(
  db: PrismaClient,
  q: PageQuery,
  analyze = false,
): Promise<string> {
  const prefix = analyze
    ? Prisma.sql`EXPLAIN (ANALYZE, BUFFERS)`
    : Prisma.sql`EXPLAIN`;
  const rows = await db.$queryRaw<Record<string, string>[]>(
    Prisma.sql`${prefix} ${buildRowsQuery(q)}`,
  );
  return rows.map((r) => r["QUERY PLAN"] ?? "").join("\n");
}

const results: Result[] = [];

const db = new PrismaClient({
  datasourceUrl: process.env.BENCH_DATABASE_URL ?? DEFAULT_URL,
});

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

/** One warm-up run, then TIMED_RUNS timed runs. `fn` returns the row count. */
async function measure(
  label: string,
  fn: () => Promise<number>,
  query?: Result["query"],
): Promise<Result> {
  await fn();
  const times: number[] = [];
  let returned = 0;
  for (let i = 0; i < TIMED_RUNS; i++) {
    const t0 = performance.now();
    returned = await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const result: Result = {
    label,
    median: percentile(times, 0.5),
    p95: percentile(times, 0.95),
    returned,
    query,
  };
  if (query && result.median > SLOW_MS) {
    // Explain right away, while the table is in the state that was measured.
    result.plan = await explain(db, query, true);
  }
  results.push(result);
  console.log(
    `${label.padEnd(58)} ${fmt(result.median).padStart(9)} ${fmt(result.p95).padStart(9)} ${String(returned).padStart(8)}`,
  );
  return result;
}

function fmt(ms: number): string {
  return ms < 10 ? ms.toFixed(2) : ms < 100 ? ms.toFixed(1) : ms.toFixed(0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(db: PrismaClient): Promise<void> {
  const { rows: N, reuse } = parseArgs(process.argv.slice(2));
  const tableName = `bench-${N}`;
  await db.$connect();

  const [{ version } = { version: "unknown" }] = await db.$queryRaw<
    { version: string }[]
  >`SELECT version() AS version`;

  // --- Setup -------------------------------------------------------------
  const user = await db.user.upsert({
    where: { email: "bench@example.com" },
    update: {},
    create: { name: "bench", email: "bench@example.com" },
  });
  const base =
    (await db.base.findFirst({ where: { ownerId: user.id, name: "bench" } })) ??
    (await db.base.create({ data: { name: "bench", ownerId: user.id } }));

  let table = await db.table.findFirst({
    where: { baseId: base.id, name: tableName },
    include: { columns: { orderBy: { order: "asc" } } },
  });
  let insertSeconds: number | null = null;

  if (table && reuse) {
    const existing = await db.row.count({ where: { tableId: table.id } });
    if (existing !== N) {
      throw new Error(
        `--reuse: table "${tableName}" has ${existing} rows, expected ${N}. Run without --reuse.`,
      );
    }
    console.log(`Reusing table "${tableName}" (${existing} rows).`);
  } else {
    if (table) {
      console.log(`Deleting existing table "${tableName}"...`);
      await dropSortIndexes(db, { tableId: table.id });
      await db.table.delete({ where: { id: table.id } });
    }
    table = await db.table.create({
      data: {
        name: tableName,
        baseId: base.id,
        columns: {
          create: [
            { name: "Name", type: "string", order: 0 },
            { name: "Email", type: "string", order: 1 },
            { name: "Company", type: "string", order: 2 },
            { name: "Score", type: "number", order: 3 },
          ],
        },
        views: { create: { name: "Grid view" } },
      },
      include: { columns: { orderBy: { order: "asc" } } },
    });

    console.log(`Inserting ${N.toLocaleString()} rows into "${tableName}"...`);
    const t0 = performance.now();
    const { inserted } = await insertFakeRows(db, {
      tableId: table.id,
      columns: table.columns.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type as "string" | "number",
      })),
      count: N,
    });
    insertSeconds = (performance.now() - t0) / 1000;
    console.log(
      `Inserted ${inserted.toLocaleString()} rows in ${insertSeconds.toFixed(1)} s (${Math.round(inserted / insertSeconds).toLocaleString()} rows/s)`,
    );
  }

  console.log("ANALYZE...");
  await db.$executeRawUnsafe(`ANALYZE "Row"`);

  const tableId = table.id;
  const cols = table.columns.map(
    (c): ColumnInfo => ({ id: c.id, type: c.type as "string" | "number" }),
  );
  const colId = (name: string) => {
    const c = table.columns.find((x) => x.name === name);
    if (!c) throw new Error(`Missing column ${name}`);
    return c.id;
  };
  const nameCol = cols.find((c) => c.id === colId("Name"))!;
  const scoreCol = cols.find((c) => c.id === colId("Score"))!;
  const nameId = nameCol.id;
  const scoreId = scoreCol.id;

  const base_ = { tableId, columns: cols };
  const page = (
    extra: Partial<RowQuery> & {
      cursor?: RowCursor | null;
      offset?: number;
    } = {},
  ) => ({ ...base_, limit: PAGE_SIZE, ...extra });

  let filterSeq = 0;
  const filter = (
    columnId: string,
    operator: ViewFilter["operator"],
    value: string | number,
  ): ViewFilter => ({ id: `f${++filterSeq}`, columnId, operator, value });

  const scoreGt = filter(scoreId, "gt", 5000);
  const nameContains = filter(nameId, "contains", "ar");

  // A rare term: the full name from a random row.
  const sampleOrder = 1 + Math.floor(Math.random() * N);
  const sample = await db.$queryRaw<{ name: string | null }[]>(
    Prisma.sql`SELECT "data"->>${nameId} AS name FROM "Row" WHERE "tableId" = ${tableId} AND "order" = ${sampleOrder}`,
  );
  const rareTerm = sample[0]?.name;
  if (!rareTerm) throw new Error("Could not pick a random name");

  // Offsets are given for a 1M-row table and scaled down for smaller ones, so
  // the labels show the offset that was actually used.
  const offsetAt = (n: number) => Math.floor((n * N) / 1_000_000);
  const kLabel = (n: number) =>
    n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : String(n);

  const timedPage = (label: string, q: PageQuery) =>
    measure(label, async () => (await queryRows(db, q)).rows.length, q);

  console.log(
    `\n${"Query".padEnd(58)} ${"median ms".padStart(9)} ${"p95 ms".padStart(9)} ${"rows".padStart(8)}`,
  );

  // --- Without sort indexes ---------------------------------------------
  await dropSortIndexes(db, { tableId });

  await timedPage("Unfiltered, first page", page());
  for (const n of [500_000, 990_000]) {
    const offset = offsetAt(n);
    await timedPage(`Unsorted offset ${kLabel(offset)}`, page({ offset }));
  }
  await timedPage(
    "Unfiltered, deep page (cursor at 90% of rows)",
    page({ cursor: { order: Math.floor(N * 0.9), id: "" } }),
  );
  await timedPage('Search "an" (common), first page', page({ search: "an" }));
  await timedPage(
    `Search "${rareTerm}" (rare, full name), first page`,
    page({ search: rareTerm }),
  );
  await timedPage(
    "Filter Score > 5000, first page",
    page({ filters: [scoreGt] }),
  );
  {
    const offset = offsetAt(250_000);
    await timedPage(
      `Filter Score>5000 offset ${kLabel(offset)}`,
      page({ filters: [scoreGt], offset }),
    );
  }
  await timedPage(
    'Filter Name contains "ar", first page',
    page({ filters: [nameContains] }),
  );
  await timedPage(
    "Sort Name asc, first page (no index)",
    page({ sort: { columnId: nameId, direction: "asc" } }),
  );
  await timedPage(
    "Sort Score desc, first page (no index)",
    page({ sort: { columnId: scoreId, direction: "desc" } }),
  );

  // --- Build sort indexes ------------------------------------------------
  const buildSeconds: Record<string, number> = {};
  for (const [label, column, direction] of [
    ["Name asc", nameCol, "asc"],
    ["Score desc", scoreCol, "desc"],
  ] as const) {
    const t0 = performance.now();
    await ensureSortIndex(db, tableId, column, direction);
    buildSeconds[label] = (performance.now() - t0) / 1000;
    console.log(
      `Built sort index ${label}: ${buildSeconds[label].toFixed(1)} s`,
    );
  }
  // Expression indexes have no statistics until the next ANALYZE; autovacuum
  // would do this shortly after the build in a real deployment.
  await db.$executeRawUnsafe(`ANALYZE "Row"`);

  // --- With sort indexes -------------------------------------------------
  const nameAsc = { columnId: nameId, direction: "asc" } as const;
  const scoreDesc = { columnId: scoreId, direction: "desc" } as const;

  const firstSortedPage = page({ sort: nameAsc });
  await timedPage("Sort Name asc, first page (index)", firstSortedPage);

  let cursor: RowCursor | null = null;
  for (let i = 1; i < 50; i++) {
    const res: Awaited<ReturnType<typeof queryRows>> = await queryRows(
      db,
      page({ sort: nameAsc, cursor }),
    );
    cursor = res.nextCursor;
    if (!cursor) throw new Error(`Ran out of rows at page ${i}`);
  }
  await timedPage(
    "Sort Name asc, page 50 (index)",
    page({ sort: nameAsc, cursor }),
  );
  {
    const offset = offsetAt(500_000);
    await timedPage(
      `Sorted (Name asc, indexed) offset ${kLabel(offset)}`,
      page({ sort: nameAsc, offset }),
    );
  }
  await timedPage(
    "Sort Score desc, first page (index)",
    page({ sort: scoreDesc }),
  );
  await timedPage(
    "Filter Score > 5000 + sort Name asc (index), first page",
    page({ filters: [scoreGt], sort: nameAsc }),
  );
  await timedPage(
    'Search "an" + sort Score desc (index), first page',
    page({ search: "an", sort: scoreDesc }),
  );

  await measure("countRows, unfiltered", () => countRows(db, base_));
  await measure("countRows, Score > 5000", () =>
    countRows(db, { ...base_, filters: [scoreGt] }),
  );

  // --- Index usage -------------------------------------------------------
  const expectedIndex = sortIndexName(tableId, nameId, "asc");
  const plan = await explain(db, firstSortedPage);
  const usesIndex = plan.includes(expectedIndex);
  console.log(
    `\nSort Name asc first page uses ${expectedIndex}: ${usesIndex ? "yes" : "NO"}`,
  );
  if (!usesIndex) console.log(plan);

  const slow = results.filter((r) => r.plan !== undefined);
  for (const s of slow) {
    console.log(`\nSLOW (> ${SLOW_MS} ms median): ${s.label}\n${s.plan}`);
  }

  // --- Report ------------------------------------------------------------
  const cpus = os.cpus();
  const doc = renderDoc({
    date: new Date().toISOString().slice(0, 10),
    machine: `${cpus.length} x ${cpus[0]?.model.trim() ?? "unknown CPU"}, ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB RAM (${os.platform()} ${os.release()})`,
    version,
    rows: N,
    insertSeconds,
    buildSeconds,
    expectedIndex,
    usesIndex,
    plan,
    slow,
  });
  writeFileSync(OUT_FILE, doc);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT_FILE)}`);
}

function renderDoc(o: {
  date: string;
  machine: string;
  version: string;
  rows: number;
  insertSeconds: number | null;
  buildSeconds: Record<string, number>;
  expectedIndex: string;
  usesIndex: boolean;
  plan: string;
  slow: Result[];
}): string {
  const insert =
    o.insertSeconds === null
      ? "not measured (existing table reused with `--reuse`)"
      : `${o.insertSeconds.toFixed(1)} s (${Math.round(o.rows / o.insertSeconds).toLocaleString()} rows/s)`;
  const table = results
    .map(
      (r) =>
        `| ${r.label} | ${fmt(r.median)} | ${fmt(r.p95)} | ${r.returned.toLocaleString()} |`,
    )
    .join("\n");
  const builds = Object.entries(o.buildSeconds)
    .map(([k, v]) => `- ${k}: ${v.toFixed(1)} s`)
    .join("\n");
  const slowSection =
    o.slow.length === 0
      ? `No query exceeded ${SLOW_MS} ms median.`
      : o.slow
          .map(
            (s) =>
              `${s.label} exceeded ${SLOW_MS} ms median. Plan:\n\n\`\`\`\n${s.plan}\n\`\`\``,
          )
          .join("\n\n");

  return `# Benchmarks

Generated by \`scripts/bench.ts\`. Do not edit by hand; re-run \`npm run bench\`.

- Date: ${o.date}
- Machine: ${o.machine}
- Postgres: ${o.version}
- Rows: ${o.rows.toLocaleString()} (columns: Name, Email, Company, Score)
- Bulk insert (\`insertFakeRows\`): ${insert}
- Page size: ${PAGE_SIZE}. Each query is run once to warm up, then ${TIMED_RUNS} times; median and p95 of the ${TIMED_RUNS} timed runs.

## Results

| Query | Median (ms) | p95 (ms) | Rows returned |
|---|---:|---:|---:|
${table}

Sort index build time (\`CREATE INDEX CONCURRENTLY\`, ${o.rows.toLocaleString()} rows):

${builds}

The sort-index queries above ran after the indexes were built and \`ANALYZE "Row"\` was re-run.

## Index usage

The plan for "Sort Name asc, first page (index)" ${o.usesIndex ? "uses" : "does NOT use"} the \`${o.expectedIndex}\` index.

\`\`\`
${o.plan}
\`\`\`

## Slow queries

${slowSection}

## Notes

Offset rows are for scrollbar jumps, which have no keyset cursor: the database walks past every skipped row, so the cost grows with the offset (and filtered or sorted offsets must evaluate every skipped row). Sequential pages use keyset conditions and stay at a few milliseconds. The unsorted offset walks the unique \`("tableId", "order")\` index in order, with no sort step.

These are warm-cache numbers from a local machine: Postgres and the benchmark run on the same host, so there is no network hop and the table and indexes are already in memory. A hosted database adds network latency to every request (typically a few to tens of milliseconds per round trip), and a cold cache makes the first query after a restart slower.

## How to reproduce

\`\`\`
npm run bench                    # 1,000,000 rows
npm run bench -- --rows=100000   # a different size
npm run bench -- --reuse         # reuse the existing "bench-<N>" table instead of inserting again
\`\`\`

The script connects to \`BENCH_DATABASE_URL\` (default \`postgresql://postgres@localhost:5433/airtable_bench?host=/tmp\`). The database must already be migrated (\`DATABASE_URL=<bench url> npx prisma migrate deploy\`). It creates a user \`bench@example.com\`, a base \`bench\` and a table \`bench-<N>\`; without \`--reuse\` an existing table of that name is deleted first.
`;
}

async function run(): Promise<void> {
  try {
    await main(db);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void run();
