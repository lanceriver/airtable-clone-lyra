"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Ellipsis, Palette, Pencil, Trash2 } from "lucide-react";

import { BaseIcon } from "~/components/at/BaseIcon";
import { ColorSwatches } from "~/components/at/ColorSwatches";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { BaseColor } from "~/lib/baseColors";
import { cn } from "~/lib/utils";
import type { HomeBase } from "./useBaseActions";

export type BaseCardProps = {
  base: HomeBase;
  /** "grid": the 92 px card. "list": the 48 px row. */
  variant?: "grid" | "list";
  onRename: (name: string) => void;
  onSetColor: (color: BaseColor) => void;
  onDelete: () => void;
};

export function baseHref(base: HomeBase): string {
  return base.firstTableId
    ? `/${base.id}/${base.firstTableId}${base.firstViewId ? `?viewId=${base.firstViewId}` : ""}`
    : `/${base.id}`;
}

export function BaseCard({
  base,
  variant = "grid",
  onRename,
  onSetColor,
  onDelete,
}: BaseCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(base.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isList = variant === "list";

  useEffect(() => {
    if (editing) {
      // Wait a frame so the closing menu has finished moving focus.
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [editing]);

  const startRename = () => {
    setDraft(base.name);
    setEditing(true);
  };
  const commit = () => {
    if (!editing) return;
    setEditing(false);
    const name = draft.trim();
    if (name !== "" && name !== base.name) onRename(name);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(base.name);
  };

  const nameEl = editing ? (
    <input
      ref={inputRef}
      value={draft}
      aria-label="Base name"
      maxLength={100}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      className="border-at-blue text-at-text focus:ring-at-blue/25 relative z-10 h-7 w-full min-w-0 rounded-md border bg-white px-1.5 text-[13px] font-semibold outline-none focus:ring-[3px]"
    />
  ) : (
    <p className="text-at-text truncate text-[13px] font-semibold">
      {base.name}
    </p>
  );

  return (
    <div
      data-testid="base-card"
      data-variant={variant}
      className={cn(
        "group border-at-border relative flex items-center bg-white transition-shadow",
        isList
          ? "hover:bg-at-hover/60 h-12 gap-3 border-b px-4 first:rounded-t-md last:rounded-b-md last:border-b-0"
          : "h-[92px] gap-4 rounded-md border px-4 hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)]",
      )}
    >
      {!editing && (
        <Link
          href={baseHref(base)}
          aria-label={`Open ${base.name}`}
          className="focus-visible:ring-at-blue/40 absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2"
        />
      )}
      <BaseIcon
        name={base.name}
        color={base.color}
        size={isList ? 32 : 56}
        className="pointer-events-none"
      />
      {isList ? (
        <>
          <div className="min-w-0 flex-1">{nameEl}</div>
          <p className="text-at-text-muted pointer-events-none w-40 shrink-0 text-xs">
            Base
          </p>
        </>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {nameEl}
          <p className="text-at-text-muted pointer-events-none text-[11px]">
            Base
          </p>
        </div>
      )}
      <BaseCardMenu
        name={base.name}
        color={base.color}
        className={isList ? "" : "absolute top-2 right-2"}
        onRename={startRename}
        onSetColor={onSetColor}
        onDelete={onDelete}
      />
    </div>
  );
}

function BaseCardMenu({
  name,
  color,
  className,
  onRename,
  onSetColor,
  onDelete,
}: {
  name: string;
  color: string;
  className?: string;
  onRename: () => void;
  onSetColor: (color: BaseColor) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const renameRequested = useRef(false);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirming(false);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`More actions for ${name}`}
          className={cn(
            "text-at-text-muted relative z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
            className,
          )}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={confirming ? "w-64" : "w-52"}
        onCloseAutoFocus={(e) => {
          // Renaming moves focus into the inline input; don't pull it back.
          if (renameRequested.current) {
            e.preventDefault();
            renameRequested.current = false;
          }
        }}
      >
        {confirming ? (
          <>
            <div className="px-2.5 py-1.5">
              <p className="text-at-text text-[13px] font-semibold">
                Delete this base?
              </p>
              <p className="text-at-text-muted mt-0.5 text-xs">
                This permanently deletes “{name}” and all of its tables and
                records.
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setConfirming(false);
              }}
            >
              Cancel
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 />
              Delete base
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onSelect={() => {
                renameRequested.current = true;
                onRename();
              }}
            >
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette className="size-4" />
                Change colour
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="p-3">
                <div onKeyDown={(e) => e.stopPropagation()}>
                  <ColorSwatches
                    value={color}
                    className="grid grid-cols-5 gap-3"
                    onChange={(c) => {
                      onSetColor(c);
                      setOpen(false);
                    }}
                  />
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                setConfirming(true);
              }}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
