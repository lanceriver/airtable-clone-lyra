"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useReducer,
  useRef,
  type Dispatch,
  type RefObject,
} from "react";

import {
  gridReducer,
  initialGridState,
  type GridAction,
  type GridContext as GridSize,
  type GridState,
} from "./gridReducer";
import type { GridColumn } from "./gridTypes";

/**
 * Selection state of the grid, for anything inside it that needs it: the cell
 * editor overlay (task 2.5), the row tools (2.6). Provided by `Grid`.
 */
export type GridSelectionValue = {
  state: GridState;
  dispatch: Dispatch<GridAction>;
  /** Rows in the view and visible fields: the bounds `active` lives in. */
  rowCount: number;
  colCount: number;
  /** The visible fields, in order; `state.active.col` indexes into it. */
  columns: GridColumn[];
  /** `columns[state.active.col]`, or null without a selection. */
  activeColumn: GridColumn | null;
  /** The grid's scroll container. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Moves keyboard focus back to the grid (after an editor closes). */
  focusGrid: () => void;
  /** Delete / Backspace on a cell; the editing task wires the real one. */
  clearCell: (rowIndex: number, columnId: string) => void;
};

export const GridSelectionContext = createContext<GridSelectionValue | null>(
  null,
);

export function useGridSelection(): GridSelectionValue {
  const value = useContext(GridSelectionContext);
  if (!value) {
    throw new Error("useGridSelection must be used inside <Grid>");
  }
  return value;
}

/**
 * `gridReducer` as React state. The reducer needs the table size, so the
 * returned `dispatch` stamps each action with the latest counts (they are
 * kept in a ref, so `dispatch` never changes identity).
 */
export function useGridState(
  rowCount: number,
  colCount: number,
): [GridState, Dispatch<GridAction>] {
  const [state, rawDispatch] = useReducer(
    (current: GridState, event: { action: GridAction; size: GridSize }) =>
      gridReducer(current, event.action, event.size),
    initialGridState,
  );
  const sizeRef = useRef<GridSize>({ rowCount, colCount });
  useLayoutEffect(() => {
    sizeRef.current = { rowCount, colCount };
  }, [rowCount, colCount]);
  const dispatch = useCallback(
    (action: GridAction) => rawDispatch({ action, size: sizeRef.current }),
    [],
  );
  return [state, dispatch];
}
