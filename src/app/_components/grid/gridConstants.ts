/** Airtable's grid dimensions (docs/plans/phase-2-grid.md, "Grid structure"). */
export const ROW_HEIGHT = 32;
export const HEADER_HEIGHT = 32;
export const ROW_NUMBER_WIDTH = 66;
export const ADD_FIELD_WIDTH = 94;
export const DEFAULT_COLUMN_WIDTH = 180;
export const MIN_COLUMN_WIDTH = 100;
export const MAX_COLUMN_WIDTH = 800;
/** Longest field name the server accepts. */
export const FIELD_NAME_MAX_LENGTH = 100;

/** Spacer height above which scrolling is scaled (see scrollScale.ts). */
export const SCROLL_CAP = 8_000_000;

/** Rows beyond the visible ones that the virtualizer renders. */
export const ROW_OVERSCAN = 10;
/** Rows beyond the visible ones that are fetched (about one page). */
export const PREFETCH_ROWS = 100;
/** Shimmer rows shown while the first count loads. */
export const SKELETON_ROWS = 20;

export const GRID_LINE_COLOR = "#dfe2e4";

/** The rows layer is re-anchored every this many rows (see GridBody). */
export const ANCHOR_BLOCK = 50;
