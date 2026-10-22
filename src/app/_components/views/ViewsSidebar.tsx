"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "~/components/ui/input";

import { CreateGridDialog } from "./CreateGridDialog";
import { CreateViewMenu } from "./CreateViewMenu";
import { useViewActions } from "./useViewActions";
import { ViewListItem } from "./ViewListItem";

export type ViewsSidebarProps = {
  baseId: string;
  tableId: string;
  activeViewId: string;
};

export function ViewsSidebar({
  baseId,
  tableId,
  activeViewId,
}: ViewsSidebarProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const {
    views,
    canDelete,
    goToView,
    createView,
    isCreating,
    nextGridName,
    renameView,
    deleteView,
  } = useViewActions({ baseId, tableId, activeViewId });

  const needle = query.trim().toLowerCase();
  const visible = views?.filter((view) =>
    view.name.toLowerCase().includes(needle),
  );

  return (
    <aside
      aria-label="Views"
      className="border-at-border flex h-full min-h-0 w-[280px] flex-none flex-col border-r bg-white"
    >
      <div className="flex flex-none flex-col gap-2 p-2 pb-1">
        <CreateViewMenu onCreateGrid={() => setCreating(true)} />
        <div className="relative">
          <Search className="text-at-text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            aria-label="Find a view"
            placeholder="Find a view"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
        data-testid="view-list"
      >
        {!visible ? (
          <div className="space-y-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-at-hover h-8 animate-pulse rounded-md"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-at-text-subtle px-2 py-2 text-[13px]">
            No views match
          </p>
        ) : (
          visible.map((view) => (
            <ViewListItem
              key={view.id}
              name={view.name}
              active={view.id === activeViewId}
              canDelete={canDelete}
              onSelect={() => goToView(view.id)}
              onRename={(name) => renameView(view.id, name)}
              onDelete={() => deleteView(view.id)}
            />
          ))
        )}
      </div>
      <CreateGridDialog
        open={creating}
        onOpenChange={setCreating}
        defaultName={nextGridName}
        isCreating={isCreating}
        onCreate={(name) =>
          createView(name, { onSuccess: () => setCreating(false) })
        }
      />
    </aside>
  );
}
