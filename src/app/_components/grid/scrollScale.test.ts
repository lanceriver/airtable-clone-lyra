import { describe, expect, it } from "vitest";

import {
  UNSCALED,
  accumulateScaledWheel,
  computeScale,
  maxScrollTop,
  maxVirtualOffset,
  rowLayerShift,
  scrollLeftToRevealColumn,
  scrollTopToRevealRow,
  toScrollTop,
  toVirtualOffset,
  wheelDeltaToPixels,
} from "./scrollScale";

const CAP = 8_000_000;
const ROW = 32;
const scale = (total: number, viewportHeight = 868) =>
  computeScale({ total, rowHeight: ROW, viewportHeight, cap: CAP });

describe("computeScale", () => {
  it("is 1:1 under the cap", () => {
    const s = scale(10_000);
    expect(s.scaled).toBe(false);
    expect(s.ratio).toBe(1);
    expect(s.spacerHeight).toBe(320_000);
  });

  it("is 1:1 exactly at the cap", () => {
    const s = scale(CAP / ROW);
    expect(s.scaled).toBe(false);
    expect(s.spacerHeight).toBe(CAP);
    const over = scale(CAP / ROW + 1);
    expect(over.scaled).toBe(true);
  });

  it("caps the spacer above the threshold", () => {
    const s = scale(1_000_000);
    expect(s.scaled).toBe(true);
    expect(s.spacerHeight).toBe(CAP);
    expect(s.totalHeight).toBe(32_000_000);
    expect(s.ratio).toBeGreaterThan(3.9);
    expect(s.ratio).toBeLessThan(4.1);
  });

  it("handles an empty table", () => {
    const s = scale(0);
    expect(s.scaled).toBe(false);
    expect(s.spacerHeight).toBe(0);
  });

  it("keeps the ratio nearly the same when the viewport changes", () => {
    const a = scale(1_000_000, 400).ratio;
    const b = scale(1_000_000, 1400).ratio;
    expect(Math.abs(a - b) / a).toBeLessThan(1e-3);
  });

  it("does not divide by zero when the viewport is as tall as the cap", () => {
    const s = scale(1_000_000, CAP + 5);
    expect(Number.isFinite(s.ratio)).toBe(true);
    expect(s.ratio).toBeGreaterThan(1);
  });
});

describe("scroll mapping", () => {
  for (const total of [300_000, 1_000_000, 5_000_000]) {
    for (const viewport of [300, 868, 2000]) {
      const s = scale(total, viewport);

      it(`maps ends to ends (${total} rows, viewport ${viewport})`, () => {
        expect(toVirtualOffset(s, 0)).toBe(0);
        expect(toVirtualOffset(s, maxScrollTop(s))).toBe(maxVirtualOffset(s));
        expect(toScrollTop(s, 0)).toBe(0);
        expect(toScrollTop(s, maxVirtualOffset(s))).toBeCloseTo(
          maxScrollTop(s),
          6,
        );
      });

      it(`is monotonic and round-trips within 1px (${total} rows, viewport ${viewport})`, () => {
        const max = maxScrollTop(s);
        let previous = -1;
        for (let i = 0; i <= 2000; i++) {
          const top = (max * i) / 2000;
          const offset = toVirtualOffset(s, top);
          expect(offset).toBeGreaterThanOrEqual(previous);
          previous = offset;
          expect(Math.abs(toScrollTop(s, offset) - top)).toBeLessThanOrEqual(1);
        }
      });

      it(`round-trips from virtual offsets (${total} rows, viewport ${viewport})`, () => {
        const max = maxVirtualOffset(s);
        for (let i = 0; i <= 500; i++) {
          const offset = Math.round((max * i) / 500);
          const back = toVirtualOffset(s, toScrollTop(s, offset));
          // One real pixel is `ratio` virtual pixels at most.
          expect(Math.abs(back - offset)).toBeLessThanOrEqual(
            Math.ceil(s.ratio),
          );
        }
      });
    }
  }

  it("is the identity when not scaled", () => {
    const s = scale(1000);
    for (const v of [0, 1, 17.5, 31_000]) {
      expect(toVirtualOffset(s, v)).toBe(v);
      expect(toScrollTop(s, v)).toBe(v);
      expect(rowLayerShift(s, v)).toBe(0);
    }
  });

  it("clamps out-of-range input", () => {
    const s = scale(1_000_000);
    expect(toVirtualOffset(s, -50)).toBe(0);
    expect(toVirtualOffset(s, 1e9)).toBe(maxVirtualOffset(s));
    expect(toScrollTop(s, 1e12)).toBeLessThanOrEqual(maxScrollTop(s));
    expect(toScrollTop(s, -5)).toBe(0);
  });

  it("returns whole virtual offsets when scaled", () => {
    const s = scale(1_000_000);
    for (const top of [1, 1234.56, 3_999_999.4]) {
      expect(Number.isInteger(toVirtualOffset(s, top))).toBe(true);
    }
  });
});

