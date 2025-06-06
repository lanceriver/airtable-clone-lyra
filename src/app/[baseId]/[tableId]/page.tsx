"use client";
import { Table } from "~/app/_components/ui/Table";
import TableNavbar2 from "~/app/_components/ui/TableNavbar2";
import { use } from "react";
import { api } from "~/trpc/react"; 
import {
  createColumnHelper
} from "@tanstack/react-table"; 
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { type ViewFilter, type ViewSort } from "~/server/api/routers/view";
import { TableCell } from "~/app/_components/ui/Table";
import type { CellContext } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { setLastVisitedTable } from "~/app/_components/ui/BaseCard";

// Dynamically generate column defs based on shape of data returned from backend, should make it more scalable

type Params = {
    baseId: string;
    tableName: string;
    tableId: string;
    seed: number;
};

export type RowData = {
    id: string;
    tableId: string;
    createdAt: Date;
    updatedAt: Date;
    cells: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        columnId: string;
        rowId: string;
        stringValue: string | null;
        numberValue: number | null;
    }[];
}

type ColumnData = {
    id: string;
    name: string;
    type: string;
    position: number;
}

type PageData = {
    rows: RowData[];
    nextCursor?: {
        id?: string;
        value?: string | number;
    } | null;
};

const columnHelper = createColumnHelper<ColumnData>();



