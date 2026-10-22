"use client";

import type { ColumnSizingState, OnChangeFn } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RouterOutputs } from "~/trpc/react";
import { useUpdateViewConfig } from "../useUpdateViewConfig";
import {
  DEFAULT_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
} from "./gridConstants";

export type ColumnWidths = {
  /** TanStack's `state.columnSizing`: a width per resized field id. */
  columnSizing: ColumnSizingState;
  /** TanStack's `onColumnSizingChange`: live updates while a handle drags. */
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  /** A drag started: saved widths arriving meanwhile don't move the column. */
  begin: () => void;
  /** A drag ended: saves the widths (once) if they changed. */
  commit: () => void;
  /** Back to the default width, and saved. */
  reset: (columnId: string) => void;
};

/** Whole px within the allowed range, as the server stores it. */
export function normalizeWidth(width: number): number {
  return Math.min(
    MAX_COLUMN_WIDTH,
    Math.max(MIN_COLUMN_WIDTH, Math.round(width)),
  );
}

/** Normalizes every width and drops the ones at the default size. */
export function normalizeSizing(sizing: ColumnSizingState): ColumnSizingState {
  const result: ColumnSizingState = {};
  for (const [id, width] of Object.entries(sizing)) {
    if (!Number.isFinite(width)) continue;
    const normalized = normalizeWidth(width);
    if (normalized !== DEFAULT_COLUMN_WIDTH) result[id] = normalized;
  }
  return result;
}

export function sameSizing(a: ColumnSizingState, b: ColumnSizingState) {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  );
}

/**
 * Column widths for one view. The state is seeded from the saved
 * `config.columnWidths`, lives locally while a handle drags (so the grid
 * follows the pointer) and is saved with `view.updateConfig` once per drag.
 * `useUpdateViewConfig` writes the new widths to the `view.get` cache
 * optimistically, so they don't snap back before the save returns.
 *
 * Wire it to the TanStack table with `state.columnSizing` and
 * `onColumnSizingChange`, and drive it from `ColumnResizeHandle`.
 */
export function useColumnWidths({
  viewId,
  config,
}: {
  viewId: string;
  config: Pick<RouterOutputs["view"]["get"]["config"], "columnWidths">;
}): ColumnWidths {
  const { update } = useUpdateViewConfig(viewId);
  const saved = config.columnWidths;

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(saved);
  const sizingRef = useRef(columnSizing);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const dragging = useRef(false);
  const updateRef = useRef(update);
  updateRef.current = update;

  const apply = useCallback((next: ColumnSizingState) => {
    sizingRef.current = next;
    setColumnSizing(next);
  }, []);

  const onColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
    (updater) => {
      apply(
        typeof updater === "function" ? updater(sizingRef.current) : updater,
      );
    },
    [apply],
  );

  // Follow the saved widths when they change under us (another save landed, a
  // field was deleted), but never while a handle is being dragged.
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    if (dragging.current) return;
    if (!sameSizing(sizingRef.current, savedRef.current)) {
      apply(savedRef.current);
    }
  }, [savedKey, apply]);

  const save = useCallback(
    (next: ColumnSizingState) => {
      apply(next);
      if (!sameSizing(next, savedRef.current)) {
        updateRef.current({ columnWidths: next });
      }
    },
    [apply],
  );

  const begin = useCallback(() => {
    dragging.current = true;
  }, []);

  const commit = useCallback(() => {
    dragging.current = false;
    save(normalizeSizing(sizingRef.current));
  }, [save]);

  const reset = useCallback(
    (columnId: string) => {
      const rest = { ...sizingRef.current };
      delete rest[columnId];
      save(normalizeSizing(rest));
    },
    [save],
  );

  return useMemo(
    () => ({ columnSizing, onColumnSizingChange, begin, commit, reset }),
    [columnSizing, onColumnSizingChange, begin, commit, reset],
  );
}
