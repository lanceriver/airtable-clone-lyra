import { describe, expect, it } from "vitest";

import {
  cellValueChanged,
  formatCellValue,
  isValidPartialNumber,
  parseDraft,
} from "./cellValue";

describe("formatCellValue", () => {
  it("shows values as they are", () => {
    expect(formatCellValue("abc", "string")).toBe("abc");
    expect(formatCellValue(42, "number")).toBe("42");
    expect(formatCellValue(-1.5, "number")).toBe("-1.5");
    expect(formatCellValue(0, "number")).toBe("0");
  });

  it("shows nothing for an empty cell", () => {
    expect(formatCellValue(undefined, "string")).toBe("");
    expect(formatCellValue(null, "number")).toBe("");
  });
});

describe("isValidPartialNumber", () => {
  it.each(["", "-", "1", "12.5", "1.", ".", "-.5", "-1.25", " 7 "])(
    "accepts %j",
    (draft) => expect(isValidPartialNumber(draft)).toBe(true),
  );

  it.each(["abc", "1a", "1.2.3", "--1", "1-", "+1", "1e3", "1,5", "- 1"])(
    "rejects %j",
    (draft) => expect(isValidPartialNumber(draft)).toBe(false),
  );
});

describe("parseDraft, number", () => {
  it("parses numbers", () => {
    expect(parseDraft("42", "number")).toEqual({ ok: true, value: 42 });
    expect(parseDraft(" -3.5 ", "number")).toEqual({ ok: true, value: -3.5 });
    expect(parseDraft("1.", "number")).toEqual({ ok: true, value: 1 });
    expect(parseDraft(".5", "number")).toEqual({ ok: true, value: 0.5 });
    expect(parseDraft("-0", "number")).toEqual({ ok: true, value: 0 });
  });

  it("clears on empty or blank", () => {
    expect(parseDraft("", "number")).toEqual({ ok: true, value: null });
    expect(parseDraft("   ", "number")).toEqual({ ok: true, value: null });
  });

  it.each(["abc", "-", ".", "1e3", "1.2.3", "0x10", "Infinity", "9".repeat(400)])(
    "rejects %j",
    (draft) =>
      expect(parseDraft(draft, "number")).toEqual({
        ok: false,
        error: "Enter a number",
      }),
  );
});

describe("parseDraft, text", () => {
  it("keeps the text as typed", () => {
    expect(parseDraft("Hello", "string")).toEqual({ ok: true, value: "Hello" });
    expect(parseDraft("  padded ", "string")).toEqual({
      ok: true,
      value: "  padded ",
    });
    expect(parseDraft("12", "string")).toEqual({ ok: true, value: "12" });
  });

  it("clears on empty", () => {
    expect(parseDraft("", "string")).toEqual({ ok: true, value: null });
  });
});

describe("cellValueChanged", () => {
  it("treats a missing value as empty", () => {
    expect(cellValueChanged(undefined, null)).toBe(false);
    expect(cellValueChanged(undefined, "x")).toBe(true);
    expect(cellValueChanged("x", null)).toBe(true);
  });

  it("compares by value and type", () => {
    expect(cellValueChanged(5, 5)).toBe(false);
    expect(cellValueChanged("5", 5)).toBe(true);
    expect(cellValueChanged("a", "a")).toBe(false);
  });
});
