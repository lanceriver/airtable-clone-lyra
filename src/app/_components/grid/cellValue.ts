import type { ColumnType, RowRecord } from "~/server/db/rows";

/** What a cell can hold: text, a number, or nothing (null / undefined). */
export type CellValue = string | number | null | undefined;

export const NUMBER_ERROR = "Enter a number";

export type ParsedDraft =
  | { ok: true; value: string | number | null }
  | { ok: false; error: typeof NUMBER_ERROR };

/** The text the editor starts with: the value as shown, "" when empty. */
export function formatCellValue(value: CellValue, _type: ColumnType): string {
  return value === undefined || value === null ? "" : String(value);
}

// Digits with at most one dot and an optional leading minus: "-", "1.", ".5".
const PARTIAL_NUMBER = /^-?\d*\.?\d*$/;
// A complete number: at least one digit.
const COMPLETE_NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/**
 * True while `draft` can still become a number by typing more: "", "-", "1.",
 * "-.5". No exponent, no plus sign. Surrounding spaces are ignored.
 */
export function isValidPartialNumber(draft: string): boolean {
  return PARTIAL_NUMBER.test(draft.trim());
}

/**
 * The value to save for what was typed. Text: "" clears the cell, anything
 * else is kept as typed. Number: trimmed, "" clears the cell, the rest must be
 * a finite number. (The server validates again.)
 */
export function parseDraft(draft: string, type: ColumnType): ParsedDraft {
  if (type !== "number") {
    return { ok: true, value: draft === "" ? null : draft };
  }
  const trimmed = draft.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!COMPLETE_NUMBER.test(trimmed)) return { ok: false, error: NUMBER_ERROR };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, error: NUMBER_ERROR };
  // Number("-0") is -0, which JSON turns into 0 anyway.
  return { ok: true, value: value === 0 ? 0 : value };
}

/** True when saving `next` would change the cell (null equals empty). */
export function cellValueChanged(
  current: CellValue,
  next: string | number | null,
): boolean {
  return (current ?? null) !== next;
}

/** A copy of `row` with one cell set, or removed when `value` is null. */
export function withCellValue(
  row: RowRecord,
  columnId: string,
  value: string | number | null | undefined,
): RowRecord {
  const data = { ...row.data };
  if (value === null || value === undefined) delete data[columnId];
  else data[columnId] = value;
  return { ...row, data };
}
