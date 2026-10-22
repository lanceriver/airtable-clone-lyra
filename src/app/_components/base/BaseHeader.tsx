"use client";

import { useState } from "react";
import { History, Users } from "lucide-react";

import { NotInDemo } from "~/components/at/NotInDemo";
import { Button } from "~/components/ui/button";
import { getBaseColor } from "~/lib/baseColors";
import { BaseHeaderMenu } from "./BaseHeaderMenu";

export type BaseHeaderProps = {
  baseId: string;
  baseName: string;
  /** The base's colour name (`Base.color`). */
  color: string;
};

const DECORATIVE_TABS = ["Automations", "Interfaces", "Forms"] as const;

/**
 * The 56 px white base header: the base icon and name (with the rename /
 * colour / delete popover) on the left, the Data / Automations / Interfaces /
 * Forms tabs, and history and Share on the right.
 *
 * The name and colour are kept in local state so a rename or colour change
 * shows straight away; the server layout re-renders after `router.refresh()`
 * and the props then catch up (and feed the table tabs bar).
 */
export function BaseHeader({ baseId, baseName, color }: BaseHeaderProps) {
  const [name, setName] = useState(baseName);
  const [colour, setColour] = useState(color);

  // Adopt new server values (after router.refresh()). Done during render, the
  // documented way to reset state when a prop changes.
  const [seen, setSeen] = useState({ baseName, color });
  if (seen.baseName !== baseName || seen.color !== color) {
    setSeen({ baseName, color });
    setName(baseName);
    setColour(color);
  }

  const { solid } = getBaseColor(colour);

  return (
    <header className="border-at-border flex h-14 flex-none items-center justify-between gap-4 border-b bg-white px-4">
      <BaseHeaderMenu
        baseId={baseId}
        name={name}
        color={colour}
        onNameChange={setName}
        onColorChange={setColour}
      />

      <nav
        aria-label="Base sections"
        className="flex h-full items-stretch gap-5 text-[13px]"
      >
        <button
          type="button"
          aria-current="page"
          className="text-at-text relative cursor-pointer font-medium"
        >
          Data
          <span
            className="absolute inset-x-0 bottom-0 h-0.5"
            style={{ backgroundColor: solid }}
          />
        </button>
        {DECORATIVE_TABS.map((tab) => (
          <NotInDemo key={tab} className="items-stretch">
            <button
              type="button"
              className="text-at-text-muted hover:text-at-text cursor-pointer"
            >
              {tab}
            </button>
          </NotInDemo>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <NotInDemo>
          <Button variant="ghost" size="icon-sm" aria-label="History">
            <History />
          </Button>
        </NotInDemo>
        <NotInDemo>
          <Button
            size="sm"
            className="text-white hover:opacity-90"
            style={{ backgroundColor: solid }}
          >
            <Users />
            Share
          </Button>
        </NotInDemo>
      </div>
    </header>
  );
}
