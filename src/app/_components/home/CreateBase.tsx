"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BaseIcon } from "~/components/at/BaseIcon";
import { ColorSwatches } from "~/components/at/ColorSwatches";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { randomBaseColor, type BaseColor } from "~/lib/baseColors";
import { api } from "~/trpc/react";

const DEFAULT_NAME = "Untitled Base";

/** The create-base dialog: a name, a colour and a live icon preview. */
export function CreateBaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so each opening starts fresh. */}
        <CreateBaseForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateBaseForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [color, setColor] = useState<BaseColor>(randomBaseColor);

  const create = api.base.create.useMutation({
    onSuccess: (base) => {
      void utils.base.list.invalidate();
      onClose();
      router.push(`/${base.id}/${base.tableId}?viewId=${base.viewId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (create.isPending) return;
        create.mutate({ name: name.trim() || undefined, color });
      }}
    >
      <DialogHeader>
        <DialogTitle>Create a base</DialogTitle>
        <DialogDescription>
          Name your base and pick a colour for its icon.
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-end gap-4">
        <BaseIcon name={name.trim() || DEFAULT_NAME} color={color} size={56} />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor="create-base-name" className="text-[13px]">
            Name
          </Label>
          <Input
            id="create-base-name"
            autoFocus
            autoComplete="off"
            maxLength={100}
            placeholder={DEFAULT_NAME}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2.5">
        <span className="text-at-text text-[13px] font-medium">Colour</span>
        <ColorSwatches value={color} onChange={setColor} className="px-1" />
      </div>
      <DialogFooter className="mt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create base"}
        </Button>
      </DialogFooter>
    </form>
  );
}
