"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export type AccountMenuProps = {
  name: string;
  email?: string | null;
  image?: string | null;
  /** Which side of the avatar the menu opens on (default "bottom"). */
  side?: "top" | "right" | "bottom" | "left";
  /** How the menu aligns to the avatar (default "end"). */
  align?: "start" | "center" | "end";
  /** Avatar diameter in px (default 32). */
  size?: number;
  className?: string;
};

/**
 * The avatar button and its menu: the user's name and email, and "Log out".
 * Shared by the home top bar and the base page's left rail.
 */
export function AccountMenu({
  name,
  email,
  image,
  side = "bottom",
  align = "end",
  size = 32,
  className,
}: AccountMenuProps) {
  const label = [name.trim(), email?.trim()].find(Boolean) ?? "Account";
  const initial = Array.from(label)[0]?.toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className={cn(
            "focus-visible:ring-at-blue/40 shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-2",
            className,
          )}
        >
          <Avatar style={{ width: size, height: size }}>
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback className="bg-at-blue text-[13px] font-semibold text-white">
              {initial}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-60">
        <div className="px-2.5 py-1.5">
          <p className="text-at-text truncate text-[13px] font-semibold">
            {label}
          </p>
          {email ? (
            <p className="text-at-text-muted truncate text-xs">{email}</p>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ redirectTo: "/" })}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
