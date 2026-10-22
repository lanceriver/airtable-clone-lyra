import { Loader2, Plus } from "lucide-react";

import { GRID_LINE_COLOR } from "./gridConstants";

export const FOOTER_HEIGHT = 32;

type GridFooterProps = {
  /** Rows in the view, and in the table; undefined until counted. */
  total: number | undefined;
  totalUnfiltered: number | undefined;
  isFetching: boolean;
  adding: boolean;
  onAddRecord: () => void;
};

export function recordCountLabel(
  total: number,
  totalUnfiltered: number,
): string {
  if (total === totalUnfiltered) {
    return `${total.toLocaleString("en-US")} ${total === 1 ? "record" : "records"}`;
  }
  return `${total.toLocaleString("en-US")} of ${totalUnfiltered.toLocaleString("en-US")} records`;
}

/**
 * The bar under the grid (outside its scroll container, so it is always in
 * view): "+ Add record" on the left, the record count on the right.
 */
export function GridFooter({
  total,
  totalUnfiltered,
  isFetching,
  adding,
  onAddRecord,
}: GridFooterProps) {
  return (
    <div
      data-testid="grid-footer"
      className="box-border flex flex-none items-center justify-between border-t bg-white px-1 text-[13px] text-[#1d1f25]"
      style={{ height: FOOTER_HEIGHT, borderTopColor: GRID_LINE_COLOR }}
    >
      <button
        type="button"
        data-testid="add-record"
        disabled={adding || total === undefined}
        onClick={onAddRecord}
        className="flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-[13px] text-[#1d1f25] hover:bg-[#f2f4f8] focus-visible:ring-2 focus-visible:ring-[#166ee1] focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
      >
        {adding ? (
          <Loader2 className="size-[13px] animate-spin" aria-hidden />
        ) : (
          <Plus className="size-[13px]" aria-hidden />
        )}
        Add record
      </button>
      <div
        className="flex items-center gap-2 px-2 text-[13px] text-[#616670]"
        aria-live="polite"
      >
        {isFetching && (
          <Loader2
            className="size-3 animate-spin text-[#9aa0a6]"
            aria-label="Loading"
            data-testid="footer-spinner"
          />
        )}
        {total !== undefined && totalUnfiltered !== undefined && (
          <span data-testid="record-count">
            {recordCountLabel(total, totalUnfiltered)}
          </span>
        )}
      </div>
    </div>
  );
}
