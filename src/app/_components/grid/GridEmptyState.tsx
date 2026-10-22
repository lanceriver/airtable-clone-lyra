import { Plus } from "lucide-react";

import { Button } from "~/components/ui/button";
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
      <p className="text-at-text-muted text-[13px]">
        {tableEmpty ? "No records yet" : "No records match this view"}
      </p>
      <Button
        type="button"
        disabled={tableEmpty && adding}
        onClick={tableEmpty ? onAddRecord : onClearFilters}
        className="pointer-events-auto"
      >
        {tableEmpty ? (
          <>
            <Plus aria-hidden />
            Add a record
          </>
        ) : (
          "Clear search and filters"
        )}
      </Button>
    </div>
  );
}
