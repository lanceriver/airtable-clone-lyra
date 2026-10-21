/**
 * Scaled scrolling for very tall tables. See docs/plans/phase-2-grid.md
 * ("Very tall tables: scaled scrolling").
 *
 * Browsers cap the height of an element (about 17.9M px in Firefox, 33.5M px
 * in Chrome), and 1M rows x 32 px is 32M px. Above `cap`, the scroll
 * container's spacer is only `cap` px tall, and the real `scrollTop` maps
 * linearly to a "virtual offset" in the full-height table:
 *
 *   virtualOffset = scrollTop * ratio
 *
 * `ratio` is chosen so the top maps to the top and the last scroll position
 * maps to the last one: the maximum scrollTop is `spacerHeight - viewport`
 * and the maximum virtual offset is `total * rowHeight - viewport`.
 *
 * The virtualizer works in virtual offsets. Rows are positioned relative to
 * the real scroll position (see `rowLayerShift`), so they land on whole pixels
 * wherever the scrollbar is.
 *
 * Below the cap everything is 1:1 and this module is the identity.
 */

export type ScrollScale = {
  /** Height of the body spacer, in px. */
  spacerHeight: number;
  /** Virtual px per real scroll px; 1 when not scaled. */
  ratio: number;
  /** True when the table is taller than the cap. */
  scaled: boolean;
  /** Full height of the table, `total * rowHeight`. */
  totalHeight: number;
  /** Height of the part of the viewport that shows rows. */
  viewportHeight: number;
};

export type ScaleInput = {
  total: number;
  rowHeight: number;
  /** Height of the viewport area that shows rows (without a sticky header). */
  viewportHeight: number;
  /** Largest spacer height to use. */
  cap: number;
};

export const UNSCALED: ScrollScale = {
  spacerHeight: 0,
  ratio: 1,
  scaled: false,
  totalHeight: 0,
  viewportHeight: 0,
};

export function computeScale({
  total,
  rowHeight,
  viewportHeight,
  cap,
}: ScaleInput): ScrollScale {
  const totalHeight = Math.max(0, total) * rowHeight;
  const viewport = Math.max(0, viewportHeight);
  if (totalHeight <= cap) {
    return {
      spacerHeight: totalHeight,
      ratio: 1,
      scaled: false,
      totalHeight,
      viewportHeight: viewport,
    };
  }
  // Scrollable range of the spacer and of the full-height table.
  const realRange = cap - viewport;
  const virtualRange = totalHeight - viewport;
  const ratio = realRange > 0 ? virtualRange / realRange : totalHeight / cap;
  return {
    spacerHeight: cap,
    ratio,
    scaled: true,
    totalHeight,
    viewportHeight: viewport,
  };
}

/** The largest value `scrollTop` can take. */
export function maxScrollTop(scale: ScrollScale): number {
  return Math.max(0, scale.spacerHeight - scale.viewportHeight);
}

/** The largest virtual offset (the table scrolled to its end). */
export function maxVirtualOffset(scale: ScrollScale): number {
  return Math.max(0, scale.totalHeight - scale.viewportHeight);
}

/**
 * Real scroll position -> virtual offset. When scaled the result is a whole
 * number (so rows sit on whole pixels), and the last scroll position, give or
 * take a pixel, maps exactly to the end of the table.
 */
export function toVirtualOffset(scale: ScrollScale, scrollTop: number): number {
  if (!scale.scaled) return scrollTop;
  const top = Math.max(0, scrollTop);
  const maxTop = maxScrollTop(scale);
  const maxOffset = maxVirtualOffset(scale);
  if (top >= maxTop - 1) return maxOffset;
  return Math.min(maxOffset, Math.round(top * scale.ratio));
}

/** Virtual offset -> real scroll position (for `scrollTo`). */
export function toScrollTop(scale: ScrollScale, virtualOffset: number): number {
  if (!scale.scaled) return virtualOffset;
  const offset = Math.max(0, virtualOffset);
  return Math.min(maxScrollTop(scale), offset / scale.ratio);
}

