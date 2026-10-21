import { memo } from "react";

import type { RowRecord } from "~/server/db/rows";
import { GridCell } from "./GridCell";
import { ROW_HEIGHT, ROW_NUMBER_WIDTH } from "./gridConstants";
import type { GridColumn } from "./gridTypes";

export type GridRowProps = {
  index: number;
  /** Vertical position inside the rows layer, in px (see GridBody). */
  top: number;
  /** The row, or undefined while its page is loading (shimmer cells). */
  row: RowRecord | undefined;
  columns: GridColumn[];
  /** Full width of the row, so sticky cells have room to stick. */
  width: number;
  /** Lower-cased search text, or "". */
  searchLower: string;
};

/**
 * One row of the grid. Memoized: it re-renders only when its row, the
 * columns, the width or the search change, not on scroll or unrelated state.
 * `top` is relative to the rows layer, which GridBody moves on scroll.
 */
export const GridRow = memo(function GridRow({
  index,
  top,
  row,
  columns,
  width,
  searchLower,
}: GridRowProps) {
  const loaded = row !== undefined;
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      data-row-index={index}
      className="absolute left-0 top-0 flex"
      style={{
        width,
        height: ROW_HEIGHT,
        transform: `translateY(${top}px)`,
      }}
    >
      <div
        role="rowheader"
        className={`sticky left-0 z-10 box-border flex h-8 flex-none items-center border-b border-r border-[#dfe2e4] bg-white px-2 text-left text-[12px] text-[#666]`}
        style={{ width: ROW_NUMBER_WIDTH }}
      >
        {index + 1}
      </div>
      {columns.map((column, columnIndex) => (
        <GridCell
          key={column.id}
          column={column}
          value={row?.data[column.id]}
          loaded={loaded}
          searchLower={searchLower}
          rowIndex={index}
          columnIndex={columnIndex}
        />
      ))}
    </div>
  );
});
