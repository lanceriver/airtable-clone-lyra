"use client"

import { EyeOff } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import type { ToolbarColumn } from "./TableNavbar2";

type Props = {
  columns: ToolbarColumn[];
  hiddenColumnIds: string[];
  onChange: (hiddenColumnIds: string[]) => void;
};

export function HideFieldsPopover({ columns, hiddenColumnIds, onChange }: Props) {
  const hiddenCount = columns.filter((c) => hiddenColumnIds.includes(c.id)).length;

  const toggle = (columnId: string, visible: boolean) => {
    onChange(
      visible
        ? hiddenColumnIds.filter((id) => id !== columnId)
        : [...hiddenColumnIds, columnId],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`cursor-pointer h-8 gap-1 ${hiddenCount > 0 ? "bg-[#e6f0fb]" : ""}`}>
          <EyeOff className="h-4 w-4" />
          <span className="font-normal">
            {hiddenCount > 0
              ? `${hiddenCount} hidden ${hiddenCount === 1 ? "field" : "fields"}`
              : "Hide fields"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="start">
        <div className="space-y-4 mb-4">
          <h3 className="text-sm font-semibold">Hide/Show Fields</h3>
        </div>
        <div className="grid grid-cols-1 gap-y-4">
          {columns.map((column) => (
            <div key={column.id} className="flex items-center space-x-2">
              <Switch
                id={`visible-${column.id}`}
                checked={!hiddenColumnIds.includes(column.id)}
                onCheckedChange={(checked) => toggle(column.id, checked)}
              />
              <Label htmlFor={`visible-${column.id}`} className="text-sm">
                {column.name}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
