"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { BaseIcon } from "~/components/at/BaseIcon";
import { ColorSwatches } from "~/components/at/ColorSwatches";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { BaseColor } from "~/lib/baseColors";
import { api } from "~/trpc/react";

export type BaseHeaderMenuProps = {
  baseId: string;
  name: string;
  color: string;
  /** Optimistic updates, applied before the server answers. */
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
};

/**
 * The base icon, name and chevron, and the popover they open: a rename input,
 * the colour swatches and "Delete base" (with a confirm step).
 */
export function BaseHeaderMenu({
  baseId,
  name,
  color,
  onNameChange,
  onColorChange,
}: BaseHeaderMenuProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirming, setConfirming] = useState(false);
  // Set by Esc so the blur that follows the popover closing does not save.
  const cancelled = useRef(false);

  const refreshEverywhere = () => {
    router.refresh();
    void utils.base.list.invalidate();
  };

  const rename = api.base.rename.useMutation({
    onSuccess: refreshEverywhere,
  });
  const setColor = api.base.setColor.useMutation({
    onSuccess: refreshEverywhere,
  });
  const remove = api.base.delete.useMutation({
    onSuccess: () => {
      void utils.base.list.invalidate();
      router.push("/");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const commitName = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(name);
      return;
    }
    const next = draft.trim();
    if (next === "" || next === name) {
      setDraft(name);
      return;
    }
    const previous = name;
    onNameChange(next);
    setDraft(next);
    rename.mutate(
      { baseId, name: next },
      {
        onError: (e) => {
          onNameChange(previous);
          setDraft(previous);
          toast.error(e.message);
        },
      },
    );
  };

  const changeColor = (next: BaseColor) => {
    if (next === color) return;
    const previous = color;
    onColorChange(next);
    setColor.mutate(
      { baseId, color: next },
      {
        onError: (e) => {
          onColorChange(previous);
          toast.error(e.message);
        },
      },
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          cancelled.current = false;
          setDraft(name);
        } else {
          setConfirming(false);
        }
      }}
    >
      <h1 className="min-w-0">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${name}, base settings`}
            className="hover:bg-at-hover focus-visible:ring-at-blue/40 -ml-1 flex max-w-full min-w-0 cursor-pointer items-center gap-3 rounded-md py-1 pr-2 pl-1 text-[17px] font-semibold outline-none focus-visible:ring-2"
          >
            <BaseIcon name={name} color={color} size={32} />
            <span className="text-at-text truncate">{name}</span>
            <ChevronDown className="text-at-text-muted -ml-2 size-4 flex-none" />
          </button>
        </PopoverTrigger>
      </h1>

      <PopoverContent align="start" className="w-72 p-3">
        <label
          htmlFor="base-name-input"
          className="text-at-text-muted mb-1 block text-xs font-medium"
        >
          Base name
        </label>
        <Input
          id="base-name-input"
          value={draft}
          maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitName();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              cancelled.current = true;
              setDraft(name);
            }
          }}
        />

        <p className="text-at-text-muted mt-3 mb-2 text-xs font-medium">
          Colour
        </p>
        <ColorSwatches
          value={color}
          onChange={changeColor}
          className="flex-wrap gap-x-2.5 gap-y-2.5 px-1 py-0.5"
        />

        <div className="border-at-border mt-3 border-t pt-2">
          {confirming ? (
            <div role="alertdialog" aria-label="Delete base">
              <p className="text-at-text mb-2 text-[13px]">
                Delete <span className="font-semibold">{name}</span> and all of
                its tables? This can&apos;t be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={remove.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => remove.mutate({ baseId })}
                  disabled={remove.isPending}
                >
                  {remove.isPending ? "Deleting…" : "Delete base"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="default"
              className="text-destructive hover:text-destructive w-full justify-start px-2"
              onClick={() => setConfirming(true)}
            >
              Delete base
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
