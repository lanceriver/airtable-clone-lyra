"use client";

import { toast } from "sonner";

import { api, type RouterInputs } from "~/trpc/react";
import { sequenceFor } from "./requestSequence";

export type ViewConfigPatch = Omit<
  RouterInputs["view"]["updateConfig"],
  "viewId"
>;

/**
 * Saves part of a view's config. The returned config replaces the cached
 * `view.get` data. Filters and sort change which rows the view shows, so the
 * view's row queries are reset to their first page (their old cursors don't
 * apply to the new result set). Hidden fields, search and column widths are applied to the
 * cache optimistically.
 *
 * Saves can finish out of order (a sort change waits for its index to build).
 * Each save is numbered, and a response that is older than the newest save
 * sent is not written to the cache, since it would replace newer config. Its
 * effect on the row queries is still applied: the server has that config.
 */
export function useUpdateViewConfig(viewId: string) {
  const utils = api.useUtils();
  const sequence = sequenceFor(viewId);

  const mutation = api.view.updateConfig.useMutation({
    onMutate: async (patch) => {
      const seq = sequence.next();
      if (
        patch.hiddenColumnIds === undefined &&
        patch.search === undefined &&
        patch.columnWidths === undefined
      ) {
        return { previous: undefined, seq };
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
                ...(patch.columnWidths !== undefined && {
                  columnWidths: patch.columnWidths,
                }),
              },
            }
          : old,
      );
      return { previous, seq };
    },
    onSuccess: (config, patch, context) => {
      if (context && sequence.isLatest(context.seq)) {
        utils.view.get.setData({ viewId }, (old) =>
          old ? { ...old, config } : old,
        );
      }
      if (patch.filters !== undefined || patch.sort !== undefined) {
        void utils.row.getRows.reset({ viewId });
        void utils.row.countRows.invalidate({ viewId });
      }
    },
    onError: (error, _patch, context) => {
      if (context?.previous && sequence.isLatest(context.seq)) {
        utils.view.get.setData({ viewId }, context.previous);
      }
      // Older saves may have finished since; read back what the server has.
      if (context && !sequence.isLatest(context.seq)) {
        void utils.view.get.invalidate({ viewId });
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
