import type { VirtualItem } from "@tanstack/react-virtual";

import type { RowRecord } from "~/server/db/rows";
import { GridRow } from "./GridRow";
import { ROW_HEIGHT, SKELETON_ROWS } from "./gridConstants";
import type { GridColumn } from "./gridTypes";

type GridBodyProps = {
  /** Rows to render; `undefined` while the first count is loading. */
  virtualItems: VirtualItem[] | undefined;
  /** Height of the spacer that gives the scroll container its scroll range. */
  spacerHeight: number;
  /**
   * Index of the row at the top of the rows layer. Rows are placed relative
   * to it, so no element sits at a huge coordinate (the browser would count
   * it in the scroll height). It changes every `ANCHOR_BLOCK` rows.
   */
  anchorIndex: number;
  /**
   * How far the rows layer moves down inside the spacer, on top of
   * `anchorIndex`. Zero for tables under the scale cap; otherwise it keeps
   * rows pixel-exact (see scrollScale.ts).
   */
  layerShift: number;
  columns: GridColumn[];
  width: number;
  getRow: (index: number) => RowRecord | undefined;
  searchLower: string;
  /** The selected cell, if any, and whether it is being edited. */
  activeRow: number | null;
  activeColumnId: string | null;
  editing: boolean;
};

/**
 * The body spacer and the layer of rendered rows. Scrolling only moves the
 * layer, so memoized rows don't re-render. Row `i` is drawn at
 * `anchorIndex * 32 + layerShift + (i - anchorIndex) * 32` in the spacer.
 */
export function GridBody({
  virtualItems,
  spacerHeight,
  anchorIndex,
  layerShift,
  columns,
  width,
  getRow,
  searchLower,
  activeRow,
  activeColumnId,
  editing,
}: GridBodyProps) {
  if (virtualItems === undefined) {
    // First load: header is already there, rows shimmer.
    return (
      <div
        role="rowgroup"
        aria-busy="true"
        data-testid="grid-skeleton"
        className="relative"
        style={{ width, height: SKELETON_ROWS * ROW_HEIGHT }}
      >
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <GridRow
            key={index}
            index={index}
            top={index * ROW_HEIGHT}
            row={undefined}
            columns={columns}
            width={width}
            searchLower=""
            activeColumnId={null}
            editing={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="rowgroup"
      data-testid="grid-body"
      className="relative"
      style={{ width, height: spacerHeight }}
    >
      <div
        className="absolute top-0 left-0 w-full will-change-transform"
        style={{
          transform: `translateY(${anchorIndex * ROW_HEIGHT + layerShift}px)`,
        }}
      >
        {virtualItems.map((item) => (
          <GridRow
            key={item.index}
            index={item.index}
            top={(item.index - anchorIndex) * ROW_HEIGHT}
            row={getRow(item.index)}
            columns={columns}
            width={width}
            searchLower={searchLower}
            activeColumnId={item.index === activeRow ? activeColumnId : null}
            editing={item.index === activeRow && editing}
          />
        ))}
      </div>
    </div>
  );
}
