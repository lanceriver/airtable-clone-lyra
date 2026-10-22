"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import type { GridAction } from "./gridReducer";
import type { RowPages } from "./useRowPages";

/** How far from the end of the view to look for the new row if it moved. */
const SEARCH_BACK_ROWS = 400;
/** Gives up waiting for the new row to show up. */
const ADD_TIMEOUT_MS = 10_000;

/** A record that was created and is on its way into the grid. */
type PendingAdd = {
  id: string;
  /** The view's row count before the add. */
  baseTotal: number;
  /** The refetch of the count has been seen running. */
  sawFetch: boolean;
  /** The new row's first cell is selected; waiting for its page to load. */
  selected: boolean;
};

export type RowActions = {
  /** Appends a record, selects its first field and starts editing it. */
  addRecord: () => void;
  /** True from the click until the new record is in place. */
  adding: boolean;
  /** Deletes a record, then reloads the rows (the scroll position stays). */
  deleteRecord: (rowId: string) => Promise<void>;
};

type Options = {
  tableId: string;
  rowPages: RowPages;
  dispatch: Dispatch<GridAction>;
  /** Visible fields; without any there is no cell to edit. */
  colCount: number;
};

/**
 * The row tools of the grid: "+ Add record" and "Delete record".
 *
 * A new record gets the highest `order`, so in an unsorted view it is the last
 * row. After `createRow` the page cache is reset; once the new count is known
 * the grid selects the last row and, as soon as that row has loaded, opens its
 * first field for editing. In a sorted view the row may have landed
 * elsewhere: it is looked for among the rows near the end, and if it is not
 * there the view just ends up scrolled to the bottom.
 */
export function useRowActions({
  tableId,
  rowPages,
  dispatch,
  colCount,
}: Options): RowActions {
  const { client } = api.useUtils();
  const { total, isFetching, version, getRow, reset } = rowPages;

  const [pending, setPending] = useState<PendingAdd | null>(null);
  // Set at once on click, so a second Shift+Enter before React re-renders
  // can't add twice.
  const lockRef = useRef(false);
  const [creating, setCreating] = useState(false);

  const latest = useRef({ total, reset });
  useEffect(() => {
    latest.current = { total, reset };
  });

  const finish = useCallback(() => {
    lockRef.current = false;
    setCreating(false);
    setPending(null);
  }, []);

  const addRecord = useCallback(() => {
    const baseTotal = latest.current.total;
    if (lockRef.current || baseTotal === undefined) return;
    lockRef.current = true;
    setCreating(true);
    client.row.createRow.mutate({ tableId }).then(
      (row) => {
        setCreating(false);
        setPending({ id: row.id, baseTotal, sawFetch: false, selected: false });
        latest.current.reset();
      },
      (error: unknown) => {
        finish();
        toast.error(
          error instanceof Error && error.message !== ""
            ? error.message
            : "Couldn't add the record",
        );
      },
    );
  }, [client, tableId, finish]);

  // Step 1: wait for the new count, then select the last row.
  // Step 2: wait for that row to load, then start editing it.
  useEffect(() => {
    if (!pending || total === undefined) return;

    if (!pending.selected) {
      if (total !== pending.baseTotal) {
        if (colCount > 0) dispatch({ type: "select", row: total - 1, col: 0 });
        setPending({ ...pending, selected: true });
      } else if (isFetching) {
        if (!pending.sawFetch) setPending({ ...pending, sawFetch: true });
      } else if (pending.sawFetch) {
        // The count didn't change: a filter or search hides the new record.
        toast.success("Record added. It doesn't match this view's filters.");
        finish();
      }
      return;
    }

    if (colCount === 0 || total === 0) {
      finish();
      return;
    }
    const last = total - 1;
    const lastRow = getRow(last);
    if (!lastRow) return; // Still loading; `version` re-runs this.
    let index = -1;
    if (lastRow.id === pending.id) {
      index = last;
    } else {
      // Sorted view: the row may be elsewhere among the loaded ones.
      for (let i = last - 1; i >= Math.max(0, last - SEARCH_BACK_ROWS); i--) {
        if (getRow(i)?.id === pending.id) {
          index = i;
          break;
        }
      }
    }
    if (index >= 0) {
      dispatch({ type: "select", row: index, col: 0 });
      dispatch({ type: "startEdit" });
    }
    finish();
  }, [pending, total, isFetching, version, getRow, dispatch, colCount, finish]);

  // Never stay stuck in the "adding" state.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(finish, ADD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending, finish]);

  const deleteRecord = useCallback(
    async (rowId: string) => {
      try {
        await client.row.deleteRows.mutate({ tableId, rowIds: [rowId] });
      } catch (error) {
        toast.error(
          error instanceof Error && error.message !== ""
            ? error.message
            : "Couldn't delete the record",
        );
      } finally {
        // Refetch the count and the visible pages; the grid keeps its scroll
        // position (it only scrolls to the top for a different result set).
        latest.current.reset();
      }
    },
    [client, tableId],
  );

  return { addRecord, adding: creating || pending !== null, deleteRecord };
}
