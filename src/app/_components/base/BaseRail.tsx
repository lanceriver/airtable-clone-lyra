"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { AccountMenu } from "~/app/_components/AccountMenu";
import { HelpButton } from "~/app/_components/HelpButton";
import { AirtableMark } from "~/components/at/AirtableMark";
import { NotInDemo } from "~/components/at/NotInDemo";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export type BaseRailProps = {
  userName: string;
  userEmail?: string | null;
  userImage?: string | null;
};

/**
 * The 56 px left rail: the Airtable mark linking home at the top; Help, the
 * (decorative) notifications bell and the account menu at the bottom.
 */
export function BaseRail({ userName, userEmail, userImage }: BaseRailProps) {
  return (
    <aside className="border-at-border flex w-14 flex-none flex-col items-center justify-between border-r bg-white py-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/"
            aria-label="Back to home"
            className="hover:bg-at-hover focus-visible:ring-at-blue/40 flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2"
          >
            <AirtableMark size={24} />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">Back to home</TooltipContent>
      </Tooltip>

      <div className="flex flex-col items-center gap-2">
        <HelpButton variant="icon" side="right" align="end" />
        <NotInDemo side="right">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="text-at-text-muted rounded-full"
          >
            <Bell />
          </Button>
        </NotInDemo>
        <AccountMenu
          name={userName}
          email={userEmail}
          image={userImage}
          side="right"
          align="end"
          size={28}
          className="mt-1"
        />
      </div>
    </aside>
  );
}
