"use client"

import { ArrowUpDown, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ViewSort } from "~/server/db/rows";
import { SORT_LABELS } from "../filterOptions";
import type { ToolbarColumn } from "./TableNavbar2";

type Props = {
  columns: ToolbarColumn[];
  sort: ViewSort;
  isPending: boolean;
  onChange: (sort: ViewSort) => void;
};

export function SortPopover({ columns, sort, isPending, onChange }: Props) {
  const sortColumn = columns.find((c) => c.id === sort?.columnId);
  const type = sortColumn?.type ?? "string";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`cursor-pointer h-8 gap-1 ${sort ? "bg-[#fef3ea]" : ""}`}>
          <ArrowUpDown className="h-4 w-4" />
          <span className="font-normal">{sort ? `Sorted by ${sortColumn?.name ?? "1 field"}` : "Sort"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-120 p-4" align="start">
        <div className="mb-4 flex flex-row items-center justify-between">
          <h1 className="text-sm font-semibold">Sort by</h1>
          {isPending && (
            <span className="animate-pulse text-xs font-normal text-gray-500">Building index…</span>
          )}
        </div>
        <div className="grid grid-cols-12 gap-x-4 items-center">
          <div className="col-span-5">
            <Select
              value={sort?.columnId ?? ""}
              onValueChange={(columnId) =>
                onChange({ columnId, direction: sort?.direction ?? "asc" })
              }
            >
              <SelectTrigger className="w-full rounded-none" aria-label="Sort field">
                <SelectValue className="text-sm" placeholder="Select a column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>{column.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-5">
            {sort && (
              <Select
                value={sort.direction}
                onValueChange={(direction) =>
                  onChange({ columnId: sort.columnId, direction: direction as "asc" | "desc" })
                }
              >
                <SelectTrigger className="w-full rounded-none" aria-label="Sort direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{SORT_LABELS[type].asc}</SelectItem>
                  <SelectItem value="desc">{SORT_LABELS[type].desc}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="col-span-2 flex items-center justify-center h-10">
            {sort && (
              <X
                aria-label="Remove sort"
                className="h-5 w-5 text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => onChange(null)}
              />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
