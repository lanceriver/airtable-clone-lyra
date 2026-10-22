"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";

import {
  formatCellValue,
  isValidPartialNumber,
  NUMBER_ERROR,
  parseDraft,
  type CellValue,
} from "./cellValue";
import type { CommitMove } from "./gridReducer";
import { useGridSelection } from "./gridSelection";
import type { GridColumn } from "./gridTypes";

type CellEditorProps = {
  rowIndex: number;
  /** The row being edited; a save only applies while that row is still there. */
  rowId: string | undefined;
  column: GridColumn;
  /** The cell's current value. */
  value: CellValue;
};

const BLUE = "outline-[#166ee1]";
const RED = "outline-[#d4351c]";

/**
 * The editor of the active cell: a text input that fills the cell exactly
 * and draws the cell's outline. It is mounted only while the cell is being
 * edited, so it may use hooks freely.
 *
 * Enter / Shift+Enter, Tab / Shift+Tab and the up and down arrows save and
 * move; Escape cancels; clicking elsewhere or losing focus saves in place.
 * A number that isn't one stays open with a message (when leaving by click,
 * it is dropped instead, since the click already moved on).
 */
export function CellEditor({
  rowIndex,
  rowId,
  column,
  value,
}: CellEditorProps) {
  const { state, dispatch, setCell, focusGrid } = useGridSelection();
  const isNumber = column.type === "number";

  const [draft, setDraft] = useState(
    () => state.editSeed ?? formatCellValue(value, column.type),
  );
  // Set when saving a half-typed number ("-", ".") was refused.
  const [refused, setRefused] = useState(false);
  const showError = isNumber && (refused || !isValidPartialNumber(draft));

  const inputRef = useRef<HTMLInputElement>(null);
  // Set once the edit has been saved or cancelled, so the blur and click
  // events that follow can't save it a second time.
  const doneRef = useRef(false);
  // The latest props and draft, for the document and unmount handlers.
  const live = useRef({ draft, rowIndex, rowId, column, dispatch, setCell });
  useLayoutEffect(() => {
    live.current = { draft, rowIndex, rowId, column, dispatch, setCell };
  });

  // Focus with the caret at the end (a seed replaces the content, the
  // cursor goes after it).
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, []);

  /**
   * Ends the edit.
   *  - "commit": save; an invalid number keeps the editor open.
   *  - "leave": save and stay on the cell; an invalid number is dropped.
   *  - "cancel": drop it.
   */
  const finish = useCallback(
    (how: "commit" | "leave" | "cancel", move: CommitMove | null = null) => {
      if (doneRef.current) return;
      const edit = live.current;
      if (how === "cancel") {
        doneRef.current = true;
        edit.dispatch({ type: "cancelEdit" });
        return;
      }
      const parsed = parseDraft(edit.draft, edit.column.type);
      if (!parsed.ok) {
        if (how === "commit") {
          setRefused(true);
          return;
        }
        doneRef.current = true;
        toast.error(`${parsed.error}: the change was not saved`);
        edit.dispatch({ type: "cancelEdit" });
        return;
      }
      doneRef.current = true;
      edit.setCell(edit.rowIndex, edit.column.id, parsed.value, edit.rowId);
      edit.dispatch({ type: "commitEdit", move });
    },
    [],
  );

  // A click anywhere else saves the edit. This runs in the capture phase, so
  // it is applied before the grid's own handler selects the clicked cell.
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        inputRef.current?.contains(event.target)
      ) {
        return;
      }
      finish("leave");
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [finish]);

  // The row can unmount while editing (scrolled far away, or the cache was
  // rebuilt). Save what was typed rather than lose it. Strict Mode's extra
  // mount/unmount runs back to back, so check after it has settled.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) finish("leave");
      });
    };
  }, [finish]);

  const done = (how: "commit" | "cancel", move: CommitMove | null = null) => {
    const wasDone = doneRef.current;
    finish(how, move);
    if (!wasDone && doneRef.current) focusGrid();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // The grid container ignores keys from elsewhere, but ancestors needn't
    // see them either.
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        done("commit", event.shiftKey ? "up" : "down");
        break;
      case "Tab":
        event.preventDefault();
        done("commit", event.shiftKey ? "shiftTab" : "tab");
        break;
      case "ArrowDown":
        event.preventDefault();
        done("commit", "down");
        break;
      case "ArrowUp":
        event.preventDefault();
        done("commit", "up");
        break;
      case "Escape":
        event.preventDefault();
        done("cancel");
        break;
      default:
        break;
    }
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
    setRefused(false);
  };

  return (
    <>
      <input
        ref={inputRef}
        value={draft}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Switching windows isn't leaving the cell.
          if (document.hasFocus()) finish("leave");
        }}
        aria-label={column.name}
        aria-invalid={showError || undefined}
        autoComplete="off"
        spellCheck={false}
        inputMode={isNumber ? "decimal" : undefined}
        className={`absolute top-0 -right-px -bottom-px left-0 box-border min-w-0 border-0 bg-white px-2 outline-[3px] -outline-offset-[3px] select-text ${
          showError ? RED : BLUE
        } ${isNumber ? "text-right tabular-nums" : ""}`}
      />
      {showError && (
        <div
          role="alert"
          className="pointer-events-none absolute top-full left-0 z-30 mt-0.5 rounded-sm bg-[#d4351c] px-1.5 py-0.5 text-[11px] leading-4 whitespace-nowrap text-white shadow"
        >
          {NUMBER_ERROR}
        </div>
      )}
    </>
  );
}
