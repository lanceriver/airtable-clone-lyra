"use client";

import {
  ArrowDown10,
  ArrowDownZA,
  ArrowUp01,
  ArrowUpAZ,
  ChevronDown,
  EyeOff,
  ListFilter,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
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
import { Input } from "~/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { SORT_LABELS } from "../filterOptions";
import { FIELD_NAME_MAX_LENGTH } from "./gridConstants";
import type { GridColumn } from "./gridTypes";
import { useGridColumnTools, type GridColumnTools } from "./GridColumnTools";

/** Keys typed in a menu or dialog must not reach the grid's keyboard handling. */
const stopKeys = (event: React.KeyboardEvent) => event.stopPropagation();

type FieldMenuProps = {
  column: GridColumn;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The menu of a field header, as in Airtable. The chevron button in the
 * header is its trigger; the header also opens it on right-click, through
 * `open`. Rename and delete use dialogs that outlive the menu.
 */
export function FieldMenu({ column, open, onOpenChange }: FieldMenuProps) {
  const tools = useGridColumnTools();
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  // "Filter by this field" opens a popover elsewhere; the menu must not steal
  // the focus back when it closes.
  const keepFocusAway = useRef(false);
  if (!tools) return null;

  const isLastField = tools.fields.length <= 1;
  const isLastVisible = tools.visibleFieldCount <= 1;
  const labels = SORT_LABELS[column.type];
  const AscIcon = column.type === "number" ? ArrowUp01 : ArrowUpAZ;
  const DescIcon = column.type === "number" ? ArrowDown10 : ArrowDownZA;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${column.name} field menu`}
            data-testid="field-menu-trigger"
            className="flex h-5 w-5 flex-none cursor-pointer items-center justify-center rounded text-[#616670] opacity-0 outline-none group-hover/header:opacity-100 hover:bg-black/10 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-60"
          onKeyDown={stopKeys}
          onContextMenu={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            if (keepFocusAway.current) {
              keepFocusAway.current = false;
              event.preventDefault();
            }
          }}
        >
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <Pencil aria-hidden />
            Edit field
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => tools.onSort(column.id, "asc")}>
            <AscIcon aria-hidden />
            Sort {labels.asc}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => tools.onSort(column.id, "desc")}>
            <DescIcon aria-hidden />
            Sort {labels.desc}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              keepFocusAway.current = true;
              tools.onFilterBy(column.id);
            }}
          >
            <ListFilter aria-hidden />
            Filter by this field
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DisabledHint
            disabled={isLastVisible}
            hint="At least one field must stay visible"
          >
            <DropdownMenuItem
              disabled={isLastVisible}
              onSelect={() => tools.onHide(column.id)}
            >
              <EyeOff aria-hidden />
              Hide field
            </DropdownMenuItem>
          </DisabledHint>
          <DropdownMenuSeparator />
          <DisabledHint
            disabled={isLastField}
            hint="A table needs at least one field"
          >
            <DropdownMenuItem
              variant="destructive"
              disabled={isLastField}
              onSelect={() => setDialog("delete")}
            >
              <Trash2 aria-hidden />
              Delete field
            </DropdownMenuItem>
          </DisabledHint>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "rename" && (
        <RenameDialog
          column={column}
          tools={tools}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <DeleteDialog
          column={column}
          tools={tools}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/** Wraps a disabled menu item in a tooltip that says why. */
function DisabledHint({
  disabled,
  hint,
  children,
}: {
  disabled: boolean;
  hint: string;
  children: ReactNode;
}) {
  if (!disabled) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block" tabIndex={-1}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{hint}</TooltipContent>
    </Tooltip>
  );
}

function RenameDialog({
  column,
  tools,
  onClose,
}: {
  column: GridColumn;
  tools: GridColumnTools;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [name, setName] = useState(column.name);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmed = name.trim();
  const taken = tools.fields.some(
    (field) =>
      field.id !== column.id &&
      field.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const error =
    serverError ?? (taken ? "A field with this name already exists" : null);

  const rename = api.column.rename.useMutation({
    onSuccess: () => {
      void utils.table.get.invalidate({ tableId: tools.tableId });
      onClose();
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") setServerError(e.message);
      else toast.error(e.message);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (trimmed === "" || taken || rename.isPending) return;
    if (trimmed === column.name) {
      onClose();
      return;
    }
    rename.mutate({ columnId: column.id, name: trimmed });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm" onKeyDown={stopKeys}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit field</DialogTitle>
            <DialogDescription>
              Field names must be unique within the table.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Input
              autoFocus
              aria-label="Field name"
              aria-invalid={error !== null}
              maxLength={FIELD_NAME_MAX_LENGTH}
              value={name}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                setName(event.target.value);
                setServerError(null);
              }}
            />
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={trimmed === "" || taken || rename.isPending}
            >
              {rename.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  column,
  tools,
  onClose,
}: {
  column: GridColumn;
  tools: GridColumnTools;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const remove = api.column.delete.useMutation({
    onSuccess: () => {
      void utils.table.get.invalidate({ tableId: tools.tableId });
      // The field also leaves the views' filters, sort and hidden fields.
      void utils.view.get.invalidate();
      void utils.row.countRows.invalidate();
      onClose();
    },
    onError: (e) => {
      toast.error(e.message);
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm" onKeyDown={stopKeys}>
        <DialogHeader>
          <DialogTitle>
            Delete field “{column.name}”? This can’t be undone.
          </DialogTitle>
          <DialogDescription>
            The values in this field are deleted from every record.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            autoFocus
            disabled={remove.isPending}
            onClick={() => remove.mutate({ columnId: column.id })}
          >
            {remove.isPending ? "Deleting..." : "Delete field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
