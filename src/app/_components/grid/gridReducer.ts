/**
 * Selection and edit state of the grid, as a pure reducer (no React, no DOM).
 * The keyboard bindings are in useGridKeyboard.ts; the table of keys is in
 * docs/plans/phase-2-grid.md ("Selection and keyboard").
 *
 * Cells are addressed by `row` (index in the view's rows) and `col` (index
 * among the VISIBLE fields). The grid dispatches `clamp` when either count
 * shrinks, so `active` always points inside the table.
 */

export type CellPosition = { row: number; col: number };

export type GridState = {
  /** The selected cell, or null when nothing is selected. */
  active: CellPosition | null;
  /** True while the active cell is being edited. */
  editing: boolean;
  /**
   * The character that started the edit by typing (type-to-edit, which
   * replaces the value), or null when editing started with Enter or a
   * double-click (which keep the value).
   */
  editSeed: string | null;
};

/** Table size at the time of the action; the grid supplies it. */
export type GridContext = {
  rowCount: number;
  /** Number of visible fields. */
  colCount: number;
};

/** Where `commitEdit` goes next. `null` / omitted stays on the cell. */
export type CommitMove = "down" | "up" | "left" | "right" | "tab" | "shiftTab";

export type GridAction =
  | { type: "select"; row: number; col: number }
  | { type: "move"; dRow: number; dCol: number }
  | { type: "tab"; shift: boolean }
  | { type: "home" }
  | { type: "end" }
  | { type: "jumpRow"; to: "first" | "last" }
  | { type: "startEdit"; seed?: string }
  | { type: "commitEdit"; move?: CommitMove | null }
  | { type: "cancelEdit" }
  | { type: "clear" }
  | { type: "clamp" };

export const initialGridState: GridState = {
  active: null,
  editing: false,
  editSeed: null,
};

const clampInt = (value: number, max: number) =>
  Math.min(Math.max(value, 0), max);

/** A state with the cell selected and no edit going on. */
function selected(state: GridState, row: number, col: number): GridState {
  const { active } = state;
  if (
    active &&
    active.row === row &&
    active.col === col &&
    !state.editing &&
    state.editSeed === null
  ) {
    return state; // Same object: React skips the re-render.
  }
  return { active: { row, col }, editing: false, editSeed: null };
}

/** `tab` from a cell: the next (or previous) one, wrapping across rows. */
function tabbed(
  state: GridState,
  active: CellPosition,
  shift: boolean,
  { rowCount, colCount }: GridContext,
): GridState {
  let { row, col } = active;
  if (!shift) {
    if (col < colCount - 1) col += 1;
    else if (row < rowCount - 1) {
      row += 1;
      col = 0;
    }
  } else if (col > 0) col -= 1;
  else if (row > 0) {
    row -= 1;
    col = colCount - 1;
  }
  return selected(state, row, col);
}

export function gridReducer(
  state: GridState,
  action: GridAction,
  ctx: GridContext,
): GridState {
  const { rowCount, colCount } = ctx;
  const empty = rowCount <= 0 || colCount <= 0;
  const lastRow = rowCount - 1;
  const lastCol = colCount - 1;
  const { active } = state;

  switch (action.type) {
    case "clear":
      return active === null && !state.editing && state.editSeed === null
        ? state
        : initialGridState;

    case "clamp": {
      if (active === null) return state;
      if (empty) return initialGridState;
      if (active.row <= lastRow && active.col <= lastCol) return state;
      // The cell moved, so an edit in progress no longer applies.
      return selected(
        state,
        clampInt(active.row, lastRow),
        clampInt(active.col, lastCol),
      );
    }

    case "cancelEdit":
      if (!state.editing) return state;
      return { ...state, editing: false, editSeed: null };

    default:
      break;
  }

  // Everything below needs cells to exist.
  if (empty) return state;

  switch (action.type) {
    case "select": {
      const row = clampInt(action.row, lastRow);
      const col = clampInt(action.col, lastCol);
      // A click inside the cell being edited keeps the edit going.
      if (state.editing && active?.row === row && active.col === col) {
        return state;
      }
      return selected(state, row, col);
    }

    // With nothing selected, a navigation action selects the first cell (or,
    // for jumpRow "last", the last row's first cell) instead of moving.
    case "move": {
      if (active === null) return selected(state, 0, 0);
      return selected(
        state,
        clampInt(active.row + action.dRow, lastRow),
        clampInt(active.col + action.dCol, lastCol),
      );
    }

    case "tab":
      if (active === null) return selected(state, 0, 0);
      return tabbed(state, active, action.shift, ctx);

    case "home":
      return selected(state, active?.row ?? 0, 0);

    case "end":
      return selected(state, active?.row ?? 0, lastCol);

    case "jumpRow":
      return selected(
        state,
        action.to === "first" ? 0 : lastRow,
        active?.col ?? 0,
      );

    case "startEdit": {
      if (active === null || state.editing) return state;
      return { active, editing: true, editSeed: action.seed ?? null };
    }

    case "commitEdit": {
      if (!state.editing || active === null) return state;
      const done = { ...state, editing: false, editSeed: null };
      switch (action.move) {
        case "down":
          return selected(done, clampInt(active.row + 1, lastRow), active.col);
        case "up":
          return selected(done, clampInt(active.row - 1, lastRow), active.col);
        case "left":
          return selected(done, active.row, clampInt(active.col - 1, lastCol));
        case "right":
          return selected(done, active.row, clampInt(active.col + 1, lastCol));
        case "tab":
          return tabbed(done, active, false, ctx);
        case "shiftTab":
          return tabbed(done, active, true, ctx);
        default:
          return done;
      }
    }

    default:
      return state;
  }
}
