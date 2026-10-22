"use client";

import { useState } from "react";
import {
  Calendar,
  LayoutGrid,
  List,
  Plus,
  Search,
  Check,
  TableCellsSplit,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Collapsible, CollapsibleContent } from "~/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";

import { useViewActions } from "./useViewActions";

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
  const [createExpanded, setCreateExpanded] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { views, goToView, createView, renameView, deleteView } =
    useViewActions({ baseId, tableId, activeViewId });

  const commitRename = () => {
    if (editingViewId) renameView(editingViewId, editName);
    setEditingViewId(null);
    setEditName("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createView(viewName, {
      onSuccess: () => {
        setCreateOpen(false);
        setViewName("");
      },
    });
  };

  return (
    <aside className="border-at-border flex h-full w-[280px] flex-none flex-col border-r bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="p-2">
          <div className="relative mb-2">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input placeholder="Find a view" className="h-9 pl-8 text-sm" />
          </div>
          {/* Create section */}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {views?.map((view) => (
            <div key={view.id} className="w-full gap-y-0">
              <ContextMenu>
                <ContextMenuTrigger className="flex w-full cursor-pointer items-center">
                  <Button
                    variant="ghost"
                    className={`w-full cursor-pointer justify-start gap-x-2 ${view.id === activeViewId ? "bg-blue-50" : ""} hover:bg-blue-100`}
                    onClick={() => goToView(view.id)}
                  >
                    <TableCellsSplit className="h-4 w-4 font-light text-blue-600" />
                    {editingViewId === view.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          commitRename();
                        }}
                      >
                        <Input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={commitRename}
                          onClick={(e) => e.stopPropagation()}
                        ></Input>
                      </form>
                    ) : (
                      <span className="text-sm">{view.name}</span>
                    )}
                    {view.id === activeViewId && (
                      <Check className="ml-auto h-4 w-4 text-gray-600" />
                    )}
                  </Button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  <ContextMenuItem
                    onClick={() => {
                      setEditName(view.name);
                      setEditingViewId(view.id);
                    }}
                  >
                    Rename view
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={views.length <= 1}
                    onClick={() => deleteView(view.id)}
                  >
                    Delete view
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
          ))}
        </div>
        <div className="max-h-[45%] flex-none overflow-y-auto">
          <Collapsible
            open={createExpanded}
            onOpenChange={setCreateExpanded}
            className="border-t pt-4"
          >
            <CollapsibleContent className="ml-2 space-y-1">
              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <TableCellsSplit className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Grid</span>
                </div>
                <Popover open={createOpen} onOpenChange={setCreateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      aria-label="Create grid view"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4">
                    <form onSubmit={handleCreate}>
                      <div className="mb-4">
                        <Input
                          placeholder="Enter view name"
                          className="w-full"
                          value={viewName}
                          onChange={(e) => setViewName(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-2 gap-x-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setCreateOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="default"
                          className="bg-blue-400 text-white"
                        >
                          Create new view
                        </Button>
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Calendar</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Gallery</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-4 w-4 items-center justify-center text-green-600">
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                      <line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                  </div>
                  <span className="text-sm">Kanban</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-4 w-4 items-center justify-center text-red-600">
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <polyline points="8 7 3 12 8 17" />
                      <polyline points="16 7 21 12 16 17" />
                    </svg>
                  </div>
                  <span className="text-sm">Timeline</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">List</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-4 w-4 items-center justify-center text-green-600">
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <line x1="7" y1="4" x2="7" y2="20" />
                    </svg>
                  </div>
                  <span className="text-sm">Gantt</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">New section</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Separator className="my-2" />

              <div className="hover:bg-accent group flex items-center justify-between rounded px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-4 w-4 items-center justify-center text-pink-600">
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                  </div>
                  <span className="text-sm">Form</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </aside>
  );
}
