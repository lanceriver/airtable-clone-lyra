import { useCallback, type KeyboardEvent } from "react";

import type { GridAction, GridState } from "./gridReducer";

/** The parts of a keyboard event the bindings look at. */
export type KeyEventLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

export type KeyCommand =
  | { type: "action"; action: GridAction }
  | { type: "clearCell" }
  | { type: "addRecord" };

type KeyContext = { editing: boolean; hasActive: boolean };

const act = (action: GridAction): KeyCommand => ({ type: "action", action });

/**
 * The key bindings of docs/plans/phase-2-grid.md ("Selection and keyboard"),
 * as a pure function: the command for a key press, or null when the grid
 * leaves the key alone (the browser keeps it).
 *
 * While editing, the editor input handles its own keys. These editing
 * bindings are for when the grid container itself has focus during an edit
 * (the placeholder before the editor exists): Escape, Enter, Tab and the up
 * and down arrows.
 */
export function keyCommand(
  event: KeyEventLike,
  { editing, hasActive }: KeyContext,
): KeyCommand | null {
  const { key, shiftKey } = event;
  const mod = event.ctrlKey || event.metaKey;
  if (event.altKey) return null;

  if (editing) {
    if (mod) return null;
    switch (key) {
      case "Escape":
        return act({ type: "cancelEdit" });
      case "Enter":
        return act({ type: "commitEdit", move: "down" });
      case "Tab":
        return act({ type: "commitEdit", move: shiftKey ? "shiftTab" : "tab" });
      case "ArrowDown":
        return act({ type: "commitEdit", move: "down" });
      case "ArrowUp":
        return act({ type: "commitEdit", move: "up" });
      default:
        return null;
    }
  }

  // Shift+Enter adds a record (Airtable's shortcut), selected cell or not.
  if (key === "Enter" && shiftKey && !mod) return { type: "addRecord" };

  switch (key) {
    case "ArrowUp":
      return act(
        mod
          ? { type: "jumpRow", to: "first" }
          : { type: "move", dRow: -1, dCol: 0 },
      );
    case "ArrowDown":
      return act(
        mod
          ? { type: "jumpRow", to: "last" }
          : { type: "move", dRow: 1, dCol: 0 },
      );
    case "ArrowLeft":
      return act(mod ? { type: "home" } : { type: "move", dRow: 0, dCol: -1 });
    case "ArrowRight":
      return act(mod ? { type: "end" } : { type: "move", dRow: 0, dCol: 1 });
    case "Home":
      return act({ type: "home" });
    case "End":
      return act({ type: "end" });
    default:
      break;
  }

  // The rest only apply to a selected cell. In particular Tab keeps its
  // normal job (moving focus on) until a cell is selected, so the grid is
  // never a keyboard trap: Escape, then Tab.
  if (!hasActive) return null;
  switch (key) {
    case "Tab":
      return act({ type: "tab", shift: shiftKey });
    case "Enter":
      return act({ type: "startEdit" });
    case "Escape":
      return act({ type: "clear" });
    case "Delete":
    case "Backspace":
      return { type: "clearCell" };
    default:
      break;
  }
  // A printable character (one code point; "Enter", "Shift", ... are longer)
  // starts editing with that character.
  if (!mod && [...key].length === 1) {
    return act({ type: "startEdit", seed: key });
  }
  return null;
}

type Options = {
  state: GridState;
  dispatch: (action: GridAction) => void;
  /** False for a row that has not loaded: editing waits for it. */
  canEdit: (rowIndex: number) => boolean;
  /** Delete / Backspace on the active cell. */
  clearCell: (rowIndex: number, col: number) => void;
  /** Shift+Enter. */
  addRecord: () => void;
};

/**
 * The `onKeyDown` for the grid's scroll container. It only handles keys
 * pressed on the container itself, so inputs and buttons inside it (the
 * header menus, the cell editor) keep their own keys.
 */
export function useGridKeyboard({
  state,
  dispatch,
  canEdit,
  clearCell,
  addRecord,
}: Options) {
  const { active, editing } = state;
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.nativeEvent.isComposing) return;
      const command = keyCommand(event, {
        editing,
        hasActive: active !== null,
      });
      if (!command) return;
      event.preventDefault();
      if (command.type === "clearCell") {
        if (active) clearCell(active.row, active.col);
        return;
      }
      if (command.type === "addRecord") {
        addRecord();
        return;
      }
      const { action } = command;
      if (action.type === "startEdit" && (!active || !canEdit(active.row))) {
        return;
      }
      dispatch(action);
    },
    [active, editing, dispatch, canEdit, clearCell, addRecord],
  );
}
