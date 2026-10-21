import { Plus } from "lucide-react";

import { HEADER_HEIGHT } from "./gridConstants";

type GridEmptyStateProps = {
  /** The table has no rows at all, as opposed to none matching the view. */
  tableEmpty: boolean;
  adding: boolean;
  onAddRecord: () => void;
  onClearFilters: () => void;
};

/**
 * Centered in the grid area under the header. It floats over the (empty)
 * scroll container, so it doesn't scroll with it.
 */
export function GridEmptyState({
  tableEmpty,
  adding,
  onAddRecord,
  onClearFilters,
}: GridEmptyStateProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-3 px-4 text-center"
      style={{ top: HEADER_HEIGHT + 1 }}
      data-testid={tableEmpty ? "grid-empty-table" : "grid-empty-view"}
    >
      <p className="text-[15px] text-[#616670]">
        {tableEmpty ? "No records yet" : "No records match this view"}
      </p>
      <button
        type="button"
        disabled={tableEmpty && adding}
        onClick={tableEmpty ? onAddRecord : onClearFilters}
        className="pointer-events-auto flex h-8 cursor-pointer items-center gap-1 rounded-md border border-[#dfe2e4] bg-white px-3 text-[13px] text-[#1d1f25] shadow-xs hover:bg-[#f2f4f8] focus-visible:ring-2 focus-visible:ring-[#166ee1] focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
      >
        {tableEmpty ? (
          <>
            <Plus className="size-[13px]" aria-hidden />
            Add a record
          </>
        ) : (
          "Clear search and filters"
        )}
      </button>
    </div>
  );
}