describe("rowLayerShift", () => {
  it("places rows at their virtual position relative to the viewport", () => {
    const s = scale(1_000_000);
    for (const top of [0, 1, 777, 4_000_000, maxScrollTop(s)]) {
      const offset = toVirtualOffset(s, top);
      const row = 500_000;
      // Row y in the spacer, minus scrollTop, is its y in the viewport.
      const viewportY = rowLayerShift(s, offset) + row * ROW - top;
      expect(viewportY).toBe(row * ROW - offset);
    }
  });
});

describe("UNSCALED", () => {
  it("behaves as the identity", () => {
    expect(toVirtualOffset(UNSCALED, 42)).toBe(42);
    expect(toScrollTop(UNSCALED, 42)).toBe(42);
  });
});

describe("scrollTopToRevealRow", () => {
  const VIEW = 868; // 27 rows and a bit

  it("does not move when the row is already visible", () => {
    const s = scale(1000, VIEW);
    expect(scrollTopToRevealRow(s, 320, 10, ROW)).toBe(320); // top row
    expect(scrollTopToRevealRow(s, 320, 20, ROW)).toBe(320);
    expect(scrollTopToRevealRow(s, 320, 36, ROW)).toBe(320); // bottom row
  });

  it("aligns a row above the viewport to the top", () => {
    const s = scale(1000, VIEW);
    expect(scrollTopToRevealRow(s, 320, 3, ROW)).toBe(96);
    expect(scrollTopToRevealRow(s, 320, 0, ROW)).toBe(0);
  });

  it("aligns a row below the viewport to the bottom", () => {
    const s = scale(1000, VIEW);
    // Row 50 ends at 1632; the viewport is 868 tall.
    expect(scrollTopToRevealRow(s, 0, 50, ROW)).toBe(1632 - VIEW);
  });

  it("stops at the last scroll position for the last row", () => {
    const s = scale(1000, VIEW);
    expect(scrollTopToRevealRow(s, 0, 999, ROW)).toBe(maxScrollTop(s));
  });

  it("keeps the row whole when scaled, whatever the rounding", () => {
    const s = scale(1_000_000, VIEW);
    for (const row of [27, 28, 5_000, 123_457, 999_999]) {
      const down = scrollTopToRevealRow(s, 0, row, ROW);
      const offset = toVirtualOffset(s, down);
      expect(offset).toBeLessThanOrEqual(row * ROW);
      expect(row * ROW + ROW).toBeLessThanOrEqual(offset + VIEW);
    }
    for (const row of [0, 3, 500_000, 999_000]) {
      const start = maxScrollTop(s);
      const up = scrollTopToRevealRow(s, start, row, ROW);
      const offset = toVirtualOffset(s, up);
      expect(offset).toBeLessThanOrEqual(row * ROW);
      expect(row * ROW + ROW).toBeLessThanOrEqual(offset + VIEW);
    }
  });

  it("does not move for a visible row when scaled", () => {
    const s = scale(1_000_000, VIEW);
    const top = 1_000_000;
    const row = Math.round(toVirtualOffset(s, top) / ROW) + 5;
    expect(scrollTopToRevealRow(s, top, row, ROW)).toBe(top);
  });
});

