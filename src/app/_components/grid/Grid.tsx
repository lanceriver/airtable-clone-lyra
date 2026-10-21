"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RowRecord, ViewSort } from "~/server/db/rows";
import { GridBody } from "./GridBody";
import { GridHeader } from "./GridHeader";
import {
  ADD_FIELD_WIDTH,
  ANCHOR_BLOCK,
  DEFAULT_COLUMN_WIDTH,
  HEADER_HEIGHT,
  MIN_COLUMN_WIDTH,
  PREFETCH_ROWS,
  ROW_HEIGHT,
  ROW_NUMBER_WIDTH,
  ROW_OVERSCAN,
  SCROLL_CAP,
} from "./gridConstants";
import type { GridColumn, GridField } from "./gridTypes";
import { rowLayerShift } from "./scrollScale";
import type { RowPages } from "./useRowPages";
import { useScaledVirtualizer } from "./useScaledVirtualizer";

export type GridProps = {
  tableId: string;
  /** Every field of the table, in table order (hidden ones included). */
  fields: GridField[];
  hiddenColumnIds: string[];
  /** The view's sort, for the sorted column's tint. */
  sort: ViewSort;
  /** Fields that have a filter, for their tint. */
  filteredColumnIds: string[];
  /** The (debounced) search text; matching cells are highlighted. */
  search: string;
  rowPages: RowPages;
  /**
   * The grid scrolls back to the top when this or the row count changes (the
   * filters and sort, as a string).
   */
  scrollResetKey: string;
};

const NO_ROWS: RowRecord[] = [];

/**
 * The read-only grid: sticky header, sticky row-number and primary columns,
 * virtualized rows backed by `useRowPages`. All divs, one scroll container
 * for both axes. The structure is documented in docs/plans/phase-2-grid.md.
 */
export function Grid({
  tableId,
  fields,
  hiddenColumnIds,
  sort,
  filteredColumnIds,
  search,
  rowPages,
  scrollResetKey,
}: GridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // -- Columns (TanStack Table owns the column model) ------------------------
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const columnDefs = useMemo<ColumnDef<RowRecord, unknown>[]>(
    () => fields.map((field) => ({ id: field.id, header: field.name })),
    [fields],
  );
  const columnVisibility = useMemo<VisibilityState>(
    () => Object.fromEntries(hiddenColumnIds.map((id) => [id, false])),
    [hiddenColumnIds],
  );
  // Rows come from the page store by index, so the table has no row data.
  const table = useReactTable({
    data: NO_ROWS,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility, columnSizing },
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    defaultColumn: { size: DEFAULT_COLUMN_WIDTH, minSize: MIN_COLUMN_WIDTH },
  });

  const fieldById = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );
  const visibleColumns = table.getVisibleLeafColumns();
  const columns = useMemo<GridColumn[]>(
    () =>
      visibleColumns.map((column, i) => {
        const field = fieldById.get(column.id);
        return {
          id: column.id,
          name: field?.name ?? "",
          type: field?.type ?? "string",
          width: column.getSize(),
          isPrimary: i === 0,
          sortDirection: sort?.columnId === column.id ? sort.direction : null,
          filtered: filteredColumnIds.includes(column.id),
          column,
        };
      }),
    // `columnSizing` is what `getSize()` reads its widths from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleColumns, columnSizing, fieldById, sort, filteredColumnIds],
  );
  const rowWidth =
    ROW_NUMBER_WIDTH +
    columns.reduce((sum, column) => sum + column.width, 0) +
    ADD_FIELD_WIDTH;

  // -- Rows -------------------------------------------------------------------
  const { total, getRow, ensureRange } = rowPages;
  const { virtualizer, scale } = useScaledVirtualizer({
    scrollRef,
    count: total ?? 0,
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
    // The header is in the scroll container too: keep scrollHeight within the cap.
    cap: SCROLL_CAP - HEADER_HEIGHT,
    overscan: ROW_OVERSCAN,
  });

  // Read after getVirtualItems(), which brings `range` up to date.
  const virtualItems =
    total === undefined ? undefined : virtualizer.getVirtualItems();

  // Fetch what's visible plus about a page on each side.
  const range = virtualizer.range;
  const firstVisible = range?.startIndex;
  const lastVisible = range?.endIndex;
  useEffect(() => {
    if (!total || firstVisible === undefined || lastVisible === undefined) {
      return;
    }
    ensureRange(
      Math.max(0, firstVisible - PREFETCH_ROWS),
      Math.min(total - 1, lastVisible + PREFETCH_ROWS),
    );
  }, [ensureRange, total, firstVisible, lastVisible]);

  // A different result set starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [total, scrollResetKey]);

  const virtualOffset = virtualizer.scrollOffset ?? 0;
  const firstItem = virtualItems?.[0];
  const anchorIndex = firstItem
    ? Math.floor(firstItem.index / ANCHOR_BLOCK) * ANCHOR_BLOCK
    : 0;

  const searchLower = search.toLowerCase();

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-rowcount={(total ?? 0) + 1}
      aria-colcount={columns.length + 1}
      data-testid="grid-scroller"
      data-hscrolled="false"
      className="group/grid relative h-full w-full overflow-auto bg-white text-[13px] leading-[18px] text-[#1d1f25]"
      style={{ overscrollBehavior: "contain" }}
      onScroll={(event) => {
        // A data attribute drives the divider on the primary column with CSS,
        // so horizontal scrolling doesn't re-render any row.
        const element = event.currentTarget;
        const scrolled = element.scrollLeft > 0 ? "true" : "false";
        if (element.dataset.hscrolled !== scrolled) {
          element.dataset.hscrolled = scrolled;
        }
      }}
    >
      <GridHeader tableId={tableId} columns={columns} width={rowWidth} />
      <GridBody
        virtualItems={virtualItems}
        spacerHeight={scale.spacerHeight}
        anchorIndex={anchorIndex}
        layerShift={rowLayerShift(scale, virtualOffset)}
        columns={columns}
        width={rowWidth}
        getRow={getRow}
        searchLower={searchLower}
      />
    </div>
  );
}
