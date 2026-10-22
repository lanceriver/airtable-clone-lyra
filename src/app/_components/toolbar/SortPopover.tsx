"use client";

import { ArrowUpDown, Plus, X } from "lucide-react";
import { NotInDemo } from "~/components/at/NotInDemo";
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
import { cn } from "~/lib/utils";
import type { ViewSort } from "~/server/db/rows";
import { SORT_LABELS } from "../filterOptions";
import type { ToolbarColumn } from "./ViewToolbar";

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
        <Button
          variant="toolbar"
          size="toolbar"
          className={cn(
            "data-[state=open]:bg-at-hover data-[state=open]:text-at-text",
            sort &&
              "bg-at-sort-tint text-at-text hover:bg-at-sort-tint/80 data-[state=open]:bg-at-sort-tint",
          )}
        >
          <ArrowUpDown />
          <span>{sort ? "Sorted by 1 field" : "Sort"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-110 max-w-[calc(100vw-32px)] p-4 text-[13px]"
        align="start"
      >
        <div className="text-at-text-muted mb-3 flex flex-row items-center justify-between text-[13px]">
          <span>Sort by</span>
          {isPending && (
            <span className="text-at-text-subtle animate-pulse text-xs">
              Building index…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sort?.columnId ?? ""}
            onValueChange={(columnId) =>
              onChange({ columnId, direction: sort?.direction ?? "asc" })
            }
          >
            <SelectTrigger className="min-w-0 flex-1" aria-label="Sort field">
              <SelectValue placeholder="Select a field" />
            </SelectTrigger>
            <SelectContent>
              {columns.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sort && (
            <Select
              value={sort.direction}
              onValueChange={(direction) =>
                onChange({
                  columnId: sort.columnId,
                  direction: direction as "asc" | "desc",
                })
              }
            >
              <SelectTrigger
                className="w-32 shrink-0"
                aria-label="Sort direction"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">{SORT_LABELS[type].asc}</SelectItem>
                <SelectItem value="desc">{SORT_LABELS[type].desc}</SelectItem>
              </SelectContent>
            </Select>
          )}
          {sort && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove sort"
              onClick={() => onChange(null)}
            >
              <X />
            </Button>
          )}
        </div>
        {sort && (
          <div className="mt-3">
            <NotInDemo>
              <Button
                variant="ghost"
                size="toolbar"
                className="text-at-primary hover:text-at-primary [&_svg:not([class*='text-'])]:text-at-primary -ml-2 font-medium"
              >
                <Plus />
                Add another sort
              </Button>
            </NotInDemo>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
