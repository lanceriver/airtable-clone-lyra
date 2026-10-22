"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";

/** The next free "Grid N" name ("Grid 2", "Grid 3"...), case-insensitive. */
export function nextGridName(names: readonly string[]) {
  const taken = new Set(names.map((name) => name.trim().toLowerCase()));
  let n = 2;
  while (taken.has(`grid ${n}`)) n++;
  return `Grid ${n}`;
}

/**
 * Create, rename and delete for a table's views, shared by the views sidebar
 * and the toolbar's view menu. Creating a view opens it; deleting the active
 * view opens another one. The server refuses to delete a table's last view.
 */
export function useViewActions({
  baseId,
  tableId,
  activeViewId,
}: {
  baseId: string;
  tableId: string;
  activeViewId: string;
}) {
  const utils = api.useUtils();
  const router = useRouter();
  const { data: views } = api.view.list.useQuery({ tableId });

  const goToView = (viewId: string) => {
    router.push(`/${baseId}/${tableId}?viewId=${viewId}`);
  };

  const create = api.view.create.useMutation({
    onSuccess: async (view) => {
      await Promise.all([
        utils.view.list.invalidate({ tableId }),
        utils.table.get.invalidate({ tableId }),
      ]);
      goToView(view.id);
    },
    onError: (error) => toast.error(error.message),
  });

  const rename = api.view.rename.useMutation({
    onSuccess: (view) => {
      void utils.view.list.invalidate({ tableId });
      void utils.table.get.invalidate({ tableId });
      void utils.view.get.invalidate({ viewId: view.id });
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = api.view.delete.useMutation({
    onSuccess: async (deleted) => {
      await Promise.all([
        utils.view.list.invalidate({ tableId }),
        utils.table.get.invalidate({ tableId }),
      ]);
      if (deleted.id === activeViewId) {
        const next = views?.find((view) => view.id !== deleted.id);
        if (next) goToView(next.id);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  return {
    /** The table's views (undefined while loading). */
    views,
    /** False for the table's last view, which can't be deleted. */
    canDelete: (views?.length ?? 0) > 1,
    /** The name to suggest for a new grid view: "Grid 2", "Grid 3"... */
    nextGridName: nextGridName(views?.map((view) => view.name) ?? []),
    goToView,
    /** Creates a view (the server names it when `name` is empty) and opens it. */
    createView: (name?: string, options?: { onSuccess?: () => void }) => {
      const trimmed = name?.trim();
      create.mutate(
        { tableId, name: trimmed === "" ? undefined : trimmed },
        { onSuccess: () => options?.onSuccess?.() },
      );
    },
    isCreating: create.isPending,
    /** Renames a view; a blank or unchanged name does nothing. */
    renameView: (viewId: string, name: string) => {
      const trimmed = name.trim();
      const current = views?.find((view) => view.id === viewId);
      if (trimmed !== "" && trimmed !== current?.name) {
        rename.mutate({ viewId, name: trimmed });
      }
    },
    deleteView: (viewId: string) => remove.mutate({ viewId }),
  };
}
