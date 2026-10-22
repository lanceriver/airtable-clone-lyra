"use client";

import Link from "next/link";

import { AirtableMark } from "~/components/at/AirtableMark";
import { UserDropdown } from "~/app/_components/ui/UserDropdown";

export type BaseRailProps = {
  userName: string;
  userImage: string;
};

/**
 * The 56 px left rail: the Airtable mark linking home at the top, the account
 * menu at the bottom.
 */
export function BaseRail({ userName, userImage }: BaseRailProps) {
  return (
    <aside className="border-at-border flex w-14 flex-none flex-col items-center justify-between border-r bg-white py-3">
      <Link
        href="/"
        aria-label="Back to home"
        title="Back to home"
        className="hover:bg-at-hover flex size-8 items-center justify-center rounded-md"
      >
        <AirtableMark size={24} />
      </Link>
      <UserDropdown userName={userName} userImage={userImage} />
    </aside>
  );
}
