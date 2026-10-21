"use client";

import type { ColumnSizingState, OnChangeFn } from "@tanstack/react-table";
import { createContext, useContext, useState } from "react";

import type { GridField } from "./gridTypes";
import type { ColumnWidths } from "./useColumnWidths";

/**
 * What the grid's header needs from the workspace: the column widths and the
 * actions of the field menu. Provided by `GridWorkspace` so `Grid` doesn't
 * have to thread them through props. Without a provider the header is plain
 * (no menu, no resize handles).
 */
export type GridColumnTools = {
  tableId: string;
  /** Every field of the table, hidden ones included. */
  fields: GridField[];
  /** How many fields are visible in the view. */
  visibleFieldCount: number;
  widths: ColumnWidths;
  onSort: (columnId: string, direction: "asc" | "desc") => void;
  /** Adds a filter on the field and opens the toolbar's filter popover. */
  onFilterBy: (columnId: string) => void;
  onHide: (columnId: string) => void;
};

const GridColumnToolsContext = createContext<GridColumnTools | null>(null);

export const GridColumnToolsProvider = GridColumnToolsContext.Provider;

export function useGridColumnTools(): GridColumnTools | null {
  return useContext(GridColumnToolsContext);
}

/**
 * The `columnSizing` state for the TanStack table: the workspace's saved
 * widths when there is a provider, otherwise plain local state.
 */
export function useGridColumnSizing(): {
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
} {
  const tools = useContext(GridColumnToolsContext);
  const [local, setLocal] = useState<ColumnSizingState>({});
  return tools
    ? {
        columnSizing: tools.widths.columnSizing,
        onColumnSizingChange: tools.widths.onColumnSizingChange,
      }
    : { columnSizing: local, onColumnSizingChange: setLocal };
}
