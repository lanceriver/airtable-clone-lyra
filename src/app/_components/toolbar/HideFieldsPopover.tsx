"use client";

import { useState } from "react";
import { EyeOff, Hash, Search, Type } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { ToolbarColumn } from "./ViewToolbar";

type Props = {
  columns: ToolbarColumn[];
  hiddenColumnIds: string[];
  onChange: (hiddenColumnIds: string[]) => void;
};

export function HideFieldsPopover({
  columns,
  hiddenColumnIds,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");

  // The first field is the primary field and is always visible.
  const primaryId = columns[0]?.id;
  const hiddenIds = new Set(hiddenColumnIds);
  if (primaryId) hiddenIds.delete(primaryId);
  const hiddenCount = columns.filter((c) => hiddenIds.has(c.id)).length;

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? columns.filter((c) => c.name.toLowerCase().includes(needle))
    : columns;

  const toggle = (columnId: string, visible: boolean) => {
    const next = new Set(hiddenIds);
    if (visible) next.delete(columnId);
    else next.add(columnId);
    onChange([...next]);
  };
  const hideAll = () =>
    onChange(columns.filter((c) => c.id !== primaryId).map((c) => c.id));
  const showAll = () => onChange([]);

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 cursor-pointer gap-1 ${hiddenCount > 0 ? "bg-[#d2e5fb] hover:bg-[#c2dbf8]" : ""}`}
        >
          <EyeOff className="h-4 w-4" />
          <span className="font-normal">
            {hiddenCount > 0
              ? `${hiddenCount} hidden ${hiddenCount === 1 ? "field" : "fields"}`
              : "Hide fields"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <Input
            placeholder="Find a field"
            aria-label="Find a field"
            className="h-7 border-none p-0 shadow-none focus-visible:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ul className="max-h-72 overflow-y-auto py-1" aria-label="Fields">
          {matches.map((column) => {
            const isPrimary = column.id === primaryId;
            const Icon = column.type === "number" ? Hash : Type;
            const row = (
              <label
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${isPrimary ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-100"}`}
              >
                <Switch
                  className="h-3.5 w-6 [&_[data-slot=switch-thumb]]:size-2.5"
                  aria-label={`Show ${column.name}`}
                  checked={isPrimary || !hiddenIds.has(column.id)}
                  disabled={isPrimary}
                  onCheckedChange={(checked) => toggle(column.id, checked)}
                />
                <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                <span className="truncate">{column.name}</span>
              </label>
            );
            return (
              <li key={column.id} data-testid="hide-field-row">
                {isPrimary ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{row}</TooltipTrigger>
                    <TooltipContent side="right">
                      The primary field can&apos;t be hidden
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  row
                )}
              </li>
            );
          })}
          {matches.length === 0 && (
            <li className="px-3 py-3 text-sm text-gray-500">No fields match</li>
          )}
        </ul>

        <div className="flex gap-2 border-t p-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 flex-1 cursor-pointer font-normal"
            onClick={hideAll}
          >
            Hide all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 flex-1 cursor-pointer font-normal"
            onClick={showAll}
          >
            Show all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
