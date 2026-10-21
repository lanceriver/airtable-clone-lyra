"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Grid } from "~/app/_components/grid/Grid";
import type { GridField } from "~/app/_components/grid/gridTypes";
import { useRowPages } from "~/app/_components/grid/useRowPages";
import TableNavbar2 from "~/app/_components/ui/TableNavbar2";
import { useUpdateViewConfig } from "~/app/_components/useUpdateViewConfig";
import type { WorkspaceProps } from "./TableWorkspace";
import { useViewSearch } from "./useViewSearch";

const PAGE_SIZE = 100;

/**
 * A table view on the new virtualized grid (`?grid=v2`): the same toolbar as
 * the old workspace, with rows loaded by `useRowPages`.
 */
export function GridWorkspace({ baseId, table, view }: WorkspaceProps) {
    const viewId = view.id;
    const { config } = view;

    const { searchInput, setSearchInput, search } = useViewSearch(
        viewId,
        config.search,
    );
    const updateConfig = useUpdateViewConfig(viewId);

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

    const pendingSort = updateConfig.pendingPatch?.sort;
    const isSortPending = pendingSort !== undefined;
    const displaySort = isSortPending ? pendingSort : config.sort;

    const recordCount =
        rowPages.total !== undefined && rowPages.totalUnfiltered !== undefined
            ? { count: rowPages.total, total: rowPages.totalUnfiltered }
            : undefined;

    return (
        <div className="flex flex-col overflow-auto h-full">
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
                recordCount={recordCount}
                onRowsAdded={rowPages.reset}
            >
                <FillViewportHeight>
                    <Grid
                        tableId={table.id}
                        fields={fields}
                        hiddenColumnIds={config.hiddenColumnIds}
                        sort={config.sort}
                        filteredColumnIds={filteredColumnIds}
                        search={search}
                        rowPages={rowPages}
                        scrollResetKey={configKey}
                    />
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
