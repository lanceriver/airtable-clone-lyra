/**
 * Row query builder: filters, search, sorting and keyset pagination over the
 * JSONB `Row.data` column. See docs/plans/phase-1-data-layer.md.
 *
 * Values are always bound parameters. The table id and column ids are inlined
 * as SQL literals (after `assertSafeId`) so Postgres can match the partial
 * expression indexes created by `ensureSortIndex`, which a generic `$n` plan
 * cannot do.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

type Db = PrismaClient | Prisma.TransactionClient;

export type ColumnType = "string" | "number";
export type ColumnInfo = { id: string; type: ColumnType };

export const filterOperatorSchema = z.enum([
  "contains",
  "notContains",
  "is",
  "isNot",
  "isEmpty",
  "isNotEmpty",
  "eq",
  "neq",
  "gt",
  "lt",
  "gte",
  "lte",
]);
export type FilterOperator = z.infer<typeof filterOperatorSchema>;

export const TEXT_OPERATORS: FilterOperator[] = [
  "contains",
  "notContains",
  "is",
  "isNot",
  "isEmpty",
  "isNotEmpty",
];
export const NUMBER_OPERATORS: FilterOperator[] = [
  "eq",
  "neq",
  "gt",
  "lt",
  "gte",
  "lte",
  "isEmpty",
  "isNotEmpty",
];

export const viewFilterSchema = z.object({
  id: z.string(),
  columnId: z.string(),
  operator: filterOperatorSchema,
  value: z.union([z.string(), z.number()]).nullish(),
});
export type ViewFilter = z.infer<typeof viewFilterSchema>;

export const viewSortSchema = z
  .object({ columnId: z.string(), direction: z.enum(["asc", "desc"]) })
  .nullable();
export type ViewSort = z.infer<typeof viewSortSchema>;

export const rowCursorSchema = z.union([
  z.object({ order: z.number().int(), id: z.string() }),
  z.object({ key: z.string(), id: z.string() }),
]);
export type RowCursor = z.infer<typeof rowCursorSchema>;

/** Largest `offset` accepted by `queryRows` and `row.getRows`. */
export const MAX_ROW_OFFSET = 10_000_000;

export const rowOffsetSchema = z.number().int().min(0).max(MAX_ROW_OFFSET);

export type RowRecord = {
  id: string;
  order: number;
  data: Record<string, string | number>;
};

export type RowQuery = {
  tableId: string;
  columns: ColumnInfo[];
  filters?: ViewFilter[];
  sort?: ViewSort;
  search?: string;
};

type Direction = "asc" | "desc";

const SAFE_ID = /^[a-z0-9]{1,40}$/;

