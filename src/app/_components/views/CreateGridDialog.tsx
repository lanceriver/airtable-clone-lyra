"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";

/** The "Create new view" dialog for a grid view, with a pre-filled name. */
export function CreateGridDialog({
  open,
  onOpenChange,
  defaultName,
  isCreating,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  isCreating: boolean;
  onCreate: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        {/* Remounts on every open, so the field starts at the suggested name. */}
        {open && (
          <CreateGridForm
            defaultName={defaultName}
            isCreating={isCreating}
            onCancel={() => onOpenChange(false)}
            onCreate={onCreate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateGridForm({
  defaultName,
  isCreating,
  onCancel,
  onCreate,
}: {
  defaultName: string;
  isCreating: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isCreating) onCreate(name);
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-[15px]">Create a grid view</DialogTitle>
      </DialogHeader>
      <Input
        aria-label="View name"
        autoFocus
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
      />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating || name.trim() === ""}>
          Create new view
        </Button>
      </DialogFooter>
    </form>
  );
}
