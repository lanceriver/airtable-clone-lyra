# Phase 1 — Data layer rebuild

Goal: search, filter, sort and infinite scroll stay fast **and correct** on a
1,000,000-row table, with every API call scoped to the signed-in user.

## Why

The original schema stored one `Cell` record per (row, column) and queried
them with correlated subqueries plus `GROUP BY`. Measured on 1M rows / 4M cells
(local Postgres 16, warm cache):

| Query (first page of 500) | Old (Cell table) | New (JSONB, no sort index) | New (JSONB + sort index) |
|---|---|---|---|
| Unfiltered page | fast | 2 ms | 2 ms |
| Global search | 0.7–0.9 s | 4–15 ms (trigram) | — |
| Sort by number | 3.3 s | 205 ms | 4 ms |
| Sort by text | 2.8 s | 160 ms | 3 ms |
| Filter + sort | 2.4 s | 180 ms | 3.5 ms |

The old sorted pagination was also wrong: page 2 contained only 251 of the 501
correct rows.

## Design

### Schema

- `Row`
  - `data jsonb not null default '{}'`: values keyed by column id. Text is a
    JSON string, number is a JSON number. **An empty cell is a missing key**:
    empty strings are never stored.
  - `order int not null`: insertion order within the table, used for the
    default (unsorted) order. Unique index `("tableId", "order")` (made unique in
    Phase 2, task 2.1).
  - `searchText text not null default ''` (`search_text`): maintained by a
    `BEFORE INSERT OR UPDATE OF data` trigger as
    `lower(string_agg(value, chr(31)))` over all values. The unit-separator
    character stops a search from matching across two cells. GIN trigram index
    (`pg_trgm`), declared in `schema.prisma` so Prisma doesn't try to drop it.
- `Cell` table removed. The migration backfills `Row.data` from `Cell` first,
  so existing data survives.
- `Column`: add `order int` (for future reordering). Drop the ability to change
  a column's type (Phase 1).
- `View`: replace `filters Json[]`, `sort Json?`, `visibleColumns`, `columnIds`
  and the implicit `columns` relation with:
  - `filters Json not null default '[]'`: `{ id, columnId, operator, value? }[]`
  - `sort Json?`: `{ columnId, direction: "asc" | "desc" } | null`
  - `hiddenColumnIds String[]`: hidden rather than visible, so new columns
    show up by default.
  - `search String not null default ''`
- Drop denormalised counters (`Table.rowCount`, `Table.colCount`,
  `Base.tableCount`) and the unused `Table.seed`; compute counts with
  queries instead. Keep `Table.activeViewId`.

### Query builder (`src/server/db/rows.ts`)

All row SQL lives in one module and is composed with `Prisma.sql`.

- **Identifiers are inlined, values are parameters.** Table ids and column ids
  are inlined as SQL literals so Postgres can match the partial expression
  indexes. A generic plan with `$1` can't use them. Each inlined id must:
  1. come from the database after the access check (columns are looked up from
     the table, never taken from client input as-is), and
  2. match `/^[a-z0-9]{1,40}$/`, or the builder throws.
- **Expressions** (emitted byte-identically by the query and the index DDL):
  - text value: `lower("data"->>'<col>')`
  - number value: `("data"->>'<col>')::numeric`
  - sort key, text asc: `(CASE WHEN "data" ? '<col>' THEN '0' || lower("data"->>'<col>') ELSE '1' END)`
  - sort key, text desc: `(CASE WHEN "data" ? '<col>' THEN '1' || lower("data"->>'<col>') ELSE '0' END)`
  - sort key, number asc: `COALESCE(("data"->>'<col>')::numeric, 'Infinity'::numeric)`
  - sort key, number desc: `COALESCE(("data"->>'<col>')::numeric, '-Infinity'::numeric)`

  The direction-specific sentinels keep empty cells last in both directions
  while the sort key stays non-null, so keyset comparison is a plain row
  comparison.
