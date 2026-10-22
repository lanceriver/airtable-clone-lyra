"use client";

import { toast } from "sonner";

import type { BaseColor } from "~/lib/baseColors";
import { api, type RouterOutputs } from "~/trpc/react";

export type HomeBase = RouterOutputs["base"]["list"][number];

/**
 * Rename, recolour and delete for the home page's bases. Each one updates the
 * cached list straight away and rolls back (with a toast) if the server
 * refuses, then refetches to settle.
 */
export function useBaseActions() {
  const utils = api.useUtils();

  const optimistic = (update: (bases: HomeBase[]) => HomeBase[]) => {
    return async () => {
      await utils.base.list.cancel();
      const previous = utils.base.list.getData();
      utils.base.list.setData(undefined, (old) => (old ? update(old) : old));
      return { previous };
    };
  };
  const rollback = (
    error: { message: string },
    _vars: unknown,
    ctx: { previous: HomeBase[] | undefined } | undefined,
  ) => {
    if (ctx?.previous) utils.base.list.setData(undefined, ctx.previous);
    toast.error(error.message);
  };
  const settle = () => void utils.base.list.invalidate();

  const rename = api.base.rename.useMutation({
    onMutate: (v) =>
      optimistic((bases) =>
        bases.map((b) => (b.id === v.baseId ? { ...b, name: v.name } : b)),
      )(),
    onError: rollback,
    onSettled: settle,
  });
  const setColor = api.base.setColor.useMutation({
    onMutate: (v) =>
      optimistic((bases) =>
        bases.map((b) => (b.id === v.baseId ? { ...b, color: v.color } : b)),
      )(),
    onError: rollback,
    onSettled: settle,
  });
  const remove = api.base.delete.useMutation({
    onMutate: (v) =>
      optimistic((bases) => bases.filter((b) => b.id !== v.baseId))(),
    onError: rollback,
    onSettled: settle,
  });

  return {
    rename: (baseId: string, name: string) => rename.mutate({ baseId, name }),
    setColor: (baseId: string, color: BaseColor) =>
      setColor.mutate({ baseId, color }),
    remove: (baseId: string) => remove.mutate({ baseId }),
  };
}