/**
 * How far the layer holding the rendered rows moves down inside the spacer so
 * that row `i` (at `i * rowHeight` in the layer) appears at
 * `i * rowHeight - virtualOffset` in the viewport. Rows are then pixel-exact
 * wherever the scrollbar is. Zero when not scaled.
 */
export function rowLayerShift(
  scale: ScrollScale,
  virtualOffset: number,
): number {
  if (!scale.scaled) return 0;
  return Math.round(toScrollTop(scale, virtualOffset) - virtualOffset);
}

/**
 * The `scrollTop` that brings row `rowIndex` fully into view with the least
 * movement, or `scrollTop` itself when it already is. The sticky header is
 * not part of the row area (`scale.viewportHeight` excludes it), so a row
 * "just under the header" is at virtual offset `rowIndex * rowHeight`.
 *
 * When scaled, one real pixel is `ratio` virtual px. The result is rounded
 * toward the row's side of the viewport so that the row ends up whole, not
 * clipped by the rounding.
 */
export function scrollTopToRevealRow(
  scale: ScrollScale,
  scrollTop: number,
  rowIndex: number,
  rowHeight: number,
): number {
  const offset = toVirtualOffset(scale, scrollTop);
  const top = rowIndex * rowHeight;
  const bottom = top + rowHeight;
  if (top < offset) {
    return Math.max(0, Math.floor(toScrollTop(scale, top)));
  }
  if (bottom > offset + scale.viewportHeight) {
    return Math.min(
      maxScrollTop(scale),
      Math.ceil(toScrollTop(scale, bottom - scale.viewportHeight)),
    );
  }
  return scrollTop;
}

export type ColumnReveal = {
  /** Left edge of the cell inside the scrolling content. */
  cellLeft: number;
  cellWidth: number;
  /** Width of the sticky row-number and primary columns; they cover cells. */
  stickyWidth: number;
  scrollLeft: number;
  /** Visible width of the scroll container (without its scrollbar). */
  clientWidth: number;
};

/**
 * The `scrollLeft` that brings a cell fully into view, counting what the
 * sticky columns cover as hidden, or `scrollLeft` itself when it is already
 * visible. A cell wider than the room left shows its left edge.
 */
export function scrollLeftToRevealColumn({
  cellLeft,
  cellWidth,
  stickyWidth,
  scrollLeft,
  clientWidth,
}: ColumnReveal): number {
  if (cellLeft < scrollLeft + stickyWidth) {
    return Math.max(0, cellLeft - stickyWidth);
  }
  if (cellLeft + cellWidth > scrollLeft + clientWidth) {
    return Math.max(
      0,
      Math.min(cellLeft - stickyWidth, cellLeft + cellWidth - clientWidth),
    );
  }
  return scrollLeft;
}

/** Pixels per line / per page for `WheelEvent.deltaMode` 1 and 2. */
export const WHEEL_LINE_PX = 32;

/** `WheelEvent.deltaY` (or deltaX) in pixels, whatever its `deltaMode`. */
export function wheelDeltaToPixels(
  delta: number,
  deltaMode: number,
  pageHeight: number,
): number {
  if (deltaMode === 1) return delta * WHEEL_LINE_PX;
  if (deltaMode === 2) return delta * pageHeight;
  return delta;
}

/**
 * Wheel scrolling for a scaled table. One real scroll pixel moves the rows by
 * `ratio` pixels, so a wheel delta of `deltaPx` is divided by `ratio` to move
 * the rows by about `deltaPx`. `scrollTop` takes whole pixels, so the
 * fractional part is carried in `remainder` to the next event: a slow
 * trackpad gesture of many tiny deltas still scrolls.
 *
 * Returns the whole number of pixels to add to `scrollTop` and the new
 * remainder (always in (-1, 1)).
 */
export function accumulateScaledWheel(
  remainder: number,
  deltaPx: number,
  ratio: number,
): { scrollBy: number; remainder: number } {
  const exact = remainder + deltaPx / Math.max(1, ratio);
  const scrollBy = Math.trunc(exact);
  return { scrollBy, remainder: exact - scrollBy };
}
