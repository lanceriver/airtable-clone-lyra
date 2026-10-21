import type { Column } from "@tanstack/react-table";

import type { ColumnType, RowRecord } from "~/server/db/rows";

/** A field of the table, in table order. */
export type GridField = {
  id: string;
  name: string;
  type: ColumnType;
};

/** A visible field with everything the header and the rows need to draw it. */
export type GridColumn = {
  id: string;
  name: string;
  type: ColumnType;
  /** Current width in px (default 180, min 100). */
  width: number;
  /** The first visible field: sticky next to the row numbers. */
  isPrimary: boolean;
  /** The view is sorted by this field, and in which direction. */
  sortDirection: "asc" | "desc" | null;
  /** At least one of the view's filters is on this field. */
  filtered: boolean;
  /** The TanStack column, for header features (resizing, menus). */
  column: Column<RowRecord, unknown>;
};
