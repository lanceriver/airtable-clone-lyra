"use client";

import {
  Loader2,
  Menu,
  Palette,
  Share2,
  StretchHorizontal,
  Group as GroupIcon,
  Zap,
} from "lucide-react";

import { NotInDemo } from "~/components/at/NotInDemo";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { RouterOutputs } from "~/trpc/react";
import type { ColumnType, ViewFilter, ViewSort } from "~/server/db/rows";
import type { ViewConfigPatch } from "../useUpdateViewConfig";
import { FilterPopover, type AddFilterRequest } from "./FilterPopover";
import { SortPopover } from "./SortPopover";
import { HideFieldsPopover } from "./HideFieldsPopover";
import { FetchProgressBar } from "./FetchProgressBar";
import { SearchPanel } from "./SearchPanel";
import { ViewMenu } from "./ViewMenu";
import { useAddFakeRows } from "./useAddFakeRows";

export type ToolbarColumn = { id: string; name: string; type: ColumnType };

export type ViewToolbarProps = {
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
  /**
   * Records matching the text in the search box, or undefined while the count
   * for that text isn't in yet.
   */
  searchMatchCount?: number;
  /** Shows the thin progress bar under the toolbar while rows are loading. */
  isFetching?: boolean;
  /** Called after "Add 100k rows" succeeds, for the grid to reload its rows. */
  onRowsAdded?: () => void;
  /** Adds a filter on a field and opens the filter popover (field menu). */
  addFilterRequest?: AddFilterRequest | null;
  /** The views sidebar is open; the toggle button shows it. */
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

/** A decorative toolbar button: its label collapses to the icon below 1200 px. */
function DecorativeButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NotInDemo>
      <Button variant="toolbar" size="toolbar" aria-label={label}>
        {icon}
        <span className="max-[1200px]:hidden">{label}</span>
      </Button>
    </NotInDemo>
  );
}

export function ViewToolbar({
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
  searchMatchCount,
  isFetching = false,
  onRowsAdded,
  addFilterRequest,
  sidebarOpen,
  onToggleSidebar,
}: ViewToolbarProps) {
  const addRows = useAddFakeRows({ tableId, onRowsAdded });

  const handleFiltersChange = (filters: ViewFilter[]) =>
    onUpdateConfig({ filters });

  const sidebarLabel = sidebarOpen ? "Hide sidebar" : "Show sidebar";

  return (
    <div
      data-testid="view-toolbar"
      className="border-at-border relative flex h-12 flex-none items-center gap-0.5 border-b bg-white px-3"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="toolbar"
            size="icon-sm"
            aria-label={sidebarLabel}
            aria-expanded={sidebarOpen}
            onClick={onToggleSidebar}
          >
            <Menu />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{sidebarLabel}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-2 h-4" />

      <ViewMenu
        baseId={baseId}
        tableId={tableId}
        viewId={viewId}
        viewName={viewName}
      />

      <div className="ml-auto flex flex-none items-center gap-0.5 pl-2">
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

        <DecorativeButton icon={<GroupIcon />} label="Group" />

        <SortPopover
          columns={columns}
          sort={displaySort}
          isPending={isSortPending}
          onChange={(sort) => onUpdateConfig({ sort })}
        />

        <DecorativeButton icon={<Palette />} label="Color" />

        <NotInDemo>
          <Button variant="toolbar" size="icon-sm" aria-label="Row height">
            <StretchHorizontal />
          </Button>
        </NotInDemo>

        <DecorativeButton icon={<Share2 />} label="Share and sync" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="toolbar"
              size="toolbar"
              className="disabled:opacity-100"
              disabled={addRows.isPending}
              onClick={addRows.add}
            >
              {addRows.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Zap />
              )}
              <span>{addRows.isPending ? "Adding…" : "100k rows"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add 100,000 fake records</TooltipContent>
        </Tooltip>

        <SearchPanel
          searchInput={searchInput}
          onSearchChange={onSearchChange}
          matchCount={searchMatchCount}
        />
      </div>
      <FetchProgressBar active={isFetching} />
    </div>
  );
}
