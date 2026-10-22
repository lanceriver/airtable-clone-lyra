"use client";

import { Check, Hash, Plus, Type, type LucideIcon } from "lucide-react";
import { useState } from "react";
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
          className="flex h-full w-full cursor-pointer items-center justify-center text-[#616670] outline-none hover:bg-black/5 focus-visible:bg-black/5"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-3"
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
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Input
          autoFocus
          aria-label="Field name"
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
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
      <div role="radiogroup" aria-label="Field type" className="grid gap-0.5">
        {FIELD_TYPES.map(({ type: value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => setType(value)}
            className={`flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#166ee1]/50 ${
              type === value ? "bg-gray-100 font-medium" : ""
            }`}
          >
            <Icon className="h-4 w-4 text-[#616670]" aria-hidden />
            <span className="flex-1">{label}</span>
            {type === value && <Check className="h-4 w-4" aria-hidden />}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={trimmed === "" || taken || create.isPending}
        >
          {create.isPending ? "Creating..." : "Create field"}
        </Button>
      </div>
    </form>
  );
}
