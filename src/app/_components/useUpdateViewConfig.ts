"use client";

import { toast } from "sonner";

import { api, type RouterInputs } from "~/trpc/react";

export type ViewConfigPatch = Omit<
  RouterInputs["view"]["updateConfig"],
  "viewId"
>;

/**
 * Saves part of a view's config. The returned config replaces the cached
 * `view.get` data. Filters and sort change which rows the view shows, so the
 * view's row queries are reset to their first page (their old cursors don't
 * apply to the new result set). Hidden fields and search are applied to the
 * cache optimistically.
 */
export function useUpdateViewConfig(viewId: string) {
  const utils = api.useUtils();

  const mutation = api.view.updateConfig.useMutation({
    onMutate: async (patch) => {
      if (patch.hiddenColumnIds === undefined && patch.search === undefined) {
        return { previous: undefined };
      }
      await utils.view.get.cancel({ viewId });
      const previous = utils.view.get.getData({ viewId });
      utils.view.get.setData({ viewId }, (old) =>
        old
          ? {
              ...old,
              config: {
                ...old.config,
                ...(patch.hiddenColumnIds !== undefined && {
                  hiddenColumnIds: patch.hiddenColumnIds,
                }),
                ...(patch.search !== undefined && { search: patch.search }),
              },
            }
          : old,
      );
      return { previous };
    },
    onSuccess: (config, patch) => {
      utils.view.get.setData({ viewId }, (old) =>
        old ? { ...old, config } : old,
      );
      if (patch.filters !== undefined || patch.sort !== undefined) {
        void utils.row.getRows.reset({ viewId });
        void utils.row.countRows.invalidate({ viewId });
      }
    },
    onError: (error, _patch, context) => {
      if (context?.previous) {
        utils.view.get.setData({ viewId }, context.previous);
      }
      toast.error(error.message);
    },
  });

  const { mutate } = mutation;
  return {
    update: (patch: ViewConfigPatch) => mutate({ viewId, ...patch }),
    isPending: mutation.isPending,
    /** The patch being saved, while a save is in flight. */
    pendingPatch: mutation.isPending ? mutation.variables : undefined,
  };
}
