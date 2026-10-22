"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

/**
 * Wraps a decorative control: shows the tooltip "Not available in this demo"
 * on hover, focus and click, and swallows the click so the child never acts.
 */
export function NotInDemo({
  children,
  className,
  side,
  label = "Not available in this demo",
}: {
  children: React.ReactNode;
  className?: string;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span
          data-slot="not-in-demo"
          className={cn("inline-flex", className)}
          onClickCapture={(e) => {
            // Capture phase: the child's own onClick never runs.
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setOpen(false), 1500);
          }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
