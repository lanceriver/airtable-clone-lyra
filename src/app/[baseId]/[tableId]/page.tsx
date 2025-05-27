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
    cells: {
        id: string;
        columnId: string;
        rowId: string;
        stringValue?: string | null;
        numberValue?: number | null;
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
    const data = useMemo(() => {
        return generateFakeData(5, seed);
    }, []);
    const handleSort = (columnId: string, order: "asc" | "desc") => {
        setSort({ columnId, order});
    }

    const { tableId } = params;
    const { data: columns, isLoading: isColumnsLoading } = api.column.getColumns.useQuery({ tableId});
    console.log("Columns are: ", columns);
    const columnMap = new Map<string, string>();
    const final = columns?.map((column) => {
            columnMap.set(column.id, column.name);
                return column.id;
            });
    console.log("mAP IS: ", columnMap);
    const { data: sortedRows, isLoading: isSortedRowsLoading } =
  sort
    ? api.row.sortRows.useQuery({ columnId: sort.columnId, order: sort.order })
    : { data: null, isLoading: false };
  console.log("Sorted rows are: ", sortedRows);
const { data: rows, isLoading: isRowsLoading } =
  !sort
    ? api.row.getRows.useQuery({ tableId, count: 100, offset: 0 })
    : { data: null, isLoading: false };

// Choose which data to use
const tableRows = sort ? sortedRows : rows;
const loading = isColumnsLoading || isRowsLoading || isSortedRowsLoading;
    console.log("Rows are: ", rows);
    if (isColumnsLoading || isRowsLoading) {
        return <div>Loading...</div>;
    }
    const rowMap = new Map<string, string>();
    const tableColumns = [];
    const idColumn = {
            id: "id",
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
    })));
    if (returnedColumns) {
        tableColumns.push(...returnedColumns);
    }
    console.log("The table columns are: ", tableColumns);
    return (
        <div className="flex flex-col h-full overflow-y-auto">
                <Table data={data} rows={tableRows ?? []} columns={tableColumns ?? []} tableId={tableId} sort={sort} handleSort={handleSort}/>
        </div>
    )
}