"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type TableListMenuProps = {
  baseId: string;
  tables: { id: string; name: string }[];
  activeTableId: string | undefined;
};

/** The "▾" button after the tabs: every table in a searchable list. */
export function TableListMenu({
  baseId,
  tables,
  activeTableId,
}: TableListMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? tables.filter((t) => t.name.toLowerCase().includes(needle))
    : tables;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="All tables"
          className="text-at-text-muted hover:text-at-text flex-none hover:bg-black/5"
        >
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <div className="relative">
          <Search className="text-at-text-muted pointer-events-none absolute top-2 left-2 size-4" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a table"
            aria-label="Find a table"
            className="pl-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                listRef.current?.querySelector("a")?.click();
              }
            }}
          />
        </div>
        <div
          ref={listRef}
          className="mt-1.5 max-h-72 overflow-y-auto"
          role="list"
        >
          {matches.length === 0 ? (
            <p className="text-at-text-muted px-2.5 py-2 text-[13px]">
              No tables found
            </p>
          ) : (
            matches.map((table) => {
              const active = table.id === activeTableId;
              return (
                <Link
                  key={table.id}
                  role="listitem"
                  href={`/${baseId}/${table.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "text-at-text hover:bg-at-hover flex h-8 items-center gap-2 rounded-sm px-2.5 text-[13px]",
                    active && "bg-at-selected font-medium",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{table.name}</span>
                  {active && (
                    <Check className="text-at-text-muted size-4 flex-none" />
                  )}
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
