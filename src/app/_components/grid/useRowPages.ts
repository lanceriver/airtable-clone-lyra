"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { RowRecord } from "~/server/db/rows";
import { api } from "~/trpc/react";
import { RowPageStore, type FetchPage, type PageRequest } from "./rowPageStore";
import { RowPagesBuffer } from "./rowPagesBuffer";

export const DEFAULT_PAGE_SIZE = 100;

export type UseRowPagesOptions = {
  viewId: string;
  /** The (debounced) search text applied to the view. */
  search: string;
  /**
   * A stable string for the view's filters and sort (e.g. their JSON). The
   * page cache is rebuilt whenever it changes, since old cursors and pages no
   * longer apply. Pass it from the saved config, so it changes once the
   * server has the new config.
   */
  configKey: string;
  pageSize?: number;
};

export type RowPages = {
  /**
   * Rows matching the view; undefined until the first count arrives. After a
   * search or config change it keeps the previous count until the new rows
   * are ready, and then changes together with them.
   */
  total: number | undefined;
  /** Rows in the table, ignoring filters and search. */
  totalUnfiltered: number | undefined;
  getRow: (index: number) => RowRecord | undefined;
  isLoaded: (index: number) => boolean;
  /** Call on scroll with the visible rows plus overscan. */
  ensureRange: (startIndex: number, endIndex: number) => void;
  /** Replaces a cached row (after an edit). */
  patchRow: (row: RowRecord) => boolean;
  /** True while a page or the count is being fetched. */
  isFetching: boolean;
  /**
   * Drops every cached page and refetches the count. Call after rows are
   * inserted or deleted, or when an edit changes the sort order or the
   * filtered set.
   */
  reset: () => void;
  /**
   * Changes whenever a page lands or a row is patched. `getRow` keeps its
   * identity, so depend on this to re-render what shows rows.
   */
  version: number;
  /**
   * The key (view, search, filters and sort) of the rows being shown. It
   * changes in the same render as the rows of a new search or config, and not
   * on `reset()`: use it to scroll to the top and to clear the selection.
   */
  resultKey: string;
  /** The search the shown rows were fetched for (for highlighting). */
  resultSearch: string;
};

/**
 * Loads rows by index through `row.getRows`, backed by a double-buffered
 * `RowPageStore` (see `RowPagesBuffer`): after a search, filter or sort
 * change, or a `reset()`, the rows and the count on screen stay until the
 * new ones are ready, and are swapped in together.
 */
export function useRowPages({
  viewId,
  search,
  configKey,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseRowPagesOptions): RowPages {
  const utils = api.useUtils();
  const { client } = utils;
  // Bumped when the buffer was disposed (Strict Mode) and needs a new one.
  const [generation, setGeneration] = useState(0);

  // One buffer per mounted hook. Building it is cheap (no timers, no
  // requests), so doing it during render is safe.
  const key = JSON.stringify([viewId, search, configKey, pageSize]);
  const createStore = (): RowPageStore => {
    const fetchPage: FetchPage = (request: PageRequest) =>
      client.row.getRows.query({
        viewId,
        search,
        limit: pageSize,
        ...(request.kind === "forward" && { cursor: request.cursor }),
        ...(request.kind === "backward" && {
          cursor: request.cursor,
          direction: "backward" as const,
        }),
        ...(request.kind === "offset" && { offset: request.offset }),
      });
    return new RowPageStore({ pageSize, fetchPage });
  };
  const buffer = useMemo(() => {
    const created = new RowPagesBuffer<string>();
    created.setKey(key, search, createStore);
    return created;
    // The key only changes through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, generation]);

  // Dispose the buffer when the component unmounts. Strict Mode runs the
  // cleanup once on a buffer that is still in use; the next run finds it
  // disposed and swaps in a fresh one.
  useEffect(() => {
    if (buffer.isDisposed) {
      setGeneration((g) => g + 1);
      return;
    }
    return () => buffer.dispose();
  }, [buffer]);

  // A new key builds the pending store (and starts fetching its rows).
  useEffect(() => {
    buffer.setKey(key, search, createStore);
    // `createStore` and `search` are part of `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, key]);

  // The buffer takes only a fresh count for the current key: not the previous
  // search's count (no placeholder data) and not one that is being refetched.
  const countQuery = api.row.countRows.useQuery({ viewId, search });
  const counts = countQuery.data;
  const countReady =
    counts !== undefined &&
    !countQuery.isPlaceholderData &&
    !countQuery.isFetching;
  const countFailed =
    countQuery.isError && !countQuery.isFetching && counts === undefined;
  const pendingSeq = useSyncExternalStore(
    buffer.subscribe,
    () => buffer.pendingSeq,
    () => buffer.pendingSeq,
  );
  useEffect(() => {
    if (countReady) {
      buffer.offerCounts(key, { count: counts.count, total: counts.total });
    } else if (countFailed) {
      buffer.offerCountError(key);
    }
    // `pendingSeq`: a store built after the count arrived needs it offered.
  }, [
    buffer,
    key,
    countReady,
    countFailed,
    counts?.count,
    counts?.total,
    pendingSeq,
  ]);

  const version = useSyncExternalStore(
    buffer.subscribe,
    buffer.getSnapshot,
    buffer.getSnapshot,
  );

  // The shown store changes at a swap: ensureRange gets a new identity then,
  // so the grid asks the new store for what is visible.
  const epoch = buffer.epoch;
  const ensureRange = useCallback(
    (start: number, end: number) => buffer.ensureRange(start, end),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buffer, epoch],
  );
  const reset = useCallback(() => {
    void utils.row.countRows.invalidate({ viewId });
    buffer.reset();
  }, [utils, viewId, buffer]);

  return {
    total: buffer.total,
    totalUnfiltered: buffer.totalUnfiltered,
    getRow: buffer.getRow,
    isLoaded: buffer.isLoaded,
    ensureRange,
    patchRow: buffer.patchRow,
    isFetching: buffer.isFetching || countQuery.isFetching,
    reset,
    version,
    resultKey: buffer.resultKey,
    resultSearch: buffer.resultMeta ?? search,
  };
}
