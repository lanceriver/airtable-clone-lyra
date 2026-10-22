"use client";

import { ChevronDown, History, Users } from "lucide-react";

import { BaseIcon } from "~/components/at/BaseIcon";
import { Button } from "~/components/ui/button";
import { getBaseColor } from "~/lib/baseColors";
import { cn } from "~/lib/utils";

export type BaseHeaderProps = {
  baseId: string;
  baseName: string;
  /** The base's colour name (`Base.color`). */
  color: string;
};

const TABS = ["Data", "Automations", "Interfaces", "Forms"] as const;

/**
 * The 56 px white base header: the base icon and name on the left, the
 * Data / Automations / Interfaces / Forms tabs, and Share on the right.
 */
export function BaseHeader({ baseName, color }: BaseHeaderProps) {
  const { solid } = getBaseColor(color);

  return (
    <header className="border-at-border flex h-14 flex-none items-center justify-between gap-4 border-b bg-white px-4">
      <div className="flex min-w-0 items-center gap-3">
        <BaseIcon name={baseName} color={color} size={32} />
        <h1 className="text-at-text flex min-w-0 items-center gap-1 text-[17px] font-semibold">
          <span className="truncate">{baseName}</span>
          <ChevronDown className="text-at-text-muted size-4 flex-none" />
        </h1>
      </div>

      <nav className="flex h-full items-stretch gap-5 text-[13px]">
        {TABS.map((tab) => {
          const active = tab === "Data";
          return (
            <button
              key={tab}
              type="button"
              className={cn(
                "text-at-text-muted hover:text-at-text relative cursor-pointer",
                active && "text-at-text font-medium",
              )}
            >
              {tab}
              {active && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ backgroundColor: solid }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="History">
          <History />
        </Button>
        <Button
          size="sm"
          className="text-white hover:opacity-90"
          style={{ backgroundColor: solid }}
        >
          <Users />
          Share
        </Button>
      </div>
    </header>
  );
}