export default function BasePage(props: { params: Promise<Params> }) {  
    const utils = api.useUtils(); 
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = use(props.params);

    const { data: views, isLoading: isViewsLoading } = api.view.getViews.useQuery({
        tableId: params.tableId,
    });

    const viewId = searchParams.get("viewId");
    
    useEffect(() => {
        if (params.baseId && params.tableId) {
            setLastVisitedTable(params.baseId, params.tableId);
        }
    }, [params.baseId, params.tableId]);

    
     useEffect(() => {
        if (viewId) {
            router.push(`/${params.baseId}/${params.tableId}?viewId=${viewId}`);
        } else if (views && views.length > 0) {
            // Redirect to first view if no viewId is present
            router.push(`/${params.baseId}/${params.tableId}?viewId=${views[0]?.id}`);
        }
    }, [params.baseId, params.tableId, viewId, views, router]);
    
    const activeViewData = useMemo(() => 
        views?.find(view => view.id === viewId),
        [views, viewId]
    );

    const handleViewChange = (viewId: string) => {
        router.push(`/${params.baseId}/${params.tableId}?viewId=${viewId}`);
    }

    const viewFilters = activeViewData?.filters;
    const viewSort = activeViewData?.sort;
    const visibleColumns = activeViewData?.visibleColumns ?? [];

    const filteredColumns = viewFilters?.map((filter) => filter.columnId) ?? [];

    const handleSort = (columnId: string | null, order: "asc" | "desc", type: "number" | "string") => {
        if (columnId === null) {
            updateView({
                id: viewId,
                sort: null,
                filters: viewFilters ?? undefined,
            });
            return;
        }
        updateView({
            id: viewId,
            sort: { columnId, order, type},
            filters: viewFilters ?? undefined
        })
    }

    const { mutate: updateView } = api.view.updateView.useMutation({
        onSuccess: () => {
            console.log("View updated successfully");
            void utils.view.getActiveView.invalidate();
            void utils.view.getViews.invalidate();
            void utils.row.getRows.invalidate();
        },
        onError: (error) => {
            //toast.error(`Failed to update view: ${error.message}`);
        }
    });

    const removeFilters = (columnId: string) => {
        if (!viewFilters) return;
        const newFilters = viewFilters.filter((filter) => filter.columnId !== columnId);
        console.log("Removing filters for column:", columnId, "New filters:", newFilters);
        updateView({
            id: viewId,
            filters: newFilters.length > 0 ? newFilters : undefined,
            visibleColumns: visibleColumns ?? undefined,
        })
    }

    const handleFilters = (
        columnId: string | null,
        operator?: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty" | "gt" | "lt" | "gte" | "lte",
        value?: string | number,
        visibleColumns?: string[]
    ) => {
        // Global search 
        if (columnId === "globalSearch" && value) {
            const newFilter: ViewFilter = { 
                columnId: "globalSearch",
                operator: "contains",
                value: value,
            };
            updateView({
                id: viewId ?? undefined,
                filters: viewFilters ? [...viewFilters, newFilter] : [newFilter],
                visibleColumns: visibleColumns ?? undefined,
            });
        }
        const newFilter: ViewFilter = {
            columnId: columnId ?? "",
            operator: operator ?? "contains",
            value: value ?? undefined,
        }
        updateView({
            id: viewId,
            filters: viewFilters ? [...viewFilters, newFilter] : [newFilter],
            sort: viewSort?.type
                ? { ...viewSort, type: viewSort.type }
                : undefined,
            visibleColumns: visibleColumns ?? undefined,
        })
    }

    const baseId = params.baseId;
    const {data: tables, isLoading: isTablesLoading} = api.table.getTables.useQuery({baseId});

    const tableCount = tables ? tables.length : 0;

    const { tableId } = params;
    const id = useMemo(() => {
        return tableId;
    }, [tableId]);


    console.log("Current tableId:", tableId);
    
    const { data: columns, isLoading: isColumnsLoading } = api.column.getColumns.useQuery({ tableId: id });

    const columnMap = new Map<string, string>();
    const columnNames = new Map<string, string>();
    const columnTypes = new Map<string, string>();

    columns?.map((column) => {
            columnMap.set(column.name, column.id);
            columnNames.set(column.id, column.name);
            columnTypes.set(column.name, column.type);
                return column.id;
            });
 
    const columnVisibility = useMemo(() => {
        if (!columns) return {};
        return columns.reduce((acc, column) => ({
            ...acc,
            [column.id]: visibleColumns.includes(column.id)
        }), {});
    }, [columns, visibleColumns]);

    const { data: nextRows, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = api.row.getRows.useInfiniteQuery(
        {
            tableId: tableId,
            count: 500,
            offset: 0,
            filters: viewFilters ? (Array.isArray(viewFilters) ? viewFilters : [viewFilters]) : undefined,
            ...(viewSort?.type
                ? { sort: { ...viewSort, type: viewSort.type } }
                : {}),
        },
        {
            initialCursor: null,
            getNextPageParam: (lastPage) => lastPage?.nextCursor
        });

    console.log("next rows are:", nextRows);
    
    const flattened = useMemo(
        () => nextRows?.pages?.flatMap((page: PageData | undefined) => page?.rows) ?? [],
        [nextRows]
    );
    console.log(flattened);

// Choose which data to use
 const tableRows = flattened.filter((row): row is RowData => !!row);
const loading = isColumnsLoading || isLoading;

    const tableColumns = [];
    const idColumn = {
            id: "id",
            size: 80,
            minSize:80,
            maxSize:80,
            header: () => <span>#</span>,
            cell: (info: CellContext<RowData, unknown>) => {
            return info.row.index + 1;
  },
        };
    tableColumns.push(idColumn);
    const returnedColumns = columns?.map((column => ({
        id: column.id,
        accessorFn: (row: RowData) => {
            const cell = row.cells?.find((cell: Record<string,unknown>) => cell.columnId === column.id);
            if (cell?.stringValue) {
                return cell.stringValue;
            }
            if (cell?.numberValue) {    
                return cell.numberValue;
            }
            return "";
        },
        meta: {
            type: column.type as "string" | "number",
        },
        cell: TableCell,
        header: () => <span>{columnNames.get(column.id)}</span>,
        size: 200,
    })));
    if (returnedColumns) {
        tableColumns.push(...returnedColumns);
    }
    console.log("Table columns:", tableColumns);
    return (
        <div className="flex flex-col overflow-auto h-full">
            <TableNavbar2
                baseId={baseId}
                initialTables={tables ?? []}
                tableCount={tableCount}
                tableId={tableId}
                handleFilters={handleFilters}
                removeFilters={removeFilters}
                columnMap={columnMap}
                columnTypes={Object.fromEntries(columnTypes)}
                handleSort={handleSort}
                activeViewId={viewId}
                handleViewChange={handleViewChange}
                sort={viewSort ?? null}
                filters={viewFilters ?? null}
                columnVisibility={columnVisibility}
            >
                <Table
                    rows={tableRows ?? []}
                    columns={tableColumns ?? []}
                    tableId={tableId}
                    handleSort={handleSort}
                    fetchNextPage={fetchNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    sort={viewSort ?? null}
                    filteredColumns={filteredColumns}
                    visibleColumns={columnVisibility}
                />
            </TableNavbar2>
            
        </div>
        
        
    )
}