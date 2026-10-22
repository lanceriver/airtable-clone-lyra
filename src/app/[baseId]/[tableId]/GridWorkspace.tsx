"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Grid } from "~/app/_components/grid/Grid";
import {
  GridColumnToolsProvider,
  type GridColumnTools,
} from "~/app/_components/grid/GridColumnTools";
import type { GridField } from "~/app/_components/grid/gridTypes";
import { useColumnWidths } from "~/app/_components/grid/useColumnWidths";
import { useRowPages } from "~/app/_components/grid/useRowPages";
import type { AddFilterRequest } from "~/app/_components/ui/FilterPopover";
import TableNavbar2 from "~/app/_components/ui/TableNavbar2";
import { useUpdateViewConfig } from "~/app/_components/useUpdateViewConfig";
import type { RouterOutputs } from "~/trpc/react";
import { useViewSearch } from "./useViewSearch";

const PAGE_SIZE = 100;

type WorkspaceProps = {
  baseId: string;
  table: RouterOutputs["table"]["get"];
  view: RouterOutputs["view"]["get"];
};

/**
 * One table view: the toolbar over the virtualized grid, with rows loaded by
 * `useRowPages`. The page mounts it with `key={view.id}`, so the search box
 * starts from the view's saved search and nothing leaks between views.
 */
export function GridWorkspace({ baseId, table, view }: WorkspaceProps) {
  const viewId = view.id;
  const { config } = view;

  const { searchInput, setSearchInput, search } = useViewSearch(
    viewId,
    config.search,
  );
  const updateConfig = useUpdateViewConfig(viewId);
  const columnWidths = useColumnWidths({ viewId, config });
  const [addFilterRequest, setAddFilterRequest] =
    useState<AddFilterRequest | null>(null);

  // The page cache is rebuilt whenever the saved filters or sort change.
  const configKey = useMemo(
    () => JSON.stringify({ filters: config.filters, sort: config.sort }),
    [config.filters, config.sort],
  );
  const rowPages = useRowPages({
    viewId,
    search,
    configKey,
    pageSize: PAGE_SIZE,
  });

  const fields = useMemo<GridField[]>(
    () =>
      table.columns.map((column) => ({
        id: column.id,
        name: column.name,
        type: column.type === "number" ? "number" : "string",
      })),
    [table.columns],
  );
  const filteredColumnIds = useMemo(
    () => config.filters.map((filter) => filter.columnId),
    [config.filters],
  );

  // What the header's field menu and resize handles use.
  const hiddenColumnIds = config.hiddenColumnIds;
  const { update } = updateConfig;
  const columnTools: GridColumnTools = {
    tableId: table.id,
    fields,
    visibleFieldCount: fields.filter(
      (field) => !hiddenColumnIds.includes(field.id),
    ).length,
    widths: columnWidths,
    onSort: (columnId, direction) => update({ sort: { columnId, direction } }),
    onFilterBy: (columnId) =>
      setAddFilterRequest((previous) => ({
        key: (previous?.key ?? 0) + 1,
        columnId,
      })),
    onHide: (columnId) =>
      update({ hiddenColumnIds: [...hiddenColumnIds, columnId] }),
  };

  const pendingSort = updateConfig.pendingPatch?.sort;
  const isSortPending = pendingSort !== undefined;
  const displaySort = isSortPending ? pendingSort : config.sort;

  // The record count lives in the grid's footer.
  const clearFilters = () => {
    setSearchInput("");
    update({ filters: [], search: "" });
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <TableNavbar2
        baseId={baseId}
        tableId={table.id}
        viewId={viewId}
        viewName={view.name}
        columns={fields}
        config={config}
        displaySort={displaySort}
        isSortPending={isSortPending}
        onUpdateConfig={updateConfig.update}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        onRowsAdded={rowPages.reset}
        isFetching={rowPages.isFetching}
        addFilterRequest={addFilterRequest}
      >
        <FillViewportHeight>
          <GridColumnToolsProvider value={columnTools}>
            <Grid
              tableId={table.id}
              fields={fields}
              hiddenColumnIds={config.hiddenColumnIds}
              sort={config.sort}
              filteredColumnIds={filteredColumnIds}
              search={search}
              rowPages={rowPages}
              scrollResetKey={configKey}
              onClearFilters={clearFilters}
            />
          </GridColumnToolsProvider>
        </FillViewportHeight>
      </TableNavbar2>
    </div>
  );
}

/**
 * Gives the grid a definite height: from where it starts to the bottom of the
 * window. The page layout above it doesn't size its children (Phase 3 will
 * fix that with flex), and the grid needs a bounded height to scroll in.
 */
function FillViewportHeight({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(600);

  useLayoutEffect(() => {
    const update = () => {
      const element = ref.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top;
      setHeight(Math.max(240, Math.floor(window.innerHeight - top)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {children}
    </div>
  );
}
