"use client";

import { CircleHelp } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type HelpButtonProps = {
  /** "icon": a round icon-only button. "labelled": the icon and the word Help. */
  variant?: "icon" | "labelled";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
};

/** The grid's keyboard shortcuts, as bound in grid/useGridKeyboard.ts. */
const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["←", "↑", "→", "↓"], action: "Move the selected cell" },
  { keys: ["Ctrl/⌘", "arrow"], action: "Jump to the edge of the grid" },
  { keys: ["Tab", "Shift+Tab"], action: "Next / previous cell" },
  { keys: ["Enter"], action: "Edit the cell (while editing: save, move down)" },
  { keys: ["Esc"], action: "Cancel an edit, or clear the selection" },
  { keys: ["Any character"], action: "Start editing with that character" },
  { keys: ["Delete", "Backspace"], action: "Clear the cell" },
  { keys: ["Shift+Enter"], action: "Add a record" },
];

/**
 * A help button that opens a popover listing the grid's keyboard shortcuts.
 * Shared by the home top bar and the base page's left rail.
 */
export function HelpButton({
  variant = "icon",
  side = "bottom",
  align = "end",
  className,
}: HelpButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "labelled" ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn("rounded-full px-3", className)}
          >
            <CircleHelp />
            Help
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Help"
            title="Help"
            className={cn("text-at-text-muted rounded-full", className)}
          >
            <CircleHelp />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-[360px] p-4">
        <h2 className="text-at-text mb-2 text-[13px] font-semibold">
          Keyboard shortcuts
        </h2>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <li
              key={s.action}
              className="flex items-start justify-between gap-4"
            >
              <span className="text-at-text-muted text-xs">{s.action}</span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="bg-at-hover text-at-text rounded px-1.5 py-0.5 font-sans text-[11px] leading-4"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
