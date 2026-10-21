import { faker } from "@faker-js/faker";
import { Prisma, type PrismaClient } from "@prisma/client";

import { allocateOrder } from "./order";

export type FakeColumn = {
  id: string;
  name: string;
  type: "string" | "number";
};

type Kind = "number" | "name" | "first" | "last" | "email" | "company" | "text";

const DEFAULT_CHUNK_SIZE = 25_000;

/** Picks the kind of value to generate for a column. */
function kindOf(col: FakeColumn): Kind {
  if (col.type === "number") return "number";
  switch (col.name.trim().toLowerCase()) {
    case "name":
    case "full name":
    case "fullname":
      return "name";
    case "first name":
    case "firstname":
      return "first";
    case "last name":
    case "lastname":
      return "last";
    case "email":
      return "email";
    case "company":
      return "company";
    default:
      return "text";
  }
}

/**
 * A pool packed into one bytea of fixed-width, space-padded UTF-8 records.
 * Postgres can then pick element i in O(1) with substring(); subscripting a
 * text[] walks the array from the start, which dominated the runtime.
 */
type Packed = { data: Buffer; width: number; size: number };

function pack(values: string[]): Packed {
  const bufs = values.map((v) => Buffer.from(v, "utf8"));
  const width = Math.max(1, ...bufs.map((b) => b.length));
  const data = Buffer.alloc(width * bufs.length, 0x20);
  bufs.forEach((b, i) => b.copy(data, i * width));
  return { data, width, size: bufs.length };
}

type Pools = {
  firstNames: Packed;
  lastNames: Packed;
  /** Same order as the name pools, reduced to [a-z0-9] for use in emails. */
  firstSlugs: Packed;
  lastSlugs: Packed;
  companies: Packed;
  domains: Packed;
  words: Packed;
};

/** Up to `size` unique values; tops up with repeats if faker runs out. */
function pool(gen: () => string, size: number): string[] {
  const seen = new Set<string>();
  for (let i = 0; seen.size < size && i < size * 20; i++) {
    const v = gen().trim();
    if (v) seen.add(v);
  }
  const out = [...seen];
  while (out.length < size) out.push(gen().trim() || "x");
  return out;
}

const slug = (s: string) => {
  const v = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return v || "x";
};

let cachedPools: Pools | undefined;

/** Built once per process from a fixed faker seed. */
function getPools(): Pools {
  if (cachedPools) return cachedPools;
  faker.seed(20261021);
  const firstNames = pool(() => faker.person.firstName(), 1000);
  const lastNames = pool(() => faker.person.lastName(), 1000);
  cachedPools = {
    firstNames: pack(firstNames),
    lastNames: pack(lastNames),
    firstSlugs: pack(firstNames.map(slug)),
    lastSlugs: pack(lastNames.map(slug)),
    companies: pack(pool(() => faker.company.name(), 1000)),
    domains: pack(pool(() => faker.internet.domainName().toLowerCase(), 200)),
    words: pack(pool(() => faker.lorem.word(), 2000)),
  };
  return cachedPools;
}

const rand = (size: number) => Prisma.raw(`1 + floor(random() * ${size})::int`);

/** Element `idx` (a SQL expression, 1-based) of a packed pool, as text. */
const pick = (alias: string, pk: Packed, idx: string) =>
  `rtrim(convert_from(substring(pl.${alias} FROM (${idx}) * ${pk.width} - ${pk.width - 1} FOR ${pk.width}), 'UTF8'))`;

