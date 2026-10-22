"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChartGantt,
  ChartNoAxesGantt,
  ClipboardList,
  LayoutGrid,
  List,
  Plus,
  Sheet as SheetIcon,
  SquareKanban,
  type LucideIcon,
} from "lucide-react";

import { NotInDemo } from "~/components/at/NotInDemo";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";

const itemClass =
  "text-at-text hover:bg-at-hover flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 text-left text-[13px] outline-none focus-visible:bg-at-hover";

/** The view types of the create menu, with Airtable's colours. */
const OTHER_TYPES: { name: string; icon: LucideIcon; color: string }[] = [
  { name: "Form", icon: ClipboardList, color: "text-[#dd04a8]" },
  { name: "Calendar", icon: CalendarDays, color: "text-[#d54401]" },
  { name: "Gallery", icon: LayoutGrid, color: "text-[#7c39ed]" },
  { name: "Kanban", icon: SquareKanban, color: "text-[#048a0e]" },
  { name: "Timeline", icon: ChartNoAxesGantt, color: "text-[#ef3061]" },
  { name: "List", icon: List, color: "text-[#166ee1]" },
  { name: "Gantt", icon: ChartGantt, color: "text-[#0b7e8c]" },
];

/**
 * "+ Create new…": a popover of view types. Only Grid works (it calls
 * `onCreateGrid`); the other types and "New section" are decorative.
 */
export function CreateViewMenu({ onCreateGrid }: { onCreateGrid: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
          data-testid="create-view-trigger"
        >
          <Plus />
          Create new…
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <button
          type="button"
          className={itemClass}
          onClick={() => {
            setOpen(false);
            onCreateGrid();
          }}
        >
          <SheetIcon className="text-at-blue size-4" />
          Grid
        </button>
        {OTHER_TYPES.map(({ name, icon: Icon, color }) => (
          <NotInDemo key={name} className="w-full" side="right">
            <button type="button" className={itemClass}>
              <Icon className={`${color} size-4`} />
              {name}
            </button>
          </NotInDemo>
        ))}
        <Separator className="bg-at-border my-1.5" />
        <NotInDemo className="w-full" side="right">
          <button type="button" className={itemClass}>
            <Plus className="text-at-text-muted size-4" />
            New section
          </button>
        </NotInDemo>
      </PopoverContent>
    </Popover>
  );
}
