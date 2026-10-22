import { Loader2, Plus } from "lucide-react";

import { Button } from "~/components/ui/button";

export const FOOTER_HEIGHT = 34;

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
      className="border-at-border box-border flex flex-none items-center justify-between border-t bg-white px-2"
      style={{ height: FOOTER_HEIGHT }}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="add-record"
        disabled={adding || total === undefined}
        onClick={onAddRecord}
      >
        {adding ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Plus aria-hidden />
        )}
        Add record
      </Button>
      <div
        className="text-at-text-muted flex items-center gap-2 px-2 text-xs"
        aria-live="polite"
      >
        {isFetching && (
          <Loader2
            className="text-at-text-subtle size-3 animate-spin"
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
