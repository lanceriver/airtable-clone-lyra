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
import { cn } from "~/lib/utils";
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
          variant="toolbar"
          size="toolbar"
          className={cn(
            "data-[state=open]:bg-at-hover data-[state=open]:text-at-text",
            hiddenCount > 0 &&
              "bg-at-hidden-tint text-at-text hover:bg-at-hidden-tint/80 data-[state=open]:bg-at-hidden-tint",
          )}
        >
          <EyeOff />
          <span>
            {hiddenCount > 0
              ? `${hiddenCount} hidden ${hiddenCount === 1 ? "field" : "fields"}`
              : "Hide fields"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 text-[13px]" align="start">
        <div className="border-at-border flex items-center gap-2 border-b px-3 py-2">
          <Search className="text-at-text-muted size-4 shrink-0" />
          <Input
            placeholder="Find a field"
            aria-label="Find a field"
            className="h-7 border-none p-0 shadow-none focus-visible:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ul className="max-h-72 overflow-y-auto p-1.5" aria-label="Fields">
          {matches.map((column) => {
            const isPrimary = column.id === primaryId;
            const Icon = column.type === "number" ? Hash : Type;
            const row = (
              <label
                className={cn(
                  "flex h-8 items-center gap-2 rounded-sm px-2.5 text-[13px]",
                  isPrimary
                    ? "cursor-not-allowed"
                    : "hover:bg-at-hover cursor-pointer",
                )}
              >
                <Switch
                  className="h-3.5 w-6 [&_[data-slot=switch-thumb]]:size-2.5"
                  aria-label={`Show ${column.name}`}
                  checked={isPrimary || !hiddenIds.has(column.id)}
                  disabled={isPrimary}
                  onCheckedChange={(checked) => toggle(column.id, checked)}
                />
                <Icon className="text-at-text-muted size-4 shrink-0" />
                <span className="text-at-text truncate">{column.name}</span>
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
            <li className="text-at-text-muted px-2.5 py-2">No fields match</li>
          )}
        </ul>

        <div className="border-at-border flex gap-2 border-t p-2">
          <Button
            variant="secondary"
            size="default"
            className="flex-1"
            onClick={hideAll}
          >
            Hide all
          </Button>
          <Button
            variant="secondary"
            size="default"
            className="flex-1"
            onClick={showAll}
          >
            Show all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
