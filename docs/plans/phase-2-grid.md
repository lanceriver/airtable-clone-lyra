# Phase 2 — Grid rewrite and remaining requirements

Goal: a spreadsheet-grade grid that meets every requirement in the brief.
- A scrollbar that represents all 1M rows, and you can drag anywhere in it.
- Arrow keys, Tab and Enter move across cells smoothly.
- Editing that feels instant.
- Column tools: add, rename, delete, resize, sort, filter, hide, and a searchable hide/show list.
- Loading states everywhere.

Visual polish to match Airtable 1:1 is Phase 3. This phase still uses
Airtable's dimensions (below), so Phase 3 restyles the grid rather than
rebuilding it.

## Where Phase 1 left off
- The grid is a `<table>` with an `<input>` in every visible cell (about 50
  rows × N columns of controlled inputs). Arrow keys do nothing.
- Rows load through `useInfiniteQuery`, so the scrollbar only covers loaded
  rows. In testing it took 15 s of fast scrolling to reach row 6,000 of 1M.
- The "add row" control sits after the last loaded row, so it's unreachable on
  big tables.

## Design

### Row loading: sparse pages, keyset where possible, offset for jumps
- The virtualizer's `count` is the view's total matching rows
  (`row.countRows`), so the scrollbar is full-size from the start. Rows that
  haven't loaded yet render as skeleton rows.
- Rows are fetched in fixed pages of 100. Page *k* is fetched:
  - **by keyset** from the last row of page *k−1* when that page is cached
    (normal scrolling: about 2 ms in the database), or
  - **by offset** when it isn't (a scrollbar drag or a Ctrl+↓ jump). This
    measured about 50–300 ms at 1M rows with a warm cache, and only happens
    for the first page after a jump.
- Jumps are debounced while the scrollbar is being dragged, so a drag fetches
  where you stop, not everything in between.
- The page cache lives in TanStack Query through tRPC
  (`api.row.getRows` with `useQueries` / `utils.row.getRows.fetch`). One cache
  entry per page, keyed by `(viewId, search, pageIndex)`.
- Editing a cell patches the cached page in place. A filter, sort or search
  change resets the cache. Adding or deleting rows invalidates the count and
  the pages after the change.
- This keeps the brief's stack (tRPC hooks plus the TanStack virtualizer)
  without the "scrollbar only covers what you've loaded" problem. Airtable
  itself shows a full-size scrollbar.

