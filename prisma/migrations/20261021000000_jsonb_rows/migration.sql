-- Move row values from the "Cell" table into a JSONB column on "Row", add
-- trigram search, and simplify views. Existing data is preserved:
--   * Row.data     <- Cell values keyed by columnId (empty cells are omitted)
--   * Row."order"  <- insertion order within the table
--   * Column.order <- creation order within the table
--   * views        <- hiddenColumnIds derived from visibleColumns; filters/sort reset
--
-- Prisma does not track functions or triggers; row_search_text_trg is
-- intentionally managed only by this migration.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Search helpers. Values are joined with the unit separator (chr(31)) so a
-- search cannot match across two cells.
CREATE OR REPLACE FUNCTION row_search_text(d jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(lower(string_agg(value, chr(31))), '') FROM jsonb_each_text(d)
$$;

CREATE OR REPLACE FUNCTION row_set_search_text() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.search_text := row_search_text(NEW.data); RETURN NEW; END $$;

-- Column.order
ALTER TABLE "Column" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

UPDATE "Column" c
SET "order" = o.rn
FROM (
  SELECT id, (row_number() OVER (PARTITION BY "tableId" ORDER BY "createdAt", id) - 1)::int AS rn
  FROM "Column"
) o
WHERE c.id = o.id;

-- Row.data / Row."order" / Row.search_text
ALTER TABLE "Row"
  ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "order" INTEGER,
  ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';

-- Set-based backfill in a single pass over "Row". The trigger does not exist
-- yet, so search_text is computed here instead of in a second UPDATE.
-- Empty cells (null or empty string, and no number) are skipped.
UPDATE "Row" r
SET "data" = s.d,
    "order" = s.rn,
    "search_text" = row_search_text(s.d)
FROM (
  SELECT r2.id,
         coalesce(a.d, '{}'::jsonb) AS d,
         row_number() OVER (PARTITION BY r2."tableId" ORDER BY r2."createdAt", r2.id)::int AS rn
  FROM "Row" r2
  LEFT JOIN (
    SELECT "rowId",
           jsonb_object_agg(
             "columnId",
             CASE WHEN "stringValue" IS NOT NULL AND "stringValue" <> ''
                  THEN to_jsonb("stringValue")
                  ELSE to_jsonb("numberValue")
             END
           ) AS d
    FROM "Cell"
    WHERE ("stringValue" IS NOT NULL AND "stringValue" <> '') OR "numberValue" IS NOT NULL
    GROUP BY "rowId"
  ) a ON a."rowId" = r2.id
) s
WHERE r.id = s.id;

ALTER TABLE "Row" ALTER COLUMN "order" SET NOT NULL;

-- Views: hiddenColumnIds = the table's columns that were not in visibleColumns
-- (a NULL visibleColumns meant nothing was hidden). Old filters and sort are
-- reset to defaults.
ALTER TABLE "views"
  ADD COLUMN "hiddenColumnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "search" TEXT NOT NULL DEFAULT '';

UPDATE "views" v
SET "hiddenColumnIds" = coalesce(
  (
    SELECT array_agg(c.id ORDER BY c."order", c.id)
    FROM "Column" c
    WHERE c."tableId" = v."tableId"
      AND v."visibleColumns" IS NOT NULL
      AND NOT (c.id = ANY (v."visibleColumns"))
  ),
  ARRAY[]::TEXT[]
);

UPDATE "views" SET "sort" = NULL;

ALTER TABLE "views"
  DROP COLUMN "filters",
  ADD COLUMN "filters" JSONB NOT NULL DEFAULT '[]',
  DROP COLUMN "columnIds",
  DROP COLUMN "visibleColumns";

-- Drop the old structures
DROP TABLE "_ViewColumns";
DROP TABLE "Cell";

ALTER TABLE "Base" DROP COLUMN "tableCount";
ALTER TABLE "Table"
  DROP COLUMN "colCount",
  DROP COLUMN "rowCount",
  DROP COLUMN "seed";

-- Keep search_text in sync from now on
CREATE TRIGGER row_search_text_trg
  BEFORE INSERT OR UPDATE OF "data" ON "Row"
  FOR EACH ROW EXECUTE FUNCTION row_set_search_text();

-- CreateIndex
CREATE INDEX "Row_tableId_order_idx" ON "Row"("tableId", "order");

-- CreateIndex
CREATE INDEX "Row_search_text_idx" ON "Row" USING GIN ("search_text" gin_trgm_ops);

ANALYZE "Row";
