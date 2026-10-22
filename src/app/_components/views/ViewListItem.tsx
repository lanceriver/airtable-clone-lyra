"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipsis, Pencil, Sheet as SheetIcon, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

/**
 * One row of the views list: select on click, rename inline on double-click,
 * and a "…" menu (also the right-click menu) with Rename view and Delete view.
 */
export function ViewListItem({
  name,
  active,
  canDelete,
  onSelect,
  onRename,
  onDelete,
}: {
  name: string;
  active: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  // Set when a menu item asks for a rename. The input appears only once the
  // menu has finished closing: the menu moves focus around while it closes,
  // which would otherwise take focus from the new input (and so save it).
  const pendingRename = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const startRename = () => {
    setDraft(name);
    setEditing(true);
  };

  const menuItems = (
    Item: typeof DropdownMenuItem | typeof ContextMenuItem,
  ) => (
    <>
      <Item
        onSelect={() => {
          pendingRename.current = true;
        }}
      >
        <Pencil />
        Rename view
      </Item>
      <Item disabled={!canDelete} onSelect={onDelete}>
        <Trash2 />
        Delete view
      </Item>
    </>
  );

  const onCloseAutoFocus = (e: Event) => {
    if (pendingRename.current) {
      e.preventDefault();
      pendingRename.current = false;
      startRename();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={rowRef}
          data-testid="view-row"
          data-active={active}
          className={cn(
            "group text-at-text flex h-8 items-center rounded-md text-[13px]",
            active ? "bg-at-selected font-medium" : "hover:bg-at-hover",
          )}
        >
          {editing ? (
            <RenameInput
              value={draft}
              onChange={setDraft}
              onCommit={() => {
                setEditing(false);
                onRename(draft);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <button
              type="button"
              className="focus-visible:ring-at-blue/40 flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-2"
              aria-current={active ? "true" : undefined}
              onClick={onSelect}
              onDoubleClick={startRename}
            >
              <SheetIcon className="text-at-blue size-4 shrink-0" />
              <span className="truncate">{name}</span>
            </button>
          )}
          {!editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${name}`}
                  className={cn(
                    "mr-0.5 size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                    active && "opacity-100",
                  )}
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-48"
                onCloseAutoFocus={onCloseAutoFocus}
              >
                {menuItems(DropdownMenuItem)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48" onCloseAutoFocus={onCloseAutoFocus}>
        {menuItems(ContextMenuItem)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter, Esc and blur all end the edit; only the first one counts.
  const done = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) onCommit();
    else onCancel();
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
      <SheetIcon className="text-at-blue size-4 shrink-0" />
      <input
        ref={inputRef}
        aria-label="View name"
        value={value}
        maxLength={100}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(true);
          else if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
        }}
        className="border-at-blue text-at-text h-6 min-w-0 flex-1 rounded-sm border bg-white px-1.5 text-[13px] font-normal outline-none"
      />
    </div>
  );
}
