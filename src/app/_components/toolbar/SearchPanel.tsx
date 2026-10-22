"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

type Props = {
  searchInput: string;
  onSearchChange: (search: string) => void;
  /**
   * How many records match the text in the box. Undefined while the count for
   * that text isn't in yet (never the previous search's count).
   */
  matchCount: number | undefined;
};

function matchLabel(count: number): string {
  if (count === 0) return "No records";
  return `${count.toLocaleString("en-US")} ${count === 1 ? "record" : "records"}`;
}

/**
 * The toolbar's magnifier and the "Find in view" panel under it. Esc closes
 * the panel and keeps the search; the magnifier is tinted while one is active.
 */
export function SearchPanel({
  searchInput,
  onSearchChange,
  matchCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const active = searchInput !== "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="toolbar"
          size="icon-sm"
          aria-label="Search"
          className={cn(
            "data-[state=open]:bg-at-hover data-[state=open]:text-at-text",
            active && "text-at-text bg-[#fcd66c]/50 hover:bg-[#fcd66c]/70",
          )}
        >
          <Search />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const input = (event.currentTarget as HTMLElement).querySelector(
            "input",
          );
          input?.focus();
          input?.select();
        }}
      >
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => event.preventDefault()}
        >
          <Input
            placeholder="Find in view"
            aria-label="Find in view"
            maxLength={200}
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear search"
            disabled={!active}
            onClick={(event) => {
              onSearchChange("");
              event.currentTarget.form?.querySelector("input")?.focus();
            }}
          >
            <X />
          </Button>
        </form>
        <div
          className="text-at-text-muted mt-2 h-4 text-xs"
          role="status"
          data-testid="search-match-count"
        >
          {active &&
            (matchCount === undefined ? (
              <span className="text-at-text-subtle">Searching…</span>
            ) : (
              matchLabel(matchCount)
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
