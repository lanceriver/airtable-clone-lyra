import type { Prisma } from "@prisma/client";

import {
  viewFilterSchema,
  viewSortSchema,
  type ColumnInfo,
  type ViewFilter,
  type ViewSort,
} from "./rows";

export type ViewConfig = {
  filters: ViewFilter[];
  sort: ViewSort;
  hiddenColumnIds: string[];
  search: string;
  /** Saved width in px per field id; fields without an entry use the default. */
  columnWidths: Record<string, number>;
};

export const MIN_COLUMN_WIDTH = 100;
export const MAX_COLUMN_WIDTH = 800;
/** Most widths accepted by `view.updateConfig` in one call. */
export const MAX_COLUMN_WIDTH_ENTRIES = 200;

/** Rounds a width to a whole px within the allowed range. */
export function clampColumnWidth(width: number): number {
  return Math.min(
    MAX_COLUMN_WIDTH,
    Math.max(MIN_COLUMN_WIDTH, Math.round(width)),
  );
}

/** Keeps the numeric entries of a stored widths map, clamped and rounded. */
export function parseColumnWidths(value: unknown): Record<string, number> {
  const widths: Record<string, number> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return widths;
  }
  for (const [id, width] of Object.entries(value)) {
    if (typeof width === "number" && Number.isFinite(width)) {
      widths[id] = clampColumnWidth(width);
    }
  }
  return widths;
}

/**
 * Parses a View row's JSON config defensively: invalid filter entries are
 * dropped, an invalid sort becomes null and non-numeric widths are dropped, so
 * a bad saved config never makes a query fail.
 */
export function parseViewConfig(view: {
  filters: Prisma.JsonValue;
  sort: Prisma.JsonValue | null;
  hiddenColumnIds: string[];
  search: string;
  columnWidths: Prisma.JsonValue;
}): ViewConfig {
  const filters: ViewFilter[] = [];
  if (Array.isArray(view.filters)) {
    for (const entry of view.filters) {
      const parsed = viewFilterSchema.safeParse(entry);
      if (parsed.success) filters.push(parsed.data);
    }
  }
  const sort = viewSortSchema.safeParse(view.sort);
  return {
    filters,
    sort: sort.success ? sort.data : null,
    hiddenColumnIds: view.hiddenColumnIds,
    search: view.search,
    columnWidths: parseColumnWidths(view.columnWidths),
  };
}

/** Maps stored columns to the query builder's view: "number" or else "string". */
export function toColumnInfo(
  columns: { id: string; type: string }[],
): ColumnInfo[] {
  return columns.map((c) => ({
    id: c.id,
    type: c.type === "number" ? "number" : "string",
  }));
}
