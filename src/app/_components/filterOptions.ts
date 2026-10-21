// Client-side mirror of the operator lists in src/server/db/rows.ts. That module
// pulls in Prisma, so the browser bundle can only import its types.
import type { ColumnType, FilterOperator } from "~/server/db/rows";

export const TEXT_OPERATORS: FilterOperator[] = [
  "contains",
  "notContains",
  "is",
  "isNot",
  "isEmpty",
  "isNotEmpty",
];

export const NUMBER_OPERATORS: FilterOperator[] = [
  "eq",
  "neq",
  "gt",
  "lt",
  "gte",
  "lte",
  "isEmpty",
  "isNotEmpty",
];

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "contains",
  notContains: "does not contain",
  is: "is",
  isNot: "is not",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  eq: "=",
  neq: "≠",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
};

export function operatorsFor(type: ColumnType): FilterOperator[] {
  return type === "number" ? NUMBER_OPERATORS : TEXT_OPERATORS;
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== "isEmpty" && operator !== "isNotEmpty";
}

export const SORT_LABELS: Record<ColumnType, Record<"asc" | "desc", string>> = {
  string: { asc: "A → Z", desc: "Z → A" },
  number: { asc: "1 → 9", desc: "9 → 1" },
};
