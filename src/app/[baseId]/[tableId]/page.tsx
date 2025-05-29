"use client";
import { Table } from "~/app/_components/ui/Table";
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
    const [filters, setFilters] = useState<{ columnId: string; columnName: string; value: string; condition: string } | null>(null);

    const handleSort = (columnId: string, order: "asc" | "desc") => {
        setSort({ columnId, order});
    }

    const { tableId } = params;
    const { data: columns, isLoading: isColumnsLoading } = api.column.getColumns.useQuery({ tableId});
    const columnMap = new Map<string, string>();
    const final = columns?.map((column) => {
            columnMap.set(column.id, column.name);
                return column.id;
            });

    /* const { data: sortedRows, isLoading: isSortedRowsLoading } =
        sort ? api.row.sortRows.useQuery({ columnId: sort.columnId, order: sort.order })
                : { data: null, isLoading: false }; */

    const { data: nextRows, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = 
    
    !sort ? api.row.getRows.useInfiniteQuery(
        {
          tableId: tableId,
          count: 100,
          offset: 0,
        },
        {
          initialCursor: null,
          getNextPageParam: (lastPage) => lastPage.nextCursor,
        }
      ) : api.row.getRows.useInfiniteQuery(
        {
            tableId: tableId,
            count: 100,
            offset: 0,
            sort: sort
        },
        {
            initialCursor: null,
            getNextPageParam: (lastPage) => lastPage.nextCursor
        }
      )
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
    if (isColumnsLoading || isLoading) {
        return <div>Loading...</div>;
    }
    const rowMap = new Map<string, string>();
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
        header: () => <span>{columnMap.get(column.id)}</span>,
        size: 200,
    })));
    if (returnedColumns) {
        tableColumns.push(...returnedColumns);
    }
    return (
        <div className="flex flex-col">
                <Table rows={tableRows ?? []} columns={tableColumns ?? []} tableId={tableId} sort={sort} handleSort={handleSort} fetchNextPage={fetchNextPage} isFetchingNextPage={isFetchingNextPage} hasNextPage={hasNextPage}/>
        </div>
    )
}