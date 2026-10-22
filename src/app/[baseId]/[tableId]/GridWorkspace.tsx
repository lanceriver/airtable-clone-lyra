"use client";

import { useEffect, useMemo, useState } from "react";

import { Grid } from "~/app/_components/grid/Grid";
import {
  GridColumnToolsProvider,
  type GridColumnTools,
} from "~/app/_components/grid/GridColumnTools";
import type { GridField } from "~/app/_components/grid/gridTypes";
import { useColumnWidths } from "~/app/_components/grid/useColumnWidths";
import { useRowPages } from "~/app/_components/grid/useRowPages";
import type { AddFilterRequest } from "~/app/_components/ui/FilterPopover";
import { ViewToolbar } from "~/app/_components/toolbar/ViewToolbar";
import { ViewsSidebar } from "~/app/_components/views/ViewsSidebar";
import { useUpdateViewConfig } from "~/app/_components/useUpdateViewConfig";
import type { RouterOutputs } from "~/trpc/react";
import { useViewSearch } from "./useViewSearch";

const PAGE_SIZE = 100;
const SIDEBAR_KEY = "at.viewsSidebarOpen";

/**
 * Whether the views sidebar is open, remembered in localStorage. Starts open
 * and reads the saved value after mount, so server and client markup match.
 */
function useViewsSidebarOpen() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "false") setOpen(false);
    } catch {
      // Storage can be blocked; the sidebar just starts open.
    }
  }, []);

  const toggle = () =>
    setOpen((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        // Not remembered, still toggles.
      }
      return next;
    });

  return [open, toggle] as const;
}

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
  const [sidebarOpen, toggleSidebar] = useViewsSidebarOpen();
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
    <>
      <ViewToolbar
        tableId={table.id}
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
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
      />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <ViewsSidebar
            baseId={baseId}
            tableId={table.id}
            activeViewId={viewId}
          />
        )}
        <div className="relative min-w-0 flex-1">
          <GridColumnToolsProvider value={columnTools}>
            <Grid
              tableId={table.id}
              fields={fields}
              hiddenColumnIds={config.hiddenColumnIds}
              sort={config.sort}
              filteredColumnIds={filteredColumnIds}
              rowPages={rowPages}
              onClearFilters={clearFilters}
            />
          </GridColumnToolsProvider>
        </div>
      </div>
    </>
  );
}
