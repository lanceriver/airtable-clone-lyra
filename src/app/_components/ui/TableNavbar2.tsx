"use client"

import React from "react"
import {
  Calendar,
  ChevronDown,
  Grid,
  LayoutGrid,
  Menu,
  Palette,
  Search,
  Share2,
  X,
} from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import type { RouterOutputs } from "~/trpc/react"
import type { ColumnType, ViewFilter, ViewSort } from "~/server/db/rows"
import type { ViewConfigPatch } from "../useUpdateViewConfig"
import TableSidebar from "./TableSidebar"
import { FilterPopover, type AddFilterRequest } from "./FilterPopover"
import { SortPopover } from "./SortPopover"
import { HideFieldsPopover } from "./HideFieldsPopover"
import { FetchProgressBar } from "../toolbar/FetchProgressBar"
import { useAddFakeRows } from "../toolbar/useAddFakeRows"

export type ToolbarColumn = { id: string; name: string; type: ColumnType };

type NavbarProps = {
  baseId: string;
  tableId: string;
  viewId: string;
  viewName: string;
  columns: ToolbarColumn[];
  config: RouterOutputs["view"]["get"]["config"];
  /** The sort to show in the popover: the one being saved, if any, else the saved one. */
  displaySort: ViewSort;
  isSortPending: boolean;
  onUpdateConfig: (patch: ViewConfigPatch) => void;
  searchInput: string;
  onSearchChange: (search: string) => void;
  recordCount?: { count: number; total: number };
  /** Hides the record count (the grid footer shows it instead). */
  hideRecordCount?: boolean;
  /** Shows the thin progress bar under the toolbar while rows are loading. */
  isFetching?: boolean;
  /** Called after "Add 100k rows" succeeds, for the grid to reload its rows. */
  onRowsAdded?: () => void;
  /** Adds a filter on a field and opens the filter popover (field menu). */
  addFilterRequest?: AddFilterRequest | null;
  children: React.ReactNode;
}

function formatRecordCount({ count, total }: { count: number; total: number }) {
  const format = (n: number) => n.toLocaleString("en-US");
  return count === total
    ? `${format(count)} ${count === 1 ? "record" : "records"}`
    : `${format(count)} of ${format(total)} records`;
}

export default function TableNavbar2({
  baseId,
  tableId,
  viewId,
  viewName,
  columns,
  config,
  displaySort,
  isSortPending,
  onUpdateConfig,
  searchInput,
  onSearchChange,
  recordCount,
  hideRecordCount = false,
  isFetching = false,
  onRowsAdded,
  addFilterRequest,
  children,
}: NavbarProps) {
  const addRows = useAddFakeRows({ tableId, onRowsAdded });

  const handleFiltersChange = (filters: ViewFilter[]) => onUpdateConfig({ filters });

  return (
    <div className="flex flex-col h-screen">
      {/* Secondary navigation */}
      <div className="relative flex items-center border-b px-2 py-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="cursor-pointer h-8 gap-1">
                <Menu className="h-4 w-4" />
                <span className="font-normal">Views</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle view sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="mx-2 h-5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="cursor-pointer h-8 gap-1">
              <Grid className="h-4 w-4 text-blue-600" />
              <span className="font-normal">{viewName}</span>
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <Grid className="h-4 w-4 mr-2 text-blue-600" />
              <span>Grid view</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Calendar className="h-4 w-4 mr-2 text-orange-500" />
              <span>Calendar</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LayoutGrid className="h-4 w-4 mr-2 text-purple-600" />
              <span>Gallery</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <HideFieldsPopover
          columns={columns}
          hiddenColumnIds={config.hiddenColumnIds}
          onChange={(hiddenColumnIds) => onUpdateConfig({ hiddenColumnIds })}
        />

        <FilterPopover
          columns={columns}
          filters={config.filters}
          onChange={handleFiltersChange}
          addRequest={addFilterRequest}
        />

        <SortPopover
          columns={columns}
          sort={displaySort}
          isPending={isSortPending}
          onChange={(sort) => onUpdateConfig({ sort })}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="cursor-pointer h-8 gap-1">
              <Palette className="h-4 w-4" />
              <span className="font-normal">Color</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Color by...</DropdownMenuItem>
            <DropdownMenuItem>Clear colors</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="cursor-pointer h-8  gap-1">
          <Share2 className="h-4 w-4" />
          <span className="font-normal">Share and sync</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer h-8 gap-1"
          disabled={addRows.isPending}
          onClick={addRows.add}
        >
          <span className={`font-normal ${addRows.isPending ? "animate-pulse" : ""}`}>
            {addRows.isPending ? "Adding 100k rows..." : "Add 100k rows"}
          </span>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {recordCount && !hideRecordCount && (
            <span className="text-xs text-gray-500" data-testid="record-count">
              {formatRecordCount(recordCount)}
            </span>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className={`h-8 w-8 ${searchInput ? "bg-[#fcd66c]/40" : ""}`} aria-label="Search">
                <Search className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 mr-5 p-0">
              <div>
                <form className="border-0 flex items-center gap-2 p-2" onSubmit={(e) => e.preventDefault()}>
                  <Input
                    placeholder="Find in view"
                    aria-label="Find in view"
                    maxLength={200}
                    className="w-full h-10 border-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    value={searchInput}
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
                  <X
                    aria-label="Clear search"
                    className="cursor-pointer"
                    onClick={() => onSearchChange("")}
                  />
                </form>
              </div>
              
              <div className="p-4 text-xs text-gray-500 bg-gray-100">
                Use advanced search options in the search extension.
              </div>
              
            </PopoverContent>
          </Popover>
        </div>
        <FetchProgressBar active={isFetching} />
      </div>

      <div className="flex w-full overflow-auto">
        {/* Sidebar */}
           <TableSidebar baseId={baseId} tableId={tableId} activeViewId={viewId} />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