### Measured after 2.1 (1M rows)
| Jump | Median |
|---|---:|
| Unsorted, offset 500k / 990k | 36 / 71 ms (index-only two-step) |
| Filtered, offset 250k | 328 ms |
| Sorted (indexed), offset 500k | 1.43 s (expression indexes can't do index-only scans) |

Consequences for the page cache (2.2):
- A jump issues **one** offset request; neighbours then chain by keyset from it.
- **Backward keyset**: each page also returns a `prevCursor` (its first row), and
  `getRows` accepts `direction: "backward"` so the page *before* a cached page is
  fetched by reverse keyset (fast) instead of by offset. Scrolling up after a jump
  never pays the offset cost again.
- A page whose neighbour is in flight waits for it rather than firing an offset.

### Very tall tables: scaled scrolling
1M rows × 32 px is 32M px, which is past Firefox's maximum element height
(about 17.9M px) and at Chrome's limit (about 33.5M px). When
`total × rowHeight` exceeds 8M px:
- the scroll container's spacer is capped at 8M px;
- a custom `observeElementOffset` and `scrollToFn` passed to TanStack Virtual
  map the real `scrollTop` to a virtual offset linearly;
- rows are positioned relative to the viewport, so they always render
  pixel-exact.

Below the threshold, scrolling is ordinary 1:1.

### Grid structure
- Div-based CSS grid instead of `<table>`, which is also how Airtable is built.
- TanStack Table owns the column model: order, visibility, sizing and
  resizing. TanStack Virtual owns the rows, and the columns too once there are
  more than about 20 (horizontal virtualization).
- Sticky header row, a sticky row-number column, and the primary (first)
  field sticky as well, as in Airtable.
- Cells render **plain text**. Only the cell being edited mounts an `<input>`,
  which removes hundreds of controlled inputs.
- Airtable dimensions: row height 32 px, header 32 px, 13 px text,
  1 px `#dfe2e4` grid lines, a 66 px row-number column, a 180 px default field
  width (min 100), and a 2 px blue `#166ee1` outline on the active cell.

### Selection and keyboard
State lives in a pure reducer (`gridReducer`), unit-tested without a browser:
`activeCell { rowIndex, columnIndex } | null` and `editing: boolean`.

| Key | Not editing | Editing |
|---|---|---|
| ← → ↑ ↓ | Move one cell (clamped) | Move the caret in the input (← →); ↑ ↓ commit and move |
| Tab / Shift+Tab | Next / previous cell, wrapping to the next / previous row | Commit, then move |
| Enter | Start editing | Commit, move down |
| Esc | Clear selection | Cancel the edit, keep the selection |
| Printable character | Start editing, replacing the value with that character | — |
| Delete / Backspace | Clear the cell | — |
| Ctrl/⌘ + ↑ ↓ | First / last row (a jump) | — |
| Ctrl/⌘ + ← → | First / last field | — |
| Home / End | First / last field | — |

- The active cell is always scrolled into view (`scrollToIndex` for rows,
  `scrollLeft` for columns).
- A click selects, a double-click edits, and clicking outside the grid
  commits any edit.
- Navigation onto an unloaded row works. The cell shows a skeleton until its
  page arrives, and editing waits for it.

### Editing
- Optimistic: the cached page is patched immediately, then `row.updateCell`
  runs. If it fails, the change is rolled back and a toast shows the server's
  message.
- Number fields reject non-numeric input as you type (red outline, with
  "Enter a number" next to the cell). The server stays the source of truth.

### Column tools
- **Field header menu**, as in Airtable:
  - Edit field (rename)
  - Sort A → Z / Z → A, or 1 → 9 / 9 → 1 for numbers
  - Filter by this field (opens the filter popover with a new filter on that
    field)
  - Hide field
  - Delete field, with a confirm step
- **Add field:** a "+" header button opens a popover with a name and a type
  picker (Single line text, Number) that only allows valid names.
- **Resize** by dragging the header edge. Widths are saved per view in a new
  `columnWidths` key of the view config.
- **Hide fields popover:**
  - a search box that filters the field list ("Find a field");
  - a switch per field;
  - "Hide all" and "Show all" buttons.
  - This covers "can search through and hide/show columns".

### Loading and empty states
- First load: a grid skeleton with a header and 20 shimmer rows.
- Rows that haven't loaded show shimmer cells.
- A thin progress bar under the toolbar while any page or count is fetching.
- "Adding 100k rows…" shows a progress toast. The rows appear when it finishes.
- **No matches:** "No records match this view" with a "Clear filters / search"
  button.
- **Empty table:** an "Add a record" button.
- A sticky footer bar is always visible:
  - "+ Add record" on the left;
  - "N records" or "N of M records" on the right.
  - This makes adding a row reachable on any table size.

## Tasks

Each task is one commit. A task is done when `npx tsc --noEmit`, `npm run lint`
and `npm test` pass and its listed checks pass.

| # | Task | Depends on |
|---|---|---|
| 2.1 | **Offset pages and a unique order index.** Add a migration with a unique index on `(tableId, order)`, replacing the plain index. Unsorted queries then order by `"order"` alone, which makes them index-only (measured 49 ms at offset 500k versus 295 ms). Add `offset` to `queryRows` (exclusive with `cursor`) and to `row.getRows`. Tests: offset pages equal keyset pages for unsorted, sorted asc/desc, filtered and searched views. Extend `npm run bench` with offset 500k and 990k. | — |
| 2.2 | **Page cache hook** `useRowPages({ viewId, search, total })`. A pure planner function decides, from the visible range plus the cache, which pages to fetch and how (keyset vs offset). Includes debounced jumps, `patchRow`, `reset`, and a guard so an older `view.updateConfig` response can't overwrite a newer one. Unit tests for the planner and patch logic. | 2.1 |
| 2.3 | **Grid shell.** A new `src/app/_components/grid/` built on divs, TanStack Table, row virtualization and scaled scrolling. Sticky header, row-number column and primary field. Skeleton rows. Read-only text cells. Uses `useRowPages`. Check: a Playwright script drags the scrollbar to the middle and the bottom of the 1M-row table, and the rows there render within 1 s. | 2.2 |
| 2.4 | **Selection and keyboard.** `gridReducer` plus its keyboard bindings exactly as in the table above, with scroll-into-view. Unit tests cover the reducer: every key, wrapping, clamping and edit-mode transitions. | 2.3 |
| 2.5 | **Editing.** An editor overlay for the active cell, optimistic updates with rollback, inline number validation, and type-to-edit. Check: Playwright edits text and number cells only with the keyboard, reloads, and the values persist. | 2.4 |
| 2.6 | **Rows.** Sticky footer with "+ Add record" (appends the row, scrolls to it, starts editing the first field) and the record count. Right-click a row for "Delete record". Empty-table and no-matches states. | 2.5 |
| 2.7 | **Column tools.** Field header menu (rename, sort, filter by field, hide, delete with confirm) and the add-field popover. Column resize with `columnWidths` saved in the view config (server: schema validation plus a `view.updateConfig` key, with tests). | 2.3 |
| 2.8 | **Hide fields search and loading polish.** Searchable hide-fields popover with Hide all / Show all, the fetch progress bar, the first-load skeleton, and the progress toast for adding 100k rows. | 2.6, 2.7 |
| 2.9 | **Swap and clean up.** Point `TableWorkspace` at the new grid and delete the old `Table.tsx`, along with anything else left unused. | 2.8 |
| 2.10 | **Review and verification** (orchestrator): diff review, then a Playwright run on the 1M-row table covering scrollbar jumps, keyboard-only editing, all column tools, filter, sort and search. Then open the PR. | all |

2.7 can run in parallel with 2.4–2.6, since it works in different files.

## Out of scope for Phase 2
Visual 1:1 polish of the base header and sidebars (Phase 3), multi-cell
selection and copy/paste, multiple sorts, OR filters, column reordering by
drag, guest login and deployment (Phase 4).
