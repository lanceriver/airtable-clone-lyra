"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";

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
import {
  GridSelectionContext,
  useGridState,
  type GridSelectionValue,
} from "./gridSelection";
import type { GridColumn, GridField } from "./gridTypes";
import {
  rowLayerShift,
  scrollLeftToRevealColumn,
  scrollTopToRevealRow,
} from "./scrollScale";
import { useGridKeyboard } from "./useGridKeyboard";
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
  /**
   * Delete / Backspace on the selected cell. The editing task implements the
   * clearing; the grid only reports which cell.
   */
  onClearCell?: (rowIndex: number, columnId: string) => void;
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
  onClearCell,
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

  // -- Selection and keyboard ---------------------------------------------------
  const rowCount = total ?? 0;
  const colCount = columns.length;
  const [selection, dispatch] = useGridState(rowCount, colCount);
  const { active, editing } = selection;

  // Filtering, searching or hiding fields can leave the cell outside the table.
  useEffect(() => {
    dispatch({ type: "clamp" });
  }, [dispatch, rowCount, colCount]);
  // A different result set (the page cache is rebuilt) or table: the row
  // indexes mean something else now.
  useEffect(() => {
    dispatch({ type: "clear" });
  }, [dispatch, tableId, scrollResetKey, search]);

  const canEdit = useCallback(
    (rowIndex: number) => getRow(rowIndex) !== undefined,
    [getRow],
  );
  const clearCell = useCallback(
    (rowIndex: number, col: number) => {
      const columnId = columns[col]?.id;
      if (columnId !== undefined) onClearCell?.(rowIndex, columnId);
    },
    [columns, onClearCell],
  );
  const onKeyDown = useGridKeyboard({
    state: selection,
    dispatch,
    canEdit,
    clearCell,
  });

  // Click selects, double-click edits. Delegated: cells have no handlers.
  const cellAt = (target: EventTarget): { row: number; col: number } | null => {
    if (!(target instanceof Element)) return null;
    const rowElement = target.closest<HTMLElement>("[data-row-index]");
    if (!rowElement) return null;
    const row = Number(rowElement.dataset.rowIndex);
    const cell = target.closest<HTMLElement>("[data-col-index]");
    if (cell) return { row, col: Number(cell.dataset.colIndex) };
    // The row number selects the row's first field.
    return target.closest('[role="rowheader"]') ? { row, col: 0 } : null;
  };
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const cell = cellAt(event.target);
    if (cell) dispatch({ type: "select", ...cell });
  };
  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const cell = cellAt(event.target);
    if (!cell) return;
    dispatch({ type: "select", ...cell });
    if (canEdit(cell.row)) dispatch({ type: "startEdit" });
  };

  // Clicking outside the grid finishes an edit (and keeps the selection).
  useEffect(() => {
    if (!editing) return;
    const onOutsideMouseDown = (event: globalThis.MouseEvent) => {
      const scroller = scrollRef.current;
      if (
        scroller &&
        event.target instanceof Node &&
        !scroller.contains(event.target)
      ) {
        dispatch({ type: "commitEdit", move: null });
      }
    };
    document.addEventListener("mousedown", onOutsideMouseDown);
    return () => document.removeEventListener("mousedown", onOutsideMouseDown);
  }, [editing, dispatch]);

  // Scroll the selected cell into view whenever it changes.
  const latest = useRef({ columns, scale });
  useLayoutEffect(() => {
    latest.current = { columns, scale };
  });
  const previousCol = useRef<number | null>(null);
  const activeRow = active?.row ?? null;
  const activeCol = active?.col ?? null;
  useLayoutEffect(() => {
    const element = scrollRef.current;
    const columnChanged = previousCol.current !== activeCol;
    previousCol.current = activeCol;
    if (!element || activeRow === null || activeCol === null) return;
    const { columns: cols, scale: currentScale } = latest.current;
    const top = scrollTopToRevealRow(
      currentScale,
      element.scrollTop,
      activeRow,
      ROW_HEIGHT,
    );
    let left = element.scrollLeft;
    const column = cols[activeCol];
    if (column && activeCol === 0) {
      // The primary column is sticky; going back to it (Home, Tab wrapping)
      // brings the row's start back into view.
      if (columnChanged) left = 0;
    } else if (column) {
      const cellLeft =
        ROW_NUMBER_WIDTH +
        cols.slice(0, activeCol).reduce((sum, c) => sum + c.width, 0);
      left = scrollLeftToRevealColumn({
        cellLeft,
        cellWidth: column.width,
        stickyWidth: ROW_NUMBER_WIDTH + (cols[0]?.width ?? 0),
        scrollLeft: element.scrollLeft,
        clientWidth: element.clientWidth,
      });
    }
    if (top !== element.scrollTop || left !== element.scrollLeft) {
      element.scrollTo({ top, left });
    }
  }, [activeRow, activeCol]);

  const activeColumn = activeCol === null ? null : (columns[activeCol] ?? null);
  const selectionValue = useMemo<GridSelectionValue>(
    () => ({
      state: selection,
      dispatch,
      rowCount,
      colCount,
      columns,
      activeColumn,
      scrollerRef: scrollRef,
      focusGrid: () => scrollRef.current?.focus({ preventScroll: true }),
      clearCell: (rowIndex, columnId) => onClearCell?.(rowIndex, columnId),
    }),
    [
      selection,
      dispatch,
      rowCount,
      colCount,
      columns,
      activeColumn,
      onClearCell,
    ],
  );

  const virtualOffset = virtualizer.scrollOffset ?? 0;
  const firstItem = virtualItems?.[0];
  const anchorIndex = firstItem
    ? Math.floor(firstItem.index / ANCHOR_BLOCK) * ANCHOR_BLOCK
    : 0;

  const searchLower = search.toLowerCase();

  return (
    <GridSelectionContext.Provider value={selectionValue}>
      <div
        ref={scrollRef}
        role="grid"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        aria-rowcount={(total ?? 0) + 1}
        aria-colcount={columns.length + 1}
        data-testid="grid-scroller"
        data-hscrolled="false"
        className="group/grid relative h-full w-full overflow-auto bg-white text-[13px] leading-[18px] text-[#1d1f25] outline-none select-none"
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
          activeRow={activeRow}
          activeColumnId={activeColumn?.id ?? null}
          editing={editing}
        />
      </div>
    </GridSelectionContext.Provider>
  );
}
