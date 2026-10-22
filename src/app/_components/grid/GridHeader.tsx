"use client";

import { ArrowDown, ArrowUp, Filter, Hash, Type } from "lucide-react";
import { useState } from "react";

import { AddFieldPopover } from "./AddFieldPopover";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { FieldMenu } from "./FieldMenu";
import { PRIMARY_BORDER_CLASS, PRIMARY_SHADOW_CLASS } from "./GridCell";
import {
  ADD_FIELD_WIDTH,
  HEADER_HEIGHT,
  ROW_NUMBER_WIDTH,
} from "./gridConstants";
import type { GridColumn } from "./gridTypes";
import { useGridColumnTools } from "./GridColumnTools";

type GridHeaderProps = {
  tableId: string;
  columns: GridColumn[];
  /** Full width of the row, so sticky cells have room to stick. */
  width: number;
};

const HEADER_CELL =
  "box-border flex h-8 flex-none items-center border-b border-r border-at-grid-line";

/**
 * The sticky header row: an empty cell above the row numbers, one cell per
 * visible field (with its menu and resize handle), and the trailing "+" cell
 * that adds a field.
 */
export function GridHeader({ tableId, columns, width }: GridHeaderProps) {
  return (
    <div
      role="row"
      aria-rowindex={1}
      data-testid="grid-header"
      className="sticky top-0 z-20 flex"
      style={{ width, height: HEADER_HEIGHT }}
    >
      <div
        role="columnheader"
        aria-label="Row number"
        className={`${HEADER_CELL} sticky left-0 z-10 bg-[#f4f4f4]`}
        style={{ width: ROW_NUMBER_WIDTH }}
      />
      {columns.map((column) => (
        <HeaderCell key={column.id} column={column} />
      ))}
      <div
        className={`${HEADER_CELL} bg-[#f4f4f4]`}
        style={{ width: ADD_FIELD_WIDTH }}
      >
        <AddFieldPopover tableId={tableId} />
      </div>
    </div>
  );
}

/** Sorted (wins) and filtered columns: a stronger tint than their cells. */
function headerBackground(column: GridColumn): string {
  if (column.sortDirection) return "bg-[#ffe8d6]";
  if (column.filtered) return "bg-[#d9f5db]";
  return "bg-[#f4f4f4]";
}

function HeaderCell({ column }: { column: GridColumn }) {
  const tools = useGridColumnTools();
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = column.type === "number" ? Hash : Type;
  const SortArrow = column.sortDirection === "desc" ? ArrowDown : ArrowUp;
  return (
    <div
      role="columnheader"
      data-column-id={column.id}
      aria-sort={
        column.sortDirection === "asc"
          ? "ascending"
          : column.sortDirection === "desc"
            ? "descending"
            : undefined
      }
      className={`${HEADER_CELL} group/header text-at-text gap-1.5 px-2 text-[13px] font-normal ${headerBackground(
        column,
      )} ${column.isPrimary ? `sticky z-10 ${PRIMARY_BORDER_CLASS} ${PRIMARY_SHADOW_CLASS}` : "relative"}`}
      style={
        column.isPrimary
          ? { width: column.width, left: ROW_NUMBER_WIDTH }
          : { width: column.width }
      }
      onContextMenu={
        tools
          ? (event) => {
              event.preventDefault();
              setMenuOpen(true);
            }
          : undefined
      }
    >
      <Icon className="text-at-text-muted h-3.5 w-3.5 flex-none" aria-hidden />
      <span className="min-w-0 flex-1 truncate whitespace-nowrap">
        {column.name}
      </span>
      {column.filtered && (
        <Filter
          className="h-3.5 w-3.5 flex-none text-[#2f8a3d]"
          aria-label="Filtered"
        />
      )}
      {column.sortDirection && (
        <SortArrow
          className="h-3.5 w-3.5 flex-none text-[#d54402]"
          aria-label={
            column.sortDirection === "asc"
              ? "Sorted ascending"
              : "Sorted descending"
          }
        />
      )}
      <FieldMenu column={column} open={menuOpen} onOpenChange={setMenuOpen} />
      <ColumnResizeHandle column={column} />
    </div>
  );
}
