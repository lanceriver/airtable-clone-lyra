"use client";

import { useRef } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

const COUNT = 100_000;
const TOAST_ID = "add-fake-rows";

/**
 * "Add 100k rows". The server inserts in chunks inside one request, so there
 * is no real progress to report: a persistent toast with a spinner shows the
 * elapsed seconds, then turns into a success (or error) toast.
 */
export function useAddFakeRows({
  tableId,
  onRowsAdded,
}: {
  tableId: string;
  onRowsAdded?: () => void;
}) {
  const utils = api.useUtils();
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const stopTimer = () => {
    clearInterval(timer.current);
    timer.current = undefined;
  };

  const mutation = api.row.addFakeRows.useMutation({
    onMutate: () => {
      const startedAt = Date.now();
      const show = () =>
        toast.loading(
          `Adding ${COUNT.toLocaleString("en-US")} records… ${Math.floor((Date.now() - startedAt) / 1000)}s`,
          { id: TOAST_ID, duration: Infinity },
        );
      show();
      stopTimer();
      timer.current = setInterval(show, 1000);
    },
    onSuccess: () => {
      stopTimer();
      toast.success(`Added ${COUNT.toLocaleString("en-US")} records`, {
        id: TOAST_ID,
        duration: 4000,
      });
      void utils.row.getRows.invalidate();
      void utils.row.countRows.invalidate();
      onRowsAdded?.();
    },
    onError: (error) => {
      stopTimer();
      toast.error(error.message || "Error adding records. Please try again.", {
        id: TOAST_ID,
        duration: 6000,
      });
    },
  });

  return {
    isPending: mutation.isPending,
    add: () => mutation.mutate({ tableId, count: COUNT }),
  };
}
