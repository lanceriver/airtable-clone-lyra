import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { faker } from "@faker-js/faker";
import type { RowData } from "~/app/[baseId]/[tableId]/page";
import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { CreateColumn } from "./CreateColumn";
import { Plus } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"

export type DefaultTableData = {
    firstName: string;
    lastName: string;
    number: number;
    email: string;
}
import { ColumnDropdown } from "./ColumnDropdown";
import type { CellContext, Table as ReactTable, Row, Column } from "@tanstack/react-table";
import { set } from "zod";
import { Rowdies } from "next/font/google";

type TableCellProps = {
  getValue: () => string | number;
  row: Row<RowData>;
  column: Column<RowData, unknown>;
  table: ReactTable<RowData>;
};

declare module '@tanstack/table-core' {
  interface TableMeta<TData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

export function generateFakeData(count: number, seed: number): DefaultTableData[] {
  faker.seed(seed);
  return Array.from({ length: count }, () => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    number: faker.number.int({ min: 0, max: 10000}),
    email: faker.internet.email(),
  }));
}

export const TableCell = ({getValue, row, column, table}: TableCellProps) => {
    const { mutate: updateCell } = api.cell.updateCell.useMutation({
        onSuccess: () => {
            table.options.meta?.updateData(row.index, column.id, getValue());
        },
        onError: (error) => {
            console.error("Error updating cell:", error);
        }
    })
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);
    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);
    const onBlur = () => {
        table.options.meta?.updateData(row.index, column.id, value);
        if (value !== initialValue) {
            if (typeof value === "string") {
                updateCell({ rowId: row.id, columnId: column.id, stringValue: value });
            }
            else if (typeof value === "number") {
               updateCell({ rowId: row.id, columnId: column.id, numberValue: value });
            }
        }
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value !== initialValue) {
            if (typeof value === "string") {
                console.log("rowId: :", row.id, "columnId: ", column.id, "value: ", value);
                updateCell({ rowId: row.id, columnId: column.id, stringValue: value });
            }
            else if (typeof value === "number") {
               updateCell({ rowId: row.id, columnId: column.id, numberValue: value });
            }
        }
    }
    console.log(value);
    return (
        <form className="w-full border-none bg-transparent focus:outline-none" onSubmit={handleSubmit}>
            <input
                className="w-full border-none bg-transparent focus:outline-none"
                value={value}
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
            />
        </form>
    )
};
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function Table(props: { data: DefaultTableData[], rows: RowData[], columns: ColumnDef<RowData, any>[], tableId: string }) {
  const [ data, setData] = useState(() => [...props.rows]);
  const [dropdownCell, setDropdownCell] = useState<{
    cellId: string;
    rowId: string;
    columnId: string;
  } | null>(null);
  const utils = api.useUtils();
  const table = useReactTable({
    data: props.rows,
    columns: props.columns,
    columnResizeMode: "onChange",
    getRowId: originalRow => originalRow.id,
    getCoreRowModel: getCoreRowModel(),
    rowCount: props.rows.length,
    meta: {
      updateData: (rowIndex: number, columnId: string, value: unknown) => {
        setData((old) =>
          old.map((row, index) => {
            if (index === rowIndex) {
              return {
                ...row,
                [columnId]: value,
              };
            }
            return row;
          })
        )
      }
    }
  });
  const { mutate: createNewColumn } = api.column.createNewColumn.useMutation({
        onSuccess: () => {
          void utils.column.getColumns.invalidate();
            console.log("Column createed");
        },
        onError: (error) => {
            console.error("Error creating column:", error);
        }
    })
  const handleCreateColumn = (tableId: string, position: number, name: string, type: string, operation: string) => {
    createNewColumn({
        tableId: tableId,
        position: position,
        name: name,
        type: type
    });
  }
  const handleCreateRow = (direction?: string, position?: number) => {
    let fnPosition = props.rows.length;
    if (position) {
      fnPosition = position;
    }
    createRow({ tableId: props.tableId, position: fnPosition, direction: direction});
  }
  const { mutate: createRow } = api.row.createRow.useMutation({
    onSuccess: () => {
      void utils.row.getRows.invalidate();
      console.log("Row created");
    },
    onError: (error) => {
      console.error("Error creating row:", error);
    }
  })
  const { mutate: deleteRow } = api.row.deleteRow.useMutation({
    onSuccess: () => {
      void utils.row.getRows.invalidate();
      console.log("Row deleted");
    },
    onError: (error) => {
      console.error("Error deleting row", error);
    }
  })
  const handleDeleteRow = (tableId: string, rowId: string) => {
    deleteRow({
      tableId: tableId,
      rowId: rowId
    })
  };
  const { rows } = table.getRowModel();
  console.log("columns length: ", props.columns.length);
  return (
    <div className="flex flex-row">
      <table className="min-w-3/4 border">
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <React.Fragment key={header.id}>
                <th className="border px-2 bg-gray-100 min-w-2 max-w-4">
                {header.isPlaceholder ? null : (
                <div className="flex justify-between items-center gap-2 text-xs font-normal py-2">
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.index !== 0 && (
                  <ColumnDropdown
                  columnId={header.column.id}
                  columnName={header.column.columnDef.header as string}
                  tableId={props.tableId}
                  />
                )}
                
                </div>
                )}
                </th>
              </React.Fragment>
              
            ))}
            
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.length === 0 ? (
          <tr>
            <td colSpan={props.columns.length} className="text-center py-4 text-gray-400">
              No data
            </td>
          </tr>
        ) : (
          table.getRowModel().rows.map((row, idx, arr) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell, colIdx) => (
              <ContextMenu key={cell.id}>
                <ContextMenuTrigger asChild>
                  <td key={cell.id} className="border px-2 py-1 text-xs">
                        {idx === arr.length - 1
                          ? (colIdx === 0 
                            ? <Plus className="h-4 w-4" onClick={() => handleCreateRow()}/>
                            : flexRender(cell.column.columnDef.cell, cell.getContext()))
                          : flexRender(cell.column.columnDef.cell, cell.getContext())
                        }
                  </td>
                </ContextMenuTrigger>
                    <ContextMenuContent>
                <ContextMenuItem /* onClick={() => handleCreateRow("up", idx + 1)} */>
                  Insert row above
                </ContextMenuItem>
                <ContextMenuItem /* onClick={() => handleCreateRow("down", idx + 1)} */>
                  Insert row below
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDeleteRow(props.tableId, row.id)}>
                  Delete row
                </ContextMenuItem>
              </ContextMenuContent>
              </ContextMenu>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
    <div>
        <CreateColumn tableId={props.tableId} colCount={props.columns.length}/>
    </div>
    
{/*     <pre>{JSON.stringify(data, null, "\t")}</pre> */}
    </div>
  );
}