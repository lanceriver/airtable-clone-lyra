-- Make "order" unique per table. allocateOrder already hands out distinct
-- values under an advisory lock, so this normally changes nothing; the unique
-- index lets unsorted pages order by "order" alone (index-only, no sort step),
-- which keeps OFFSET pages for scrollbar jumps fast.

-- Defensive: if any table has duplicate orders, renumber its rows 1..n in
-- their current order ("order", then id). A no-op when there are none.
UPDATE "Row" r
SET "order" = o.rn
FROM (
  SELECT id,
         row_number() OVER (PARTITION BY "tableId" ORDER BY "order", id)::int AS rn
  FROM "Row"
  WHERE "tableId" IN (
    SELECT "tableId" FROM "Row" GROUP BY "tableId", "order" HAVING count(*) > 1
  )
) o
WHERE r.id = o.id AND r."order" <> o.rn;

-- DropIndex
DROP INDEX "Row_tableId_order_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Row_tableId_order_key" ON "Row"("tableId", "order");
