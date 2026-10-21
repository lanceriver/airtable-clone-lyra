import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type {
  CellContext,
  Column,
  ColumnDef,
  Row,
  Table as ReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { ColumnType, RowRecord, ViewSort } from "~/server/db/rows";
import { CreateColumn } from "./CreateColumn";
import { ColumnDropdown } from "./ColumnDropdown";
import { Plus } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { SORT_LABELS } from "../filterOptions";

export const ROW_NUMBER_COLUMN_ID = "rowNumber";

export type TableProps = {
  rows: RowRecord[];
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  columns: ColumnDef<RowRecord, any>[];
  tableId: string;
  sort: ViewSort;
  filteredColumns?: string[];
  columnVisibility?: VisibilityState;
  search?: string;
  onSort: (columnId: string, direction: "asc" | "desc") => void;
  onRowUpdated: (row: RowRecord) => void;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
};

type TableCellProps = {
  getValue: () => string | number;
  row: Row<RowRecord>;
  column: Column<RowRecord, unknown>;
  table: ReactTable<RowRecord>;
};

declare module '@tanstack/table-core' {
  interface TableMeta<TData> {
    updateCell: (rowId: string, columnId: string, value: string) => Promise<RowRecord | null>;
  }
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    type: ColumnType;
    name: string;
  }
}

export const RowNumberCell = (info: CellContext<RowRecord, unknown>) => info.row.index + 1;

export const TableCell = ({getValue, row, column, table}: TableCellProps) => {
    const initialValue = String(getValue());
    const [value, setValue] = useState(initialValue);
    const isSaving = useRef(false);
    const isCancelled = useRef(false);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const commit = async () => {
        if (isCancelled.current) {
            isCancelled.current = false;
            return;
        }
        if (value === initialValue || isSaving.current) return;
        isSaving.current = true;
        const updated = await table.options.meta?.updateCell(row.id, column.id, value);
        isSaving.current = false;
        setValue(updated ? String(updated.data[column.id] ?? "") : initialValue);
    };

    return (
        <input
            className="w-full border-none bg-transparent focus:outline-none focus:bg-white"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                    isCancelled.current = true;
                    setValue(initialValue);
                    e.currentTarget.blur();
                }
            }}
            type="text"
        />
    )
};


