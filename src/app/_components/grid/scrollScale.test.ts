import { describe, expect, it } from "vitest";

import {
  UNSCALED,
  computeScale,
  maxScrollTop,
  maxVirtualOffset,
  rowLayerShift,
  toScrollTop,
  toVirtualOffset,
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
