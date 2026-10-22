"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type TableListItem = RouterOutputs["table"]["list"][number];

export type TableTabProps = {
  baseId: string;
  table: TableListItem;
  /** All of the base's tables, in tab order (for the neighbour to open after a delete). */
  tables: TableListItem[];
  isActive: boolean;
  /** Hides the 1 px separator after this tab (last tab, or next to the active tab). */
  hideSeparator: boolean;
};

/**
 * One table tab. The active tab is white with a chevron menu (Rename table,
 * Delete table); renaming happens inline in the tab and deleting asks first.
 */
export function TableTab({
  baseId,
  table,
  tables,
  isActive,
  hideSeparator,
}: TableTabProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(table.name);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter, Esc and the blur that follows them must only settle the rename once.
  const settled = useRef(false);

  const canDelete = tables.length > 1;

  const rename = api.table.rename.useMutation({
    onMutate: async ({ name }) => {
      await utils.table.list.cancel({ baseId });
      const previous = utils.table.list.getData({ baseId });
      utils.table.list.setData({ baseId }, (old) =>
        old?.map((t) => (t.id === table.id ? { ...t, name } : t)),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        utils.table.list.setData({ baseId }, context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      void utils.table.list.invalidate({ baseId });
      router.refresh();
    },
  });

  const remove = api.table.delete.useMutation({
    onSuccess: async () => {
      const index = tables.findIndex((t) => t.id === table.id);
      const next = tables[index + 1] ?? tables[index - 1];
      utils.table.list.setData({ baseId }, (old) =>
        old?.filter((t) => t.id !== table.id),
      );
      setConfirmOpen(false);
      if (isActive) router.push(next ? `/${baseId}/${next.id}` : `/${baseId}`);
      await utils.table.list.invalidate({ baseId });
      router.refresh();
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast.error(error.message);
    },
  });

  const startRename = () => {
    settled.current = false;
    setDraft(table.name);
    setRenaming(true);
  };

  useEffect(() => {
    if (!renaming) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renaming]);

  const finishRename = (save: boolean) => {
    if (settled.current) return;
    settled.current = true;
    setRenaming(false);
    const name = draft.trim();
    if (save && name !== "" && name !== table.name) {
      rename.mutate({ tableId: table.id, name });
    }
  };

  const tabName = renaming ? (
    // The hidden span gives the input the width of its text.
    <span className="relative inline-block min-w-8">
      <span className="invisible block px-1 whitespace-pre">
        {draft || " "}
      </span>
      <input
        ref={inputRef}
        aria-label="Table name"
        value={draft}
        maxLength={100}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            finishRename(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            finishRename(false);
          }
        }}
        onBlur={() => finishRename(true)}
        className="text-at-text ring-at-blue absolute inset-0 w-full rounded-[3px] bg-white px-1 text-[13px] font-medium ring-2 outline-none"
      />
    </span>
  ) : (
    <span className="truncate">{table.name}</span>
  );

  if (!isActive) {
    return (
      <div
        data-tab-id={table.id}
        className={cn(
          "relative flex h-8 flex-none items-center",
          !hideSeparator &&
            "after:bg-at-text-muted/40 after:absolute after:top-2 after:right-0 after:h-4 after:w-px",
        )}
      >
        <Link
          href={`/${baseId}/${table.id}`}
          title={table.name}
          className="text-at-text flex h-8 max-w-[220px] items-center rounded-t-[3px] px-3 transition-colors hover:bg-black/5"
        >
          <span className="truncate">{table.name}</span>
        </Link>
      </div>
    );
  }

  return (
    <div
      data-tab-id={table.id}
      data-active="true"
      className="flex h-8 flex-none items-center rounded-t-[3px] bg-white font-medium"
    >
      {renaming ? (
        <div className="max-w-[260px] pr-1 pl-2.5">{tabName}</div>
      ) : (
        <Link
          href={`/${baseId}/${table.id}`}
          title={table.name}
          onDoubleClick={startRename}
          className="text-at-text flex h-8 max-w-[220px] items-center pr-1 pl-3"
        >
          {tabName}
        </Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Table options"
            className="text-at-text-muted hover:text-at-text focus-visible:ring-at-blue/40 flex h-8 cursor-pointer items-center rounded-tr-[3px] pr-2.5 pl-1 outline-none focus-visible:ring-2"
          >
            <ChevronDown className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-44"
          // Keep focus off the trigger so the rename input can take it.
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onSelect={startRename}>
            <Pencil />
            Rename table
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDelete}
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 />
            Delete table
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete table?</DialogTitle>
            <DialogDescription>
              &ldquo;{table.name}&rdquo; and all of its fields, views and
              records will be permanently deleted. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ tableId: table.id })}
            >
              {remove.isPending ? "Deleting..." : "Delete table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
