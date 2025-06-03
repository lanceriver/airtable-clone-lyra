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
import { TableCell } from "~/app/_components/ui/Table";
import type { CellContext } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";

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

const columnHelper = createColumnHelper<ColumnData>();



export default function BasePage(props: { params: Promise<Params> }) {  
    const utils = api.useUtils(); 
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = use(props.params);

    const { data: views, isLoading: isViewsLoading } = api.view.getViews.useQuery({
        tableId: params.tableId,
    });

    const viewId = searchParams.get("viewId") ?? views?.[0]?.id;
    console.log("viewId from search params:", viewId);
    
    const activeViewData = useMemo(() => 
        views?.find(view => view.id === viewId),
        [views, viewId]
    );

    const handleViewChange = (viewId: string) => {
        router.push(`/${params.baseId}/${params.tableId}?viewId=${viewId}`);
    }
    console.log("activeViewData:", activeViewData);

    const viewFilters = activeViewData?.filters;
    const viewSort = activeViewData?.sort;
    console.log("Active view filters:", viewFilters);
    console.log("Active view sort:", viewSort);

    const handleSort = (columnId: string | null, order: "asc" | "desc") => {
        if (columnId === null) {
            updateView({
                id: activeViewData?.id ?? "",
                sort: null,
            });
            return;
        }
        updateView({
            id: activeViewData?.id ?? "",
            sort: { columnId, order},
            filters: viewFilters
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
            toast.error(`Failed to update view: ${error.message}`);
        }
    });

    

    const handleFilters = (
        columnId: string | null,
        columnName?: string,
        operator?: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty",
        value?: string | number
    ) => {
        if (columnId === null) {
            updateView({
                id: activeViewData?.id ?? "",
                filters: null
            });
            return;
        }
        updateView({
            id: activeViewData?.id ?? "",
            filters: {
                columnId: columnId,
                operator: operator ?? "contains",
                value: value ?? undefined,
            },
            sort: viewSort
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
    const final = columns?.map((column) => {
            columnMap.set(column.name, column.id);
            columnNames.set(column.id, column.name);
                return column.id;
            });

    // Ensure filters matches the expected type: no columnName, operator is required if filters is present
    /* const formattedFilters = viewFilters?.operator
        ? {
            columnId: filters.columnId,
            operator: filters.operator,
            value: filters.value,
        }
        : undefined;
 */
    const { data: nextRows, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = api.row.getRows.useInfiniteQuery(
        {
            tableId: tableId,
            count: 100,
            offset: 0,
            ...(viewFilters ? { filters: viewFilters } : {}),
            ...(viewSort ? { sort: viewSort } : {}),
        },
        {
            initialCursor: null,
            getNextPageParam: (lastPage) => lastPage?.nextCursor
        });

    console.log(tableId);
    console.log("next rows are:", nextRows);
    
    const flattened = useMemo(
        () => nextRows?.pages?.flatMap((page) => page?.rows) ?? [],
        [nextRows]
    );
    console.log(flattened);

// Choose which data to use
 const tableRows = flattened.filter((row): row is RowData => !!row);
const loading = isColumnsLoading || isLoading;
/*     if (isColumnsLoading || isLoading) {
        return <div>Loading...</div>;
    } */
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
        cell: TableCell,
        header: () => <span>{columnNames.get(column.id)}</span>,
        size: 200,
    })));
    if (returnedColumns) {
        tableColumns.push(...returnedColumns);
    }
    return (
        <div className="flex flex-col overflow-auto h-full">
            <TableNavbar2 baseId={baseId} initialTables={tables ?? []} tableCount={tableCount} tableId={tableId} handleFilters={handleFilters} columnMap={columnMap} handleSort={handleSort} activeViewId={viewId} handleViewChange={handleViewChange}>   
                    <Table rows={tableRows ?? []} columns={tableColumns ?? []} tableId={tableId} handleSort={handleSort} fetchNextPage={fetchNextPage} isFetchingNextPage={isFetchingNextPage} hasNextPage={hasNextPage}/>
            </TableNavbar2>
            
        </div>
        
        
    )
}