describe("scrollLeftToRevealColumn", () => {
  // Row numbers 66 + primary 180 stick; the container is 1000 px wide.
  const base = { stickyWidth: 246, clientWidth: 1000 };

  it("does not move for a visible cell", () => {
    expect(
      scrollLeftToRevealColumn({
        ...base,
        cellLeft: 426,
        cellWidth: 180,
        scrollLeft: 0,
      }),
    ).toBe(0);
  });

  it("scrolls right until a cell past the right edge is whole", () => {
    expect(
      scrollLeftToRevealColumn({
        ...base,
        cellLeft: 1086,
        cellWidth: 180,
        scrollLeft: 0,
      }),
    ).toBe(266);
  });

  it("scrolls left when the sticky columns cover the cell", () => {
    // The cell is at 426..606; scrollLeft 300 puts it under the sticky 246.
    expect(
      scrollLeftToRevealColumn({
        ...base,
        cellLeft: 426,
        cellWidth: 180,
        scrollLeft: 300,
      }),
    ).toBe(180);
  });

  it("counts a half-covered cell as hidden", () => {
    expect(
      scrollLeftToRevealColumn({
        ...base,
        cellLeft: 426,
        cellWidth: 180,
        scrollLeft: 200,
      }),
    ).toBe(180);
  });

  it("shows the left edge of a cell wider than the free room", () => {
    expect(
      scrollLeftToRevealColumn({
        ...base,
        cellLeft: 1086,
        cellWidth: 900,
        scrollLeft: 0,
      }),
    ).toBe(840);
  });

  it("never scrolls below zero", () => {
    expect(
      scrollLeftToRevealColumn({
        ...base,
        cellLeft: 100,
        cellWidth: 180,
        scrollLeft: 50,
      }),
    ).toBe(0);
  });
});

describe("wheelDeltaToPixels", () => {
  it("keeps pixel deltas", () => {
    expect(wheelDeltaToPixels(120, 0, 800)).toBe(120);
  });

  it("converts lines and pages", () => {
    expect(wheelDeltaToPixels(3, 1, 800)).toBe(96);
    expect(wheelDeltaToPixels(1, 2, 800)).toBe(800);
    expect(wheelDeltaToPixels(-1, 2, 800)).toBe(-800);
  });
});

describe("accumulateScaledWheel", () => {
  it("divides the delta by the ratio", () => {
    expect(accumulateScaledWheel(0, 320, 4)).toEqual({
      scrollBy: 80,
      remainder: 0,
    });
  });

  it("is a plain scroll at ratio 1", () => {
    expect(accumulateScaledWheel(0, 100, 1)).toEqual({
      scrollBy: 100,
      remainder: 0,
    });
  });

  it("carries the fraction to the next event", () => {
    const first = accumulateScaledWheel(0, 6, 4); // 1.5
    expect(first.scrollBy).toBe(1);
    expect(first.remainder).toBeCloseTo(0.5);
    const second = accumulateScaledWheel(first.remainder, 6, 4);
    expect(second.scrollBy).toBe(2);
    expect(second.remainder).toBeCloseTo(0);
  });

  it("still scrolls with tiny trackpad deltas", () => {
    let remainder = 0;
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const step = accumulateScaledWheel(remainder, 1, 4);
      remainder = step.remainder;
      total += step.scrollBy;
    }
    expect(total).toBe(25); // 100 px of wheel = 25 real px = 100 virtual px
  });

  it("accumulates upward scrolling symmetrically", () => {
    let remainder = 0;
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const step = accumulateScaledWheel(remainder, -1, 4);
      remainder = step.remainder;
      total += step.scrollBy;
    }
    expect(total).toBe(-25);
  });

  it("moves about deltaPx / rowHeight rows on the 1M-row table", () => {
    const s = scale(1_000_000);
    const { scrollBy } = accumulateScaledWheel(0, 320, s.ratio);
    const rows = (scrollBy * s.ratio) / ROW;
    expect(rows).toBeGreaterThan(9.5);
    expect(rows).toBeLessThan(10.5);
  });

  it("treats a ratio below 1 as 1", () => {
    expect(accumulateScaledWheel(0, 10, 0.5)).toEqual({
      scrollBy: 10,
      remainder: 0,
    });
  });
});
