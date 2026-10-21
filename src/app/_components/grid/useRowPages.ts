"use client";

import { keepPreviousData } from "@tanstack/react-query";
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
  /** Rows matching the view; undefined until the first count arrives. */
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
};

/** Loads rows by index through `row.getRows`, backed by a `RowPageStore`. */
export function useRowPages({
  viewId,
  search,
  configKey,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseRowPagesOptions): RowPages {
  const utils = api.useUtils();
  const { client } = utils;
  const [generation, setGeneration] = useState(0);

  // One store per (view, search, config). It is cheap to build (no timers, no
  // requests), so building it during render is safe.
  const store = useMemo(() => {
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
    // configKey and generation only exist to rebuild the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, viewId, search, configKey, pageSize, generation]);

  // Dispose the store when it is replaced or the component unmounts. Strict
  // Mode runs the cleanup once on a store that is still in use; the next run
  // finds it disposed and swaps in a fresh one.
  useEffect(() => {
    if (store.isDisposed) {
      setGeneration((g) => g + 1);
      return;
    }
    return () => store.dispose();
  }, [store]);

  const countQuery = api.row.countRows.useQuery(
    { viewId, search },
    { placeholderData: keepPreviousData },
  );
  const total = countQuery.data?.count;
  useEffect(() => {
    if (total !== undefined) store.setTotal(total);
  }, [store, total]);

  const version = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const getRow = useCallback((i: number) => store.getRow(i), [store]);
  const isLoaded = useCallback((i: number) => store.isLoaded(i), [store]);
  const ensureRange = useCallback(
    (start: number, end: number) => store.ensureRange(start, end),
    [store],
  );
  const patchRow = useCallback(
    (row: RowRecord) => store.patchRow(row),
    [store],
  );
  const reset = useCallback(() => {
    setGeneration((g) => g + 1);
    void utils.row.countRows.invalidate({ viewId });
  }, [utils, viewId]);

  return {
    total,
    totalUnfiltered: countQuery.data?.total,
    getRow,
    isLoaded,
    ensureRange,
    patchRow,
    isFetching: store.isFetching || countQuery.isFetching,
    reset,
    version,
  };
}
