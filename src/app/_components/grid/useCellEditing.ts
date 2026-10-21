"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { cellValueChanged, withCellValue } from "./cellValue";
import type { RowPages } from "./useRowPages";

type CellEdit = string | number | null;

/** A save that has been sent and not answered yet. */
type PendingSave = {
  /** Which save this is; a later save of the same cell has a higher one. */
  seq: number;
  value: CellEdit;
  /** The last value the server confirmed (what a failure restores). */
  previous: string | number | undefined;
};

export type CellEditing = {
  /**
   * Sets a cell. The row must be loaded; with `rowId` the row at `rowIndex`
   * must also still be that row (the page cache may have been rebuilt).
   */
  setCell: (
    rowIndex: number,
    columnId: string,
    value: CellEdit,
    rowId?: string,
  ) => void;
  /** Empties a cell (Delete / Backspace). */
  clearCell: (rowIndex: number, columnId: string) => void;
};

/**
 * Optimistic cell edits. `setCell` patches the cached row at once, then sends
 * `row.updateCell`:
 *  - on success the server's record replaces the cached one (keeping the
 *    values of any saves still in flight);
 *  - on failure only that cell goes back to its previous value, on the row as
 *    it is now, so edits to the other cells of the row survive. A toast shows
 *    the server's message.
 *
 * An edit never resets the page cache, even when it changes where the row
 * belongs in a sorted or filtered view: like Airtable, the row stays where it
 * is until the view is refreshed (a reload, or changing the sort or filters).
 */
export function useCellEditing(
  rowPages: Pick<RowPages, "getRow" | "patchRow">,
): CellEditing {
  const { client } = api.useUtils();
  const pagesRef = useRef(rowPages);
  useLayoutEffect(() => {
    pagesRef.current = rowPages;
  });
  const seqRef = useRef(0);
  // rowId -> columnId -> the latest unanswered save of that cell.
  const pendingRef = useRef(new Map<string, Map<string, PendingSave>>());

  const setCell = useCallback<CellEditing["setCell"]>(
    (rowIndex, columnId, value, rowId) => {
      const pages = pagesRef.current;
      const row = pages.getRow(rowIndex);
      if (!row || (rowId !== undefined && row.id !== rowId)) return;
      if (!cellValueChanged(row.data[columnId], value)) return;

      const pending = pendingRef.current;
      const rowPending = pending.get(row.id) ?? new Map<string, PendingSave>();
      pending.set(row.id, rowPending);
      const inFlight = rowPending.get(columnId);
      const save: PendingSave = {
        seq: ++seqRef.current,
        value,
        // Chain to the confirmed value, not to an unconfirmed edit.
        previous: inFlight ? inFlight.previous : row.data[columnId],
      };
      rowPending.set(columnId, save);

      pages.patchRow(withCellValue(row, columnId, value));

      const settle = () => {
        if (rowPending.get(columnId)?.seq === save.seq) {
          rowPending.delete(columnId);
        }
        if (rowPending.size === 0) pending.delete(row.id);
      };

      client.row.updateCell
        .mutate({ rowId: row.id, columnId, value })
        .then(
          (saved) => {
            settle();
            // Other saves of this row are still in flight: the server record
            // doesn't have them yet.
            let merged = saved;
            for (const [otherId, other] of rowPending) {
              merged = withCellValue(merged, otherId, other.value);
            }
            pagesRef.current.patchRow(merged);
          },
          (error: unknown) => {
            // A newer save of the same cell decides what the cell shows.
            const superseded = rowPending.get(columnId)?.seq !== save.seq;
            settle();
            if (!superseded) {
              const current = pagesRef.current.getRow(rowIndex);
              if (current?.id === row.id) {
                pagesRef.current.patchRow(
                  withCellValue(current, columnId, save.previous ?? null),
                );
              }
            }
            toast.error(
              error instanceof Error && error.message !== ""
                ? error.message
                : "Couldn't save the change",
            );
          },
        );
    },
    [client],
  );

  const clearCell = useCallback(
    (rowIndex: number, columnId: string) => setCell(rowIndex, columnId, null),
    [setCell],
  );

  return { setCell, clearCell };
}
