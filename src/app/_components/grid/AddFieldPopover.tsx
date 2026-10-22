"use client";

import { Check, Hash, Plus, Type, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { ColumnType } from "~/server/db/rows";
import { api } from "~/trpc/react";
import { FIELD_NAME_MAX_LENGTH } from "./gridConstants";
import { useGridColumnTools } from "./GridColumnTools";

const FIELD_TYPES: { type: ColumnType; label: string; Icon: LucideIcon }[] = [
  { type: "string", label: "Single line text", Icon: Type },
  { type: "number", label: "Number", Icon: Hash },
];

/**
 * The "+" cell at the end of the header: a popover with a name and a type.
 * The name must be unique within the table (case-insensitively); a clash is
 * shown under the input, whether found here or reported by the server.
 */
export function AddFieldPopover({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add field"
          data-testid="add-field-trigger"
          className="text-at-text-muted hover:bg-at-hover focus-visible:bg-at-hover flex h-full w-full cursor-pointer items-center justify-center outline-none"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-4"
        onKeyDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        {/* Mounted only while open, so every open starts with a blank form. */}
        <AddFieldForm tableId={tableId} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function AddFieldForm({
  tableId,
  onDone,
}: {
  tableId: string;
  onDone: () => void;
}) {
  const utils = api.useUtils();
  const tools = useGridColumnTools();
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("string");
  const [serverError, setServerError] = useState<string | null>(null);
  const nameId = useId();

  const fieldCount = tools?.fields.length ?? 0;
  const trimmed = name.trim();
  const taken =
    tools?.fields.some(
      (field) => field.name.toLowerCase() === trimmed.toLowerCase(),
    ) ?? false;
  const error =
    serverError ?? (taken ? "A field with this name already exists" : null);

  const create = api.column.create.useMutation({
    onSuccess: () => {
      // The new field is empty, so no rows need reloading.
      void utils.table.get.invalidate({ tableId });
      onDone();
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") setServerError(e.message);
      else toast.error(e.message);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (trimmed === "" || taken || create.isPending) return;
    create.mutate({ tableId, name: trimmed, type });
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <label
          htmlFor={nameId}
          className="text-at-text text-[13px] font-medium"
        >
          Field name
        </label>
        <Input
          id={nameId}
          autoFocus
          aria-invalid={error !== null}
          placeholder={`Field ${fieldCount + 1}`}
          maxLength={FIELD_NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setServerError(null);
          }}
        />
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <span className="text-at-text text-[13px] font-medium">Field type</span>
        <div role="radiogroup" aria-label="Field type" className="grid gap-0.5">
          {FIELD_TYPES.map(({ type: value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className={`text-at-text hover:bg-at-hover focus-visible:ring-at-blue/40 flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-[13px] outline-none focus-visible:ring-2 ${
                type === value ? "bg-at-selected" : ""
              }`}
            >
              <Icon className="text-at-text-muted size-4" aria-hidden />
              <span className="flex-1">{label}</span>
              {type === value && (
                <Check className="text-at-text size-4" aria-hidden />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={trimmed === "" || taken || create.isPending}
        >
          {create.isPending ? "Creating..." : "Create field"}
        </Button>
      </div>
    </form>
  );
}
