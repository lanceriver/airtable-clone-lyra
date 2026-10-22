"use client";

import { useRef, useState } from "react";
import { ChevronDown, Pencil, Sheet, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";
import { useViewActions } from "../views/useViewActions";

type Props = {
  baseId: string;
  tableId: string;
  viewId: string;
  viewName: string;
};

/**
 * The toolbar's view button: the grid icon, the view name and a chevron whose
 * menu renames (in a small popover under the button) or deletes the view.
 */
export function ViewMenu({ baseId, tableId, viewId, viewName }: Props) {
  const { canDelete, renameView, deleteView } = useViewActions({
    baseId,
    tableId,
    activeViewId: viewId,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(viewName);
  // Esc cancels; every other way of closing the popover saves.
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const renameRequested = useRef(false);

  const startRename = () => {
    cancelled.current = false;
    renameRequested.current = true;
    setDraft(viewName);
    // The popover opens once the menu has closed (see onCloseAutoFocus), so
    // the menu doesn't take the focus back.
  };

  const finishRename = () => {
    if (!cancelled.current) renameView(viewId, draft);
    setRenaming(false);
  };

  return (
    <Popover
      open={renaming}
      onOpenChange={(open) => {
        if (!open) finishRename();
      }}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverAnchor asChild>
          <span className="inline-flex min-w-0">
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="toolbar"
                className="data-[state=open]:bg-at-hover min-w-0 gap-1.5"
                aria-label={`View: ${viewName}`}
              >
                <Sheet className="text-at-blue" />
                <span className="max-w-56 truncate font-medium">
                  {viewName}
                </span>
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
          </span>
        </PopoverAnchor>
        <DropdownMenuContent
          align="start"
          className="w-48"
          onCloseAutoFocus={(event) => {
            if (renameRequested.current) {
              renameRequested.current = false;
              event.preventDefault();
              setRenaming(true);
            }
          }}
        >
          <DropdownMenuItem onSelect={startRename}>
            <Pencil />
            Rename view
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDelete}
            onSelect={() => deleteView(viewId)}
          >
            <Trash2 />
            Delete view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PopoverContent
        align="start"
        className="w-64 p-2"
        onEscapeKeyDown={() => {
          cancelled.current = true;
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            finishRename();
          }}
        >
          <Input
            ref={inputRef}
            aria-label="View name"
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
          />
        </form>
      </PopoverContent>
    </Popover>
  );
}
