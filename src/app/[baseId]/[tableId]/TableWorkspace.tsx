"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";

import {
    ROW_NUMBER_COLUMN_ID,
    RowNumberCell,
    Table,
    TableCell,
} from "~/app/_components/ui/Table";
import TableNavbar2 from "~/app/_components/ui/TableNavbar2";
import { useUpdateViewConfig } from "~/app/_components/useUpdateViewConfig";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import type { RowRecord } from "~/server/db/rows";
import { api, type RouterOutputs } from "~/trpc/react";

const PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 300;

type Props = {
    baseId: string;
    table: RouterOutputs["table"]["get"];
    view: RouterOutputs["view"]["get"];
};

/**
 * One table view. The parent mounts it with `key={view.id}`, so the search box
 * starts from the view's saved search and nothing leaks between views.
 */
export function TableWorkspace({ baseId, table, view }: Props) {
    const utils = api.useUtils();
    const viewId = view.id;
    const { config } = view;

    const [searchInput, setSearchInput] = useState(config.search);
    const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

    const updateConfig = useUpdateViewConfig(viewId);
    const saveSearch = useUpdateViewConfig(viewId);
    const savedSearch = useRef(config.search);
    useEffect(() => {
        if (search === savedSearch.current) return;
        savedSearch.current = search;
        saveSearch.update({ search });
      }, [search, saveSearch]);

    const rowsInput = { viewId, limit: PAGE_SIZE, search };
    const rowsQuery = api.row.getRows.useInfiniteQuery(rowsInput, {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        placeholderData: keepPreviousData,
    });
    const countQuery = api.row.countRows.useQuery(
        { viewId, search },
        { placeholderData: keepPreviousData },
    );

    const rows = useMemo(
        () => rowsQuery.data?.pages.flatMap((page) => page.rows) ?? [],
        [rowsQuery.data],
    );

    const replaceRow = (updated: RowRecord) => {
        utils.row.getRows.setInfiniteData(rowsInput, (old) =>
            old && {
                ...old,
                pages: old.pages.map((page) =>
                    page.rows.some((row) => row.id === updated.id)
                        ? {
                              ...page,
                              rows: page.rows.map((row) =>
                                  row.id === updated.id ? updated : row,
                              ),
                          }
                        : page,
                ),
            },
        );
    };

    const columnInfo = useMemo(
        () =>
            table.columns.map((column) => ({
                id: column.id,
                name: column.name,
                type: column.type === "number" ? ("number" as const) : ("string" as const),
            })),
        [table.columns],
    );

    const columns = useMemo<ColumnDef<RowRecord, string | number>[]>(
        () => [
            {
                id: ROW_NUMBER_COLUMN_ID,
                size: 80,
                minSize: 80,
                maxSize: 80,
                header: () => <span>#</span>,
                cell: RowNumberCell,
            },
            ...columnInfo.map(
                (column): ColumnDef<RowRecord, string | number> => ({
                    id: column.id,
                    accessorFn: (row) => row.data[column.id] ?? "",
                    meta: { type: column.type, name: column.name },
                    cell: TableCell,
                    header: () => <span>{column.name}</span>,
                    size: 200,
                }),
            ),
        ],
        [columnInfo],
    );

    const columnVisibility = useMemo<VisibilityState>(
        () =>
            Object.fromEntries(config.hiddenColumnIds.map((id) => [id, false])),
        [config.hiddenColumnIds],
    );

    const filteredColumns = useMemo(
        () => config.filters.map((filter) => filter.columnId),
        [config.filters],
    );

    const pendingSort = updateConfig.pendingPatch?.sort;
    const isSortPending = pendingSort !== undefined;
    const displaySort = isSortPending ? pendingSort : config.sort;

    return (
        <div className="flex flex-col overflow-auto h-full">
            <TableNavbar2
                baseId={baseId}
                tableId={table.id}
                viewId={viewId}
                viewName={view.name}
                columns={columnInfo}
                config={config}
                displaySort={displaySort}
                isSortPending={isSortPending}
                onUpdateConfig={updateConfig.update}
                searchInput={searchInput}
                onSearchChange={setSearchInput}
                recordCount={countQuery.data}
            >
                <Table
                    rows={rows}
                    columns={columns}
                    tableId={table.id}
                    sort={config.sort}
                    onSort={(columnId, direction) =>
                        updateConfig.update({ sort: { columnId, direction } })
                    }
                    onRowUpdated={replaceRow}
                    fetchNextPage={() =>
                        void rowsQuery.fetchNextPage({ cancelRefetch: false })
                    }
                    hasNextPage={rowsQuery.hasNextPage}
                    isFetchingNextPage={rowsQuery.isFetchingNextPage}
                    isLoading={rowsQuery.isLoading}
                    filteredColumns={filteredColumns}
                    columnVisibility={columnVisibility}
                    search={search}
                />
            </TableNavbar2>
        </div>
    );
}