/** Throws unless `id` is safe to inline into SQL as a string literal. */
export function assertSafeId(id: string): string {
  if (typeof id !== "string" || !SAFE_ID.test(id)) {
    throw new Error(`Unsafe identifier: ${JSON.stringify(id)}`);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Expressions. Index DDL and queries share these so the text is identical.
// ---------------------------------------------------------------------------

function lit(id: string): string {
  return `'${assertSafeId(id)}'`;
}

function hasExpr(col: string): string {
  return `("data" ? ${lit(col)})`;
}

function textExpr(col: string): string {
  return `lower("data"->>${lit(col)})`;
}

function numExpr(col: string): string {
  return `("data"->>${lit(col)})::numeric`;
}

function sortKeyExpr(column: ColumnInfo, direction: Direction): string {
  const c = lit(column.id);
  if (column.type === "number") {
    const sentinel = direction === "asc" ? "'Infinity'" : "'-Infinity'";
    return `COALESCE(("data"->>${c})::numeric, ${sentinel}::numeric)`;
  }
  const [present, absent] = direction === "asc" ? ["0", "1"] : ["1", "0"];
  return `(CASE WHEN ${hasExpr(column.id)} THEN '${present}' || lower("data"->>${c}) ELSE '${absent}' END)`;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

function likePattern(s: string): string {
  return `%${escapeLike(s.toLowerCase())}%`;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const NUMERIC_OPS: Record<string, string> = {
  eq: "=",
  gt: ">",
  lt: "<",
  gte: ">=",
  lte: "<=",
};

function filterToSql(
  f: ViewFilter,
  col: ColumnInfo | undefined,
): Prisma.Sql | null {
  if (!col) return null;
  const valid = col.type === "number" ? NUMBER_OPERATORS : TEXT_OPERATORS;
  if (!valid.includes(f.operator)) return null;

  const has = Prisma.raw(hasExpr(col.id));
  if (f.operator === "isEmpty") return Prisma.sql`NOT ${has}`;
  if (f.operator === "isNotEmpty") return has;

  const raw = f.value;
  if (raw === null || raw === undefined || raw === "") return null;

  if (col.type === "number") {
    const n = typeof raw === "number" ? raw : Number(raw.trim());
    if (typeof raw === "string" && raw.trim() === "") return null;
    if (!Number.isFinite(n)) return null;
    const v = String(n);
    const num = Prisma.raw(numExpr(col.id));
    if (f.operator === "neq") {
      return Prisma.sql`(NOT ${has} OR ${num} <> ${v}::numeric)`;
    }
    const op = NUMERIC_OPS[f.operator];
    if (!op) return null;
    return Prisma.sql`${num} ${Prisma.raw(op)} ${v}::numeric`;
  }

  const text = Prisma.raw(textExpr(col.id));
  const value = String(raw);
  switch (f.operator) {
    case "contains":
      return Prisma.sql`${text} LIKE ${likePattern(value)}`;
    case "notContains":
      return Prisma.sql`(NOT ${has} OR ${text} NOT LIKE ${likePattern(value)})`;
    case "is":
      return Prisma.sql`${text} = ${value.toLowerCase()}`;
    case "isNot":
      return Prisma.sql`(NOT ${has} OR ${text} <> ${value.toLowerCase()})`;
    default:
      return null;
  }
}

function buildConditions(q: RowQuery): Prisma.Sql[] {
  const tableId = assertSafeId(q.tableId);
  // Validate every column id up front, even ones no filter refers to.
  for (const c of q.columns) assertSafeId(c.id);
  const byId = new Map(q.columns.map((c) => [c.id, c]));

  const conditions: Prisma.Sql[] = [
    Prisma.sql`"tableId" = ${Prisma.raw(lit(tableId))}`,
  ];
  for (const f of q.filters ?? []) {
    const sql = filterToSql(f, byId.get(f.columnId));
    if (sql) conditions.push(sql);
  }
  const search = q.search?.trim();
  if (search) {
    conditions.push(Prisma.sql`"search_text" LIKE ${likePattern(search)}`);
  }
  return conditions;
}

function where(conditions: Prisma.Sql[]): Prisma.Sql {
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const NUMERIC_TEXT = /^-?(?:Infinity|\d+(?:\.\d*)?|\.\d+)$/;

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(500, Math.max(1, Math.floor(limit)));
}

export type PageQuery = RowQuery & {
  limit: number;
  /** Continue after this row (keyset). Exclusive with `offset`. */
  cursor?: RowCursor | null;
  /**
   * Skip this many matching rows (for a jump that has no cursor). Exclusive
   * with `cursor`. Cost grows with the offset: use keyset pages when possible.
   */
  offset?: number;
};

/**
 * Validates `offset` and its exclusivity with `cursor`. Returns the offset to
 * apply, or null for a keyset/first page.
 */
function resolveOffset(q: PageQuery): number | null {
  if (q.offset === undefined || q.offset === null) return null;
  if (q.cursor) {
    throw new Error("queryRows: cursor and offset are mutually exclusive");
  }
  const parsed = rowOffsetSchema.safeParse(q.offset);
  if (!parsed.success) {
    throw new RangeError(
      `queryRows: offset must be an integer from 0 to ${MAX_ROW_OFFSET}, got ${String(q.offset)}`,
    );
  }
  return parsed.data;
}

/** Builds the page query (fetches `limit + 1` rows). Exported for tests. */
export function buildRowsQuery(q: PageQuery): Prisma.Sql {
  const conditions = buildConditions(q);
  const limit = clampLimit(q.limit);
  const offset = resolveOffset(q);
  const cursor = q.cursor ?? null;
  const skip = offset === null ? Prisma.empty : Prisma.sql`OFFSET ${offset} `;

  const sortCol = q.sort
    ? q.columns.find((c) => c.id === q.sort!.columnId)
    : undefined;

  if (!q.sort || !sortCol) {
    if (offset !== null && offset > 0 && conditions.length === 1) {
      // Unfiltered jump: find the page's first "order" with an index-only scan
      // (it never touches the heap for the skipped rows), then read the page
      // from there. About 4x faster than OFFSET over full rows at 1M rows,
      // because the skipped rows' heap pages are not fetched. A filter needs
      // the row's data to evaluate, so filtered views use the plain OFFSET.
      // Past the end the subquery is NULL and no rows match.
      const tableCond = conditions[0]!;
      return Prisma.sql`SELECT "id", "order", "data" FROM "Row" WHERE ${tableCond} AND "order" >= (SELECT "order" FROM "Row" WHERE ${tableCond} ORDER BY "order" ASC OFFSET ${offset} LIMIT 1) ORDER BY "order" ASC LIMIT ${limit + 1}`;
    }
    if (cursor && "order" in cursor && typeof cursor.order === "number") {
      // "order" is unique per table (see the unique_row_order migration), so
      // it alone is a total order: the unique index serves both the filter and
      // the ORDER BY, with no sort step. The cursor's id is not needed.
      conditions.push(Prisma.sql`"order" > ${cursor.order}`);
    }
    return Prisma.sql`SELECT "id", "order", "data" FROM "Row" ${where(conditions)} ORDER BY "order" ASC ${skip}LIMIT ${limit + 1}`;
  }

  const dir = q.sort.direction;
  const key = Prisma.raw(sortKeyExpr(sortCol, dir));
  const cast = Prisma.raw(sortCol.type === "number" ? "numeric" : "text");
  if (
    cursor &&
    "key" in cursor &&
    typeof cursor.key === "string" &&
    (sortCol.type === "string" || NUMERIC_TEXT.test(cursor.key))
  ) {
    const cmp = Prisma.raw(dir === "asc" ? ">" : "<");
    conditions.push(
      Prisma.sql`(${key}, "id") ${cmp} (${cursor.key}::${cast}, ${cursor.id})`,
    );
  }
  const d = Prisma.raw(dir === "asc" ? "ASC" : "DESC");
  return Prisma.sql`SELECT "id", "order", "data", (${key})::text AS sort_key FROM "Row" ${where(conditions)} ORDER BY ${key} ${d}, "id" ${d} ${skip}LIMIT ${limit + 1}`;
}

type RawRow = RowRecord & { sort_key?: string };

export async function queryRows(
  db: Db,
  q: PageQuery,
): Promise<{ rows: RowRecord[]; nextCursor: RowCursor | null }> {
  const limit = clampLimit(q.limit);
  const sorted = !!q.sort && q.columns.some((c) => c.id === q.sort!.columnId);
  const result = await db.$queryRaw<RawRow[]>(buildRowsQuery(q));

  const hasMore = result.length > limit;
  const page = hasMore ? result.slice(0, limit) : result;
  const last = page[page.length - 1];
  let nextCursor: RowCursor | null = null;
  if (hasMore && last) {
    nextCursor = sorted
      ? { key: last.sort_key ?? "", id: last.id }
      : { order: last.order, id: last.id };
  }
  const rows = page.map(({ id, order, data }) => ({ id, order, data }));
  return { rows, nextCursor };
}

export async function countRows(db: Db, q: RowQuery): Promise<number> {
  const sql = Prisma.sql`SELECT count(*)::int AS count FROM "Row" ${where(buildConditions(q))}`;
  const result = await db.$queryRaw<{ count: number }[]>(sql);
  return result[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Sort indexes
// ---------------------------------------------------------------------------

export function sortIndexName(
  tableId: string,
  columnId: string,
  direction: Direction,
): string {
  const name = `rs_${assertSafeId(tableId)}_${assertSafeId(columnId)}_${direction === "asc" ? "a" : "d"}`;
  if (name.length > 63) {
    throw new Error(`Index name too long: ${name}`);
  }
  return name;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Creates the partial expression index backing a sorted view. Uses
 * CREATE INDEX CONCURRENTLY, so it must not run inside a transaction.
 */
export async function ensureSortIndex(
  db: PrismaClient,
  tableId: string,
  column: ColumnInfo,
  direction: Direction,
): Promise<void> {
  const name = sortIndexName(tableId, column.id, direction);

  // A failed concurrent build leaves an INVALID index behind; rebuild it.
  const existing = await db.$queryRaw<{ valid: boolean }[]>(
    Prisma.sql`SELECT i.indisvalid AS valid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ${name}`,
  );
  if (existing.some((r) => !r.valid)) {
    await db.$executeRawUnsafe(
      `DROP INDEX CONCURRENTLY IF EXISTS ${quoteIdent(name)}`,
    );
  }

  await db.$executeRawUnsafe(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${quoteIdent(name)} ON "Row" (${sortKeyExpr(column, direction)}, "id") WHERE "tableId" = ${lit(tableId)}`,
  );
}

/** Drops the sort indexes of a table, or of one column of it. */
export async function dropSortIndexes(
  db: Db,
  opts: { tableId: string; columnId?: string },
): Promise<void> {
  const prefix =
    opts.columnId === undefined
      ? `rs_${assertSafeId(opts.tableId)}_`
      : `rs_${assertSafeId(opts.tableId)}_${assertSafeId(opts.columnId)}_`;
  const found = await db.$queryRaw<{ indexname: string }[]>(
    Prisma.sql`SELECT indexname FROM pg_indexes WHERE tablename = 'Row' AND starts_with(indexname, ${prefix})`,
  );
  for (const { indexname } of found) {
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${quoteIdent(indexname)}`);
  }
}
