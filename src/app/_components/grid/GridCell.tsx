import { ROW_NUMBER_WIDTH } from "./gridConstants";
import type { GridColumn } from "./gridTypes";

/** Row number columns and primary-field cells stay put on horizontal scroll. */
export const PRIMARY_SHADOW_CLASS =
  "group-data-[hscrolled=true]/grid:shadow-[2px_0_3px_-1px_rgba(0,0,0,0.18)]";

/**
 * Background for a body cell: search match, then filtered column, then sorted
 * column. Sticky cells need an opaque background, hence the white default.
 */
function cellBackground(column: GridColumn, matchesSearch: boolean): string {
  if (matchesSearch) return "bg-[#fff3b0]";
  if (column.filtered) return "bg-[#e8f7ea]";
  if (column.sortDirection) return "bg-[#fff2ea]";
  return "bg-white";
}

export function displayValue(value: string | number | undefined): string {
  return value === undefined ? "" : String(value);
}

type GridCellProps = {
  column: GridColumn;
  /** The row's value for this field; undefined while the row is loading. */
  value: string | number | undefined;
  loaded: boolean;
  /** Lower-cased search text, or "". */
  searchLower: string;
  /** Row index and column position, for the shimmer widths. */
  rowIndex: number;
  columnIndex: number;
  /** This is the selected cell: drawn with the blue outline. */
  isActive: boolean;
  /** The selected cell is being edited (thicker outline, white fill). */
  isEditing: boolean;
};

/** Inset, so the outline never overlaps the neighbouring cells. */
const ACTIVE_CLASS = "outline-2 -outline-offset-2 outline-[#166ee1]";
const EDITING_CLASS =
  "outline-[3px] -outline-offset-[3px] outline-[#166ee1] bg-white!";

const SHIMMER_WIDTHS = ["w-3/5", "w-2/5", "w-4/5", "w-1/2", "w-3/4"] as const;

/** One read-only body cell. No hooks: hundreds of these render at once. */
export function GridCell({
  column,
  value,
  loaded,
  searchLower,
  rowIndex,
  columnIndex,
  isActive,
  isEditing,
}: GridCellProps) {
  const base =
    "h-8 flex-none box-border border-b border-r border-[#dfe2e4] px-2 flex items-center";
  const sticky = column.isPrimary ? `sticky z-10 ${PRIMARY_SHADOW_CLASS}` : "";
  const activeClass = isEditing ? EDITING_CLASS : isActive ? ACTIVE_CLASS : "";
  const aria = {
    role: "gridcell",
    "aria-colindex": columnIndex + 2,
    "aria-selected": isActive || undefined,
    "data-col-index": columnIndex,
  } as const;
  const style = column.isPrimary
    ? { width: column.width, left: ROW_NUMBER_WIDTH }
    : { width: column.width };

  if (!loaded) {
    const widthClass =
      SHIMMER_WIDTHS[(rowIndex * 7 + columnIndex * 3) % SHIMMER_WIDTHS.length];
    return (
      <div
        {...aria}
        className={`${base} ${sticky} ${cellBackground(column, false)} ${column.type === "number" ? "justify-end" : ""} ${activeClass}`}
        style={style}
      >
        <div
          className={`h-3 ${widthClass} animate-pulse rounded bg-[#e6e8ea]`}
        />
      </div>
    );
  }

  const text = displayValue(value);
  const matches =
    searchLower !== "" &&
    text !== "" &&
    text.toLowerCase().includes(searchLower);
  const isNumber = column.type === "number";
  return (
    <div
      {...aria}
      className={`${base} ${sticky} ${cellBackground(column, matches)} ${isNumber ? "justify-end text-right tabular-nums" : ""} ${activeClass}`}
      style={style}
    >
      <span className="min-w-0 truncate whitespace-nowrap">{text}</span>
    </div>
  );
}
