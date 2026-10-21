"use client"

import { useEffect, useRef, useState } from "react";
import { Filter, Plus, TrashIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import type { FilterOperator, ViewFilter } from "~/server/db/rows";
import {
  OPERATOR_LABELS,
  operatorNeedsValue,
  operatorsFor,
} from "../filterOptions";
import type { ToolbarColumn } from "./TableNavbar2";

const MAX_FILTERS = 20;
const SAVE_DELAY_MS = 300;

type DraftFilter = {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: string;
};

function toDraft(filter: ViewFilter): DraftFilter {
  return {
    id: filter.id,
    columnId: filter.columnId,
    operator: filter.operator,
    value: filter.value === null || filter.value === undefined ? "" : String(filter.value),
  };
}

function isActive(draft: DraftFilter): boolean {
  return !operatorNeedsValue(draft.operator) || draft.value.trim() !== "";
}

function toFilter(draft: DraftFilter, columns: ToolbarColumn[]): ViewFilter {
  const filter: ViewFilter = {
    id: draft.id,
    columnId: draft.columnId,
    operator: draft.operator,
  };
  const value = draft.value.trim();
  if (!operatorNeedsValue(draft.operator) || value === "") return filter;
  const isNumber = columns.find((c) => c.id === draft.columnId)?.type === "number";
  const numeric = Number(value);
  return { ...filter, value: isNumber && Number.isFinite(numeric) ? numeric : value };
}

type Props = {
  columns: ToolbarColumn[];
  filters: ViewFilter[];
  onChange: (filters: ViewFilter[]) => void;
};

export function FilterPopover({ columns, filters, onChange }: Props) {
  const [drafts, setDrafts] = useState<DraftFilter[]>(() => filters.map(toDraft));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<(() => void) | null>(null);

  // Send a still-waiting change when the toolbar goes away (e.g. view switch).
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      pending.current?.();
    };
  }, []);

  const update = (next: DraftFilter[], debounce: boolean) => {
    setDrafts(next);
    if (timer.current) clearTimeout(timer.current);
    const save = () => {
      pending.current = null;
      timer.current = null;
      onChange(next.map((d) => toFilter(d, columns)));
    };
    if (debounce) {
      pending.current = save;
      timer.current = setTimeout(save, SAVE_DELAY_MS);
    } else {
      save();
    }
  };

  const typeOf = (columnId: string) =>
    columns.find((c) => c.id === columnId)?.type ?? "string";

  const addFilter = () => {
    const column = columns[0];
    if (!column) return;
    update(
      [
        ...drafts,
        {
          id: crypto.randomUUID(),
          columnId: column.id,
          operator: operatorsFor(column.type)[0]!,
          value: "",
        },
      ],
      false,
    );
  };

  const patchFilter = (id: string, patch: Partial<DraftFilter>, debounce = false) => {
    update(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)), debounce);
  };

  const changeColumn = (draft: DraftFilter, columnId: string) => {
    const type = typeOf(columnId);
    const keepOperator = operatorsFor(type).includes(draft.operator);
    patchFilter(draft.id, {
      columnId,
      operator: keepOperator ? draft.operator : operatorsFor(type)[0]!,
      value: type === typeOf(draft.columnId) ? draft.value : "",
    });
  };

  const removeFilter = (id: string) => {
    update(drafts.filter((d) => d.id !== id), false);
  };

  const activeFields = new Set(drafts.filter(isActive).map((d) => d.columnId)).size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`cursor-pointer h-8 gap-1 ${activeFields > 0 ? "bg-[#eafbeb]" : ""}`}>
          <Filter className="h-4 w-4" />
          <span className="font-normal">
            {activeFields > 0
              ? `Filtered by ${activeFields} ${activeFields === 1 ? "field" : "fields"}`
              : "Filter"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid grid-cols-1 gap-y-5 w-150" align="start">
        <Label>
          {drafts.length === 0
            ? "No filter conditions are applied"
            : "In this view, show records"}
        </Label>
        {drafts.map((draft, index) => {
          const type = typeOf(draft.columnId);
          return (
            <div key={draft.id} className="flex flex-row gap-2 items-center" data-testid="filter-row">
              <span className="w-12 shrink-0 text-sm">{index === 0 ? "Where" : "And"}</span>
              <Select value={draft.columnId} onValueChange={(value) => changeColumn(draft, value)}>
                <SelectTrigger className="w-[150px] rounded-none" aria-label="Filter field">
                  <SelectValue placeholder="Select a column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>{column.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={draft.operator}
                onValueChange={(value) => patchFilter(draft.id, { operator: value as FilterOperator })}
              >
                <SelectTrigger className="w-[150px] rounded-none" aria-label="Filter operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operatorsFor(type).map((operator) => (
                    <SelectItem key={operator} value={operator}>{OPERATOR_LABELS[operator]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {operatorNeedsValue(draft.operator) && (
                <Input
                  aria-label="Filter value"
                  placeholder="Enter a value"
                  className="text-sm rounded-none"
                  type={type === "number" ? "number" : "text"}
                  step="any"
                  value={draft.value}
                  onChange={(e) => patchFilter(draft.id, { value: e.target.value }, true)}
                />
              )}
              <div className="border ml-auto">
                <TrashIcon
                  aria-label="Remove filter"
                  className="h-[34px] w-[33px] p-2 hover:text-red-500 cursor-pointer"
                  onClick={() => removeFilter(draft.id)}
                />
              </div>
            </div>
          );
        })}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            disabled={drafts.length >= MAX_FILTERS || columns.length === 0}
            onClick={addFilter}
          >
            <Plus className="h-4 w-4" />
            Add condition
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
