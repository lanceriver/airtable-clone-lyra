import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { faker, ro } from "@faker-js/faker";
import type { RowData } from "~/app/[baseId]/[tableId]/page";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { useVirtualizer } from "@tanstack/react-virtual";
import { set, ZodAny } from "zod";


export type TableProps = {
  rows: RowData[];
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  columns: ColumnDef<RowData, any>[];
  tableId: string;
  sort: { columnId: string; order: "asc" | "desc"} | null;
  filteredColumns?: (string | undefined)[];
  handleSort: (columnId: string | null, order: "asc" | "desc", type: "string" | "number") => void;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
  filters?: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty" | null;
  globalSearch?: string | null;
  // eslint-disable-next-line  @typescript-eslint/no-empty-object-type
  visibleColumns?: {};
};

type TableCellProps = {
  getValue: () => string | number;
  row: Row<RowData>;
  column: Column<RowData, unknown>;
  table: ReactTable<RowData>;
  columnType?: string;
};

declare module '@tanstack/table-core' {
  interface TableMeta<TData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    type: "string" | "number"
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

export const TableCell = ({getValue, row, column, table, columnType}: TableCellProps) => {
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
    const [error, setError] = useState<string | null>(null);

    const validate = (value: string) => {
       if (column.columnDef.meta?.type === "number") {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            setError("Please enter a valid number");
            return false;
          }
       }
       setError(null);
       return true;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        validate(newValue);
        if (isNaN(Number(newValue))) {
            setValue(newValue);
        }
        else {
            setValue(Number(newValue));
        }
    };

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const onBlur = () => {
        if (error) {
            setValue(initialValue);
            setError(null);
            return;
        }
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
                updateCell({ rowId: row.id, columnId: column.id, stringValue: value });
            }
            else if (typeof value === "number") {
               updateCell({ rowId: row.id, columnId: column.id, numberValue: value });
            }
        }
    }
    return (
        <form className="w-full border-none bg-transparent focus:outline-none focus:bg-white" onSubmit={handleSubmit}>
            <input
                className="w-full border-none bg-transparent focus:outline-none focus:bg-white"
                value={value ?? ""}
                onChange={handleChange}
                onBlur={onBlur}
                type="text"
                pattern={column.columnDef.meta?.type === "number" ? "[0-9]*" : ".*"}
            />
            {error && <span className="text-red-500 text-xs">{error}</span>}
        </form>
        
    )
};


// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function Table({rows: propRows, columns, tableId, handleSort, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, sort, filteredColumns, globalSearch, visibleColumns}: TableProps) {
  const [ data, setData] = useState(() => [...propRows]);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const utils = api.useUtils();

  const shouldHighlight = (cellValue: string | number | null) => {
    if (!globalSearch || !cellValue) return false;
    return cellValue.toString().toLowerCase().includes(globalSearch.toLowerCase());
  };
  

  const table = useReactTable({
    data: propRows,
    columns: columns,
    state: {
      columnVisibility: visibleColumns ?? {},
    },
    columnResizeMode: "onChange",
    getRowId: originalRow => originalRow.id,
    getCoreRowModel: getCoreRowModel(),
    rowCount: propRows.length,
    defaultColumn: {
      size:200
    },
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

  const { rows } = table.getRowModel();

  const handleCreateRow = (direction?: string, position?: number) => {
    let fnPosition = rows.length;
    if (position) {
      fnPosition = position;
    }
    createRow({ tableId: tableId, position: fnPosition, direction: direction});
  }

  const { mutate: createRow, isPending: pendingCreateRow } = api.row.createRow.useMutation({
    onSuccess: () => {
      void utils.row.getRows.invalidate();
      void utils.row.sortRows.invalidate();
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
  
  const tableRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
      count: rows.length + 1,
      estimateSize: () => 33,
      getScrollElement: () => tableRef.current,
      overscan: 50,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  
  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();
    
    if (!lastItem) {
      return;
    }
    if (lastItem.index >= rows.length - 50 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage?.(); 
    }
  }, [fetchNextPage, rows.length, hasNextPage, virtualItems]);

  function handleSortClick(columnId: string, order: "asc" | "desc"): void {
    handleSort(columnId, order, columns.find(col => col.id === columnId)?.meta?.type ?? "string");
    void utils.row.getRows.invalidate();
  }
  console.log(rows.length, "rows length");

  return (
    <div className="flex flex-row overflow-auto relative h-screen" style={{minHeight:400, overscrollBehavior: 'contain'}} ref={tableRef} >
      <table className="table-fixed min-w-max">
      <thead className="grid sticky top-0 z-10">
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id} className="sticky flex w-full">
            {headerGroup.headers.map((header, idx) => (
              <React.Fragment key={header.id}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                <th
                  className={`border border-b border-r-0 last:border-r border-t-0 px-2 bg-gray-100 sticky top-0 z-10 ${header.column.id === 'id' ? 'w-[80px] min-w-[80px] max-w-[80px]' : ''} ${sort?.columnId === header.column.id ? 'bg-blue-50' : ''}`}
                  style={header.column.id !== 'id' ? { width: `${header.column.getSize()}px`, minWidth: `${header.column.getSize()}px`, maxWidth: `${header.column.getSize()}px` } : {}}
                >
                  {header.isPlaceholder ? null : (
                    <div className="flex justify-between items-center gap-2 text-xs font-normal py-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sort?.columnId === header.column.id && (
                        <span className="text-blue-500">
                          {sort.order === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                      {header.index !== 0 && (
                        <ColumnDropdown
                          columnId={header.column.id}
                          columnName={header.column.columnDef.header as string}
                          tableId={tableId}
                        />
                      )}
                    </div>
                  )}
                </th>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleSortClick(header.column.id, "asc")}>
                      Sort A-Z
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                        handleSortClick(header.column.id, "desc")
                        setActiveFilterColumn(header.column.id)
                      }
                    }>
                      Sort Z-A
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                
              </React.Fragment>
              
            ))}
            
          </tr>
        ))}
      </thead>
      <tbody style={{display: 'grid', height: `${rowVirtualizer.getTotalSize()}px`, position: "relative"}} >
        {table.getRowModel().rows.length === 0 && !isLoading ? (
          <tr>
            <td colSpan={columns.length} className="text-center py-4 text-gray-400">
              No data available for this filter!
            </td>
          </tr>
        ) : (
          rowVirtualizer.getVirtualItems().map(virtualRow => {
            const isLastRow = virtualRow.index === rows.length;

            if (isLastRow) {
      return (
        <tr 
          data-index={virtualRow.index}
          key="add-row"
          className="hover:bg-gray-50 relative"
          style={{
            display: 'flex',
            transform: `translateY(${virtualRow.start}px)`,
            position: 'absolute',
            width: "100%",
          }}
        >
          {table.getAllColumns().map((column, idx) => (
            <td 
              key={column.id}
              className={`border border-t-0 border-r-0 border-l-0 first:border-l last:border-r flex items-center px-2 py-2 text-xs ${
                column.id === 'id' ? 'w-[80px] min-w-[80px] max-w-[80px]' : ''
              }`}
              style={column.id !== 'id' ? {
                width: `${column.getSize()}px`,
                minWidth: `${column.getSize()}px`,
                maxWidth: `${column.getSize()}px`
              } : {}}
            >
              {idx === 0 && (
                pendingCreateRow ? '...' : <Plus className="h-4 w-4" onClick={() => handleCreateRow()}/>
              )}
            </td>
          ))}
        </tr>
      );
    }


            const row = rows[virtualRow.index];
            if (!row) return null;
            const idx = virtualRow.index;
            const arr = rows;

            return (
              <tr 
                data-index={virtualRow.index} // dynamic row measurement
                ref={node => { if (node) {
                    rowVirtualizer.measureElement(node)} // measure dynamic row height
                }}
                key={`${row.id}-${virtualRow.index}`}
                className="hover:bg-gray-100 transition-colors duration-200 relative"
                style={{
                  display: 'flex',
                  transform: `translateY(${virtualRow.start}px)`,
                  top: 0,
                  left: 0,
                  position: 'absolute',
                  width: "100%",
                }}
              >
                {row.getVisibleCells().map((cell, colIdx) => (
                  <ContextMenu key={colIdx}>
                    <ContextMenuTrigger asChild>
                      <td key={cell.id} className={`border border-r-0 flex px-2 py-2 text-xs focus-within:bg-white focus-within:border-blue-400 focus-within:border-2 last:border-r
                            ${idx === 0 ? 'border-t-0' : ''}
                            ${idx === arr.length - 1 ? '' : 'border-b-0'}
                            ${shouldHighlight(cell.getValue() as string | number | null) ? 'bg-[#fcd66c]' : ''}
                            ${cell.column.id === 'id' ? 'w-[80px] min-w-[80px] max-w-[80px]' : ''} 
                            ${sort?.columnId === cell.column.id && idx !== arr.length ? 'bg-[#fef3ea]' : ''}
                            ${filteredColumns?.includes(cell.column.id) === true && idx !== arr.length ? 'bg-[#eafbeb]' : ''}`} 
                            style={cell.column.id !== 'id' ? {width: `${cell.column.getSize()}px`, minWidth: `${cell.column.getSize()}px`, maxWidth: `${cell.column.getSize()}px`} : {}}>
                        {isLastRow ? (colIdx === 0 ? (pendingCreateRow ? '...' : <Plus className="h-4 w-4" onClick={() => handleCreateRow()}/>) : flexRender(cell.column.columnDef.cell, {...cell.getContext()})) 
                          : flexRender(cell.column.columnDef.cell, {...cell.getContext()})
                        }
                      </td>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleDeleteRow(tableId, row.id)}>
                        Delete row
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
    <div className="sticky top-0 grid border-l-0">
        <CreateColumn tableId={tableId} colCount={columns.length}/>
    </div>
    </div>
  );
}