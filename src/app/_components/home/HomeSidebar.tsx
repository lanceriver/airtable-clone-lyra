"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  House,
  Plus,
  ShoppingBag,
  Star,
  Upload,
  Users,
} from "lucide-react";

import { NotInDemo } from "~/components/at/NotInDemo";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function NavItem({
  icon: Icon,
  label,
  collapsed,
  active,
  decorative,
}: {
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  active?: boolean;
  /** Wrap the item in NotInDemo. */
  decorative?: boolean;
}) {
  const button = (
    <button
      type="button"
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "text-at-text focus-visible:ring-at-blue/40 flex h-9 w-full items-center rounded-md text-[13px] outline-none focus-visible:ring-2",
        collapsed ? "justify-center" : "gap-3 px-3",
        active ? "bg-at-selected font-semibold" : "hover:bg-at-hover",
      )}
    >
      <Icon className="text-at-text-muted size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
  return decorative ? (
    <NotInDemo className="flex w-full" side={collapsed ? "right" : "top"}>
      {button}
    </NotInDemo>
  ) : (
    button
  );
}

/**
 * The home sidebar: 300 px wide, or a 48 px icon strip when collapsed.
 * "+ Create" opens the create-base dialog.
 */
export function HomeSidebar({
  collapsed,
  onCreate,
}: {
  collapsed: boolean;
  onCreate: () => void;
}) {
  return (
    <aside
      data-testid="home-sidebar"
      data-collapsed={collapsed}
      aria-label="Sidebar"
      className={cn(
        "border-at-border flex flex-none flex-col overflow-hidden border-r bg-white transition-[width] duration-200",
        collapsed ? "w-12" : "w-[300px]",
      )}
    >
      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto",
          collapsed ? "px-1.5 py-3" : "p-3",
        )}
      >
        <NavItem icon={House} label="Home" collapsed={collapsed} active />
        <NavItem icon={Star} label="Starred" collapsed={collapsed} decorative />
        <NavItem icon={Users} label="Shared" collapsed={collapsed} decorative />
        <NavItem
          icon={Building2}
          label="Workspaces"
          collapsed={collapsed}
          decorative
        />
      </nav>
      <div
        className={cn(
          "border-at-border flex flex-none flex-col gap-0.5 border-t",
          collapsed ? "px-1.5 py-3" : "p-3",
        )}
      >
        <NavItem
          icon={BookOpen}
          label="Templates and apps"
          collapsed={collapsed}
          decorative
        />
        <NavItem
          icon={ShoppingBag}
          label="Marketplace"
          collapsed={collapsed}
          decorative
        />
        <NavItem
          icon={Upload}
          label="Import"
          collapsed={collapsed}
          decorative
        />
        {collapsed ? (
          <Button
            size="icon"
            aria-label="Create"
            title="Create"
            className="mt-2 w-full"
            onClick={onCreate}
          >
            <Plus />
          </Button>
        ) : (
          <Button size="lg" className="mt-2 w-full" onClick={onCreate}>
            <Plus />
            Create
          </Button>
        )}
      </div>
    </aside>
  );
}