- **Filters** (AND-combined):

  | Operator | Types | SQL |
  |---|---|---|
  | `contains` | text | `textExpr LIKE '%' \|\| $v \|\| '%'` (v lower-cased, `%`, `_` and `\` escaped) |
  | `notContains` | text | `NOT ("data" ? '<col>') OR textExpr NOT LIKE …` |
  | `is` | text | `textExpr = lower($v)` |
  | `isNot` | text | `NOT ("data" ? '<col>') OR textExpr <> lower($v)` |
  | `isEmpty` | text, number | `NOT ("data" ? '<col>')` |
  | `isNotEmpty` | text, number | `"data" ? '<col>'` |
  | `gt` / `lt` / `gte` / `lte` / `eq` / `neq` | number | `numExpr > $v::numeric`, etc. (`neq` also matches empty) |

  A filter whose operator needs a value and has none is ignored, as it is in
  Airtable while you're still typing.
- **Search**: `"search_text" LIKE '%' || $q || '%'` (lower-cased, escaped),
  combined with the filters using AND.
- **Pagination**: keyset, with OFFSET only for jumps (added in Phase 2, task
  2.1: `queryRows({ offset })`, exclusive with `cursor`).
  - Unsorted: `ORDER BY "order" ASC`, cursor `{ order, id }`, condition
    `"order" > $o` (`order` is unique per table; the cursor's id is ignored).
  - Sorted asc: `ORDER BY sortKey ASC, "id" ASC`, condition `(sortKey, "id") > ($k, $id)`.
  - Sorted desc: `ORDER BY sortKey DESC, "id" DESC`, condition `(sortKey, "id") < ($k, $id)`.
  - Fetch `limit + 1` rows; if the extra row exists, return a cursor built from
    the **last returned** row (not the extra row) and use strict comparison.
- **Sort indexes**: `ensureSortIndex(tableId, columnId, type, direction)` runs
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS "rs_<tableId>_<columnId>_<a|d>" ON "Row" (<sortKey>, "id") WHERE "tableId" = '<tableId>'`
  (outside any transaction). It's called when a view's sort is saved.
  `dropSortIndexes({ tableId, columnId? })` drops the matching indexes by name
  prefix (from `pg_indexes`). Prisma's drift check ignores expression indexes;
  this was verified.

### Access control (`src/server/api/access.ts`)

`assertBaseAccess`, `assertTableAccess`, `assertColumnAccess` and
`assertViewAccess` each resolve the record up to its base and throw
`NOT_FOUND` unless `base.ownerId === ctx.session.user.id`. Every procedure
calls one of them before touching data. Not-found and forbidden look the same
on purpose.

### Bulk insert (`insertFakeRows`)

One SQL statement per chunk of 25k rows:
`INSERT … SELECT FROM generate_series(…)`. Values are picked at random from
pools generated by faker and passed as array parameters: 1,000 full names,
1,000 companies, 200 email domains, 2,000 lorem words. Number columns get
`floor(random() * 10000)`. Known default column names map to suitable pools,
and any other text column gets random words. `order` continues from the
table's current maximum. The target is 100k rows in a few seconds.

## Tasks

Each task is one commit. A task is done when `npm run typecheck` and
`npm run lint` pass and its listed checks pass.

| # | Task | Depends on |
|---|---|---|
| 1.1 | **Schema and migration.** Apply the schema changes above. Write one hand-checked migration that creates `pg_trgm`, adds the columns, backfills `data`/`order` from `Cell`, converts views (`hiddenColumnIds` = columns not in `visibleColumns`; filters and sort reset to defaults), drops `Cell` and the counters, and creates the trigger and the trigram index. Check: the migration applies cleanly to a copy of the 1M-row benchmark DB and `prisma migrate diff` shows no drift. | — |
| 1.2 | **Query builder** `src/server/db/rows.ts`: identifier guard, expressions, filter/search compiler, keyset pagination, `countRows`, `ensureSortIndex`, `dropSortIndexes`. Add Vitest, with integration tests against `airtable_test` covering: every operator; empty-cell behaviour; walking every page of a sorted asc and desc query over 5k rows (including empties and duplicate values), which must equal a single full `ORDER BY` with no gaps or duplicates; LIKE escaping; rejecting bad identifiers. | 1.1 |
| 1.3 | **Access control** `src/server/api/access.ts`, applied to the base router (update/delete must check ownership). Tests: another user gets `NOT_FOUND`. | 1.1 |
| 1.4 | **Bulk insert** `insertFakeRows(db, { tableId, count })` in `src/server/db/fakeRows.ts`. Check: 100k rows into a 4-column table in under 10 s locally, with more than 50k distinct names. | 1.1 |
| 1.5 | **Row router rewrite**: `getRows` (infinite query: `tableId`, `viewId`, `limit` ≤ 500, `cursor`; reads filters, sort and search from the saved view), `countRows`, `createRow`, `deleteRow`, `updateCell` (validates the type against the column; clearing a value removes the key), `addFakeRows` (count capped at 100k). All go through access checks. Remove `cell.ts`. | 1.2, 1.3, 1.4 |
| 1.6 | **Table, column and view routers**: `createTable` (default columns Name/Email/Company text plus Score number, a default "Grid view" and 50 fake rows, in one transaction apart from the bulk insert), `deleteTable` (drops its sort indexes); `createColumn` (no per-row writes, appends an `order`), `renameColumn`, `deleteColumn` (strips the key in 50k-row batches by `order` range and drops the column's sort indexes; also removes the column from views' filters, sort and hidden list); view `create`/`rename`/`delete` (refuses to delete the last view) and `updateConfig` (filters/sort/hidden/search, validated against the table's columns; calls `ensureSortIndex` when the sort changes). | 1.5 |
| 1.7 | **Frontend adaptation (minimal)**: point the existing UI at the new API so the app works end-to-end. Cells read `row.data[col.id]`, editing calls `row.updateCell`, the filter UI uses the new operator names, and search, sort and hide write through `view.updateConfig`. Remove the 100–500 ms artificial dev delay in `trpc.ts` and the noisy `console.log`s on touched paths. No visual redesign (that's Phases 2–3). | 1.6 |
| 1.8 | **Benchmark script** `scripts/bench.ts` (`npm run bench`): creates a user, base and table, inserts 1M rows through `insertFakeRows`, times the representative queries through the real query builder (unfiltered, search, filter, sort asc/desc first and deep page, filter+sort, count), and writes `docs/benchmarks.md`. | 1.5 |
| 1.9 | **Review and verification** (orchestrator): full diff review, typecheck/lint/tests, drive the app with Playwright against the 1M-row table, open the PR. | all |

## Out of scope for Phase 1

The grid UI rewrite, keyboard navigation, multiple sorts, OR-filters, column
reordering UI, guest login, rate limits and deployment are all left to Phases
2–4.
