"use client";
import { Table } from "~/app/_components/ui/Table";
import TableNavbar2 from "~/app/_components/ui/TableNavbar2";
import { faker } from "@faker-js/faker";
import { generateFakeData } from "~/app/_components/ui/Table";
import { db } from "~/server/db";
import { use } from "react";
import { api } from "~/trpc/react"; 
import {
  createColumnHelper
} from "@tanstack/react-table"; 
import { useMemo, useState, useEffect } from "react";
import { set } from "zod";
import { TableCell } from "~/app/_components/ui/Table";
import type { CellContext } from "@tanstack/react-table";

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
    const params = use(props.params);
    const seed = params.seed;
    const [sort, setSort] = useState<{ columnId: string; order: "asc" | "desc" } | null>(null);
    const [filters, setFilters] = useState<{ columnId: string; columnName?: string; value?: string | number; operator?: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty"; } | null>(null);

    const handleSort = (columnId: string | null, order: "asc" | "desc") => {
        if (columnId === null) {
            setSort(null);
            void utils.row.getRows.invalidate();
            return;
        }
        setSort({ columnId, order});
    }

    const handleFilters = (
        columnId: string | null,
        columnName?: string,
        operator?: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty",
        value?: string | number
    ) => {
        if (columnId === null) {
            setFilters(null);
            void utils.row.getRows.invalidate();
            return;
        }
        setFilters({columnId, columnName, operator, value});
    }

    const baseId = params.baseId;
    const {data: tables, isLoading: isTablesLoading} = api.table.getTables.useQuery({baseId});

    const tableCount = tables ? tables.length : 0;

    const { tableId } = params;
    const id = useMemo(() => {
        return tableId;
    }, [tableId]);
    const tableName = params.tableName;

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
    const formattedFilters = filters?.operator
        ? {
            columnId: filters.columnId,
            operator: filters.operator,
            value: filters.value,
        }
        : undefined;

    const { data: nextRows, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = api.row.getRows.useInfiniteQuery(
        {
            tableId: tableId,
            count: 100,
            offset: 0,
            ...(sort != null && { sort }),
            ...(formattedFilters != null && { filters: formattedFilters }),
        },
        {
            initialCursor: null,
            getNextPageParam: (lastPage) => lastPage.nextCursor
        });
     console.log(tableId);
    console.log("next rows are:", nextRows);
    const flattened = useMemo(
        () => nextRows?.pages?.flatMap((page) => page.rows) ?? [],
        [nextRows]
    );
    console.log(sort);
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
        <div className="flex flex-col">
            <TableNavbar2 baseId={baseId} initialTables={tables ?? []} tableCount={tableCount} tableId={tableId}  handleFilters={handleFilters} columnMap={columnMap} handleSort={handleSort}>   
                    <Table rows={tableRows ?? []} columns={tableColumns ?? []} tableId={tableId} sort={sort} handleSort={handleSort} fetchNextPage={fetchNextPage} isFetchingNextPage={isFetchingNextPage} hasNextPage={hasNextPage}/>
            </TableNavbar2>
            
        </div>
        
        
    )
}