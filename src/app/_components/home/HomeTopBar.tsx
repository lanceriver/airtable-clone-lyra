"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Bell, Menu, Search, X } from "lucide-react";

import { NotInDemo } from "~/components/at/NotInDemo";
import { Button } from "~/components/ui/button";
import { AccountMenu } from "../AccountMenu";
import { HelpButton } from "../HelpButton";

export type HomeUser = {
  name: string;
  email?: string | null;
  image?: string | null;
};

/**
 * The 56 px home top bar: sidebar toggle and wordmark on the left, the search
 * (⌘K / Ctrl+K focuses it) in the centre, and Help, the bell and the account
 * menu on the right.
 */
export function HomeTopBar({
  user,
  search,
  onSearchChange,
  onToggleSidebar,
}: {
  user: HomeUser;
  search: string;
  onSearchChange: (value: string) => void;
  onToggleSidebar: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="border-at-border relative z-10 grid h-14 flex-none grid-cols-[1fr_auto_1fr] items-center border-b bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle sidebar"
          className="text-at-text-muted"
          onClick={onToggleSidebar}
        >
          <Menu />
        </Button>
        <Image
          src="/assets/airtable_logo.svg"
          alt="Airtable"
          width={102}
          height={22}
          priority
          unoptimized
          className="h-[22px] w-[102px]"
        />
      </div>

      <div className="bg-at-hover focus-within:ring-at-blue/40 relative flex h-9 w-[340px] items-center rounded-full focus-within:ring-2">
        <Search className="text-at-text-muted pointer-events-none absolute left-3 size-4" />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          aria-label="Search bases"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onSearchChange("");
              e.currentTarget.blur();
            }
          }}
          className="text-at-text placeholder:text-at-text-subtle h-full w-full rounded-full bg-transparent pr-14 pl-9 text-[13px] outline-none"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onSearchChange("");
              inputRef.current?.focus();
            }}
            className="text-at-text-muted hover:text-at-text absolute right-3 flex size-5 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="text-at-text-subtle pointer-events-none absolute right-3 font-sans text-xs">
            ⌘K
          </kbd>
        )}
      </div>

      <div className="flex items-center justify-end gap-1">
        <HelpButton variant="labelled" />
        <NotInDemo side="bottom">
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
          name={user.name}
          email={user.email}
          image={user.image}
          className="ml-2"
        />
      </div>
    </header>
  );
}
