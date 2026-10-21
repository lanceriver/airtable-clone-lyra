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
};

/**
 * Parses a View row's JSON config defensively: invalid filter entries are
 * dropped and an invalid sort becomes null, so a bad saved config never makes
 * a query fail.
 */
export function parseViewConfig(view: {
  filters: Prisma.JsonValue;
  sort: Prisma.JsonValue | null;
  hiddenColumnIds: string[];
  search: string;
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
