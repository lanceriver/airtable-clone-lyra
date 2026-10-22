"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { api } from "~/trpc/react";

/** The lowest "Table N" that no table in the base is using yet. */
export function nextTableName(tables: { name: string }[]): string {
  const taken = new Set(tables.map((t) => t.name));
  let n = 1;
  while (taken.has(`Table ${n}`)) n++;
  return `Table ${n}`;
}

export type TableAddPopoverProps = {
  baseId: string;
  tables: { name: string }[];
};

/** "+ Add or import": a name field and "Create table"; opens the new table. */
export function TableAddPopover({ baseId, tables }: TableAddPopoverProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = api.table.create.useMutation({
    onSuccess: async (table) => {
      utils.table.list.setData({ baseId }, (old) => [
        ...(old ?? []),
        { id: table.id, name: table.name, createdAt: new Date() },
      ]);
      setOpen(false);
      router.push(`/${baseId}/${table.id}?viewId=${table.viewId}`);
      await utils.table.list.invalidate({ baseId });
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;
    create.mutate({ baseId, name: name.trim() || undefined });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setName(nextTableName(tables));
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="toolbar"
          className="flex-none hover:bg-black/5"
        >
          <Plus />
          Add or import
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-table-name">Table name</Label>
            <Input
              id="new-table-name"
              autoFocus
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create table"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