export function Table({rows: propRows, columns, tableId, onSort, onRowUpdated, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, sort, filteredColumns, search, columnVisibility}: TableProps) {
  const utils = api.useUtils();

  const shouldHighlight = (cellValue: string | number) => {
    if (!search || cellValue === "") return false;
    return cellValue.toString().toLowerCase().includes(search.toLowerCase());
  };

  const { mutateAsync: updateCell } = api.row.updateCell.useMutation({
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const table = useReactTable({
    data: propRows,
    columns: columns,
    state: {
      columnVisibility: columnVisibility ?? {},
    },
    columnResizeMode: "onChange",
    getRowId: originalRow => originalRow.id,
    getCoreRowModel: getCoreRowModel(),
    rowCount: propRows.length,
    defaultColumn: {
      size:200
    },
    meta: {
      updateCell: async (rowId, columnId, value) => {
        try {
          const updated = await updateCell({ rowId, columnId, value });
          onRowUpdated(updated);
          return updated;
        } catch {
          return null;
        }
      },
    },
  });

  const { rows } = table.getRowModel();

  const invalidateRows = () => {
    void utils.row.getRows.invalidate();
    void utils.row.countRows.invalidate();
  };

  const { mutate: createRow, isPending: pendingCreateRow } = api.row.createRow.useMutation({
    onSuccess: invalidateRows,
    onError: (error) => {
      toast.error(error.message);
    }
  })

  const { mutate: deleteRows } = api.row.deleteRows.useMutation({
    onSuccess: invalidateRows,
    onError: (error) => {
      toast.error(error.message);
    }
  })

  const handleCreateRow = () => {
    createRow({ tableId });
  }

  const handleDeleteRow = (rowId: string) => {
    deleteRows({ tableId, rowIds: [rowId] });
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
  }, [fetchNextPage, rows.length, hasNextPage, isFetchingNextPage, virtualItems]);

  return (
    <div className="flex flex-row overflow-auto relative h-screen" style={{minHeight:400, overscrollBehavior: 'contain'}} ref={tableRef} >
      <table className="table-fixed min-w-max">
      <thead className="grid sticky top-0 z-10">
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id} className="sticky flex w-full">
            {headerGroup.headers.map((header) => {
              const isRowNumber = header.column.id === ROW_NUMBER_COLUMN_ID;
              const columnType = header.column.columnDef.meta?.type ?? "string";
              return (
              <React.Fragment key={header.id}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                <th
                  className={`border border-b border-r-0 last:border-r border-t-0 px-2 bg-gray-100 sticky top-0 z-10 ${isRowNumber ? 'w-[80px] min-w-[80px] max-w-[80px]' : ''} ${sort?.columnId === header.column.id ? 'bg-blue-50' : ''}`}
                  style={!isRowNumber ? { width: `${header.column.getSize()}px`, minWidth: `${header.column.getSize()}px`, maxWidth: `${header.column.getSize()}px` } : {}}
                >
                  {header.isPlaceholder ? null : (
                    <div className="flex justify-between items-center gap-2 text-xs font-normal py-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sort?.columnId === header.column.id && (
                        <span className="text-blue-500">
                          {sort.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                      {!isRowNumber && (
                        <ColumnDropdown
                          columnId={header.column.id}
                          columnName={header.column.columnDef.meta?.name ?? ""}
                          tableId={tableId}
                        />
                      )}
                    </div>
                  )}
                </th>
                  </ContextMenuTrigger>
                  {!isRowNumber && (
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onSort(header.column.id, "asc")}>
                      Sort {SORT_LABELS[columnType].asc}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onSort(header.column.id, "desc")}>
                      Sort {SORT_LABELS[columnType].desc}
                    </ContextMenuItem>
                  </ContextMenuContent>
                  )}
                </ContextMenu>
                
              </React.Fragment>
              );
            })}
            
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
          {table.getVisibleLeafColumns().map((column, idx) => (
            <td 
              key={column.id}
              className={`border border-t-0 border-r-0 border-l-0 first:border-l last:border-r flex items-center px-2 py-2 text-xs ${
                column.id === ROW_NUMBER_COLUMN_ID ? 'w-[80px] min-w-[80px] max-w-[80px]' : ''
              }`}
              style={column.id !== ROW_NUMBER_COLUMN_ID ? {
                width: `${column.getSize()}px`,
                minWidth: `${column.getSize()}px`,
                maxWidth: `${column.getSize()}px`
              } : {}}
            >
              {idx === 0 && (
                pendingCreateRow ? '...' : <Plus className="h-4 w-4 cursor-pointer" aria-label="Add row" onClick={handleCreateRow}/>
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
                {row.getVisibleCells().map((cell) => (
                  <ContextMenu key={cell.id}>
                    <ContextMenuTrigger asChild>
                      <td className={`border border-r-0 flex px-2 py-2 text-xs focus-within:bg-white focus-within:border-blue-400 focus-within:border-2 last:border-r
                            ${idx === 0 ? 'border-t-0' : ''}
                            ${idx === arr.length - 1 ? '' : 'border-b-0'}
                            ${cell.column.id !== ROW_NUMBER_COLUMN_ID && shouldHighlight(cell.getValue() as string | number) ? 'bg-[#fcd66c]' : ''}
                            ${cell.column.id === ROW_NUMBER_COLUMN_ID ? 'w-[80px] min-w-[80px] max-w-[80px]' : ''} 
                            ${sort?.columnId === cell.column.id ? 'bg-[#fef3ea]' : ''}
                            ${filteredColumns?.includes(cell.column.id) === true ? 'bg-[#eafbeb]' : ''}`} 
                            style={cell.column.id !== ROW_NUMBER_COLUMN_ID ? {width: `${cell.column.getSize()}px`, minWidth: `${cell.column.getSize()}px`, maxWidth: `${cell.column.getSize()}px`} : {}}>
                        {flexRender(cell.column.columnDef.cell, {...cell.getContext()})}
                      </td>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleDeleteRow(row.id)}>
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
        <CreateColumn tableId={tableId}/>
    </div>
    </div>
  );
}