/** SQL expression producing a row's JSONB data; column ids are bound params. */
function buildDataExpr(columns: FakeColumn[]): Prisma.Sql {
  const p = getPools();
  const word = () => pick("wd", p.words, rand(p.words.size).sql);
  const value = (kind: Kind): string => {
    switch (kind) {
      case "number":
        return "floor(random() * 10000)::int";
      case "name":
        return `${pick("fn", p.firstNames, "r.fi")} || ' ' || ${pick("ln", p.lastNames, "r.li")}`;
      case "first":
        return pick("fn", p.firstNames, "r.fi");
      case "last":
        return pick("ln", p.lastNames, "r.li");
      case "email":
        return `${pick("fs", p.firstSlugs, "r.fi")} || '.' || ${pick("ls", p.lastSlugs, "r.li")} || r.en::text || '@' || ${pick("dm", p.domains, "r.di")}`;
      case "company":
        return pick("co", p.companies, "r.ci");
      case "text":
        return `concat_ws(' ', ${word()}, ${word()}, CASE WHEN r.k >= 3 THEN ${word()} END, CASE WHEN r.k >= 4 THEN ${word()} END)`;
    }
  };
  // jsonb_build_object takes at most 100 arguments, so build in groups.
  const groups: Prisma.Sql[] = [];
  for (let i = 0; i < columns.length; i += 40) {
    const args = columns
      .slice(i, i + 40)
      .map(
        (c) =>
          Prisma.sql`${c.id}::text, to_jsonb(${Prisma.raw(`(${value(kindOf(c))})`)})`,
      );
    groups.push(Prisma.sql`jsonb_build_object(${Prisma.join(args)})`);
  }
  return groups.length === 0
    ? Prisma.sql`'{}'::jsonb`
    : Prisma.join(groups, " || ");
}

/**
 * Inserts `count` rows of varied fake data into `tableId`, one transaction and
 * one INSERT ... SELECT per chunk. Values are chosen in SQL, per row, from
 * pools passed as bound array parameters.
 */
export async function insertFakeRows(
  db: PrismaClient,
  opts: {
    tableId: string;
    columns: FakeColumn[];
    count: number;
    chunkSize?: number;
  },
): Promise<{ inserted: number }> {
  const { tableId, columns, count } = opts;
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`insertFakeRows: invalid count ${count}`);
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError(`insertFakeRows: invalid chunkSize ${chunkSize}`);
  }

  const p = getPools();
  const dataExpr = buildDataExpr(columns);

  let inserted = 0;
  while (inserted < count) {
    const n = Math.min(chunkSize, count - inserted);
    await db.$transaction(
      async (tx) => {
        // The trigram index on search_text dominates insert time. Let its
        // pending list absorb the whole chunk and flush it once, sorted, at
        // the end of the transaction instead of every 4MB (about 1.5x faster).
        await tx.$executeRaw`
          SELECT set_config('gin_pending_list_limit', '262144', true),
                 set_config('work_mem', '128MB', true)`;
        const first = await allocateOrder(tx, tableId, n);
        await tx.$executeRaw(Prisma.sql`
          WITH pl AS (
            SELECT ${p.firstNames.data}::bytea AS fn, ${p.lastNames.data}::bytea AS ln,
                   ${p.firstSlugs.data}::bytea AS fs, ${p.lastSlugs.data}::bytea AS ls,
                   ${p.companies.data}::bytea AS co, ${p.domains.data}::bytea AS dm,
                   ${p.words.data}::bytea AS wd
          )
          INSERT INTO "Row" (id, "tableId", "order", data, "updatedAt")
          SELECT
            'r' || lpad(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0')
                || substr(md5(random()::text || g::text), 1, 20),
            ${tableId},
            ${first}::int + g - 1,
            ${dataExpr},
            now()
          FROM pl, generate_series(1, ${n}::int) AS g,
          LATERAL (
            -- Indexes are picked once per row so a name and its email agree.
            -- random() is volatile, so this is evaluated for every row.
            SELECT ${rand(p.firstNames.size)} AS fi,
                   ${rand(p.lastNames.size)} AS li,
                   ${rand(p.companies.size)} AS ci,
                   ${rand(p.domains.size)} AS di,
                   floor(random() * 1000)::int AS en,
                   2 + floor(random() * 3)::int AS k,
                   g AS g2
          ) AS r
        `);
        // Do not leave a long pending list behind: it slows down searches.
        await tx.$executeRaw`
          SELECT gin_clean_pending_list(i)
          FROM (SELECT to_regclass('"Row_search_text_idx"') AS i) AS x
          WHERE i IS NOT NULL`;
      },
      { timeout: 300_000, maxWait: 60_000 },
    );
    inserted += n;
  }
  return { inserted };
}
