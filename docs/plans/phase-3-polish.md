# Phase 3 — Visual 1:1 polish and README

Goal: the app looks and feels like Airtable's current web app on every page,
the page layout is a real flex layout, no flash after a search change, a clean
lint and format, and a README that sells the project.

The grid's behaviour (Phase 2) stays as it is. This phase restyles it and
rebuilds the chrome around it.

## Where Phase 2 left off
- The chrome is the original trial UI: an orange base header with pill tabs, a
  dark-orange table tabs bar, and shadcn defaults everywhere else. The views
  sidebar's "Create" list is a long block of hand-drawn SVG icons.
- The page isn't a bounded flex column. `BaseNavbar` wraps everything in a
  sticky div, `TableNavbar2` sets its own `h-screen`, and the grid gets its
  height from `FillViewportHeight`, which measures the window in JS.
- After a search change, the footer shows the old total and the grid shows
  shimmer rows for about one round trip. `useRowPages` keeps the previous count
  through `keepPreviousData` and builds a new, empty page store straight away.
- 20 lint warnings (unused imports, `<img>`), and 46 files fail
  `prettier --check`.
- Home uses the shadcn `Sidebar` (plus `sheet`, `use-mobile`), and the sign-in
  page is a logo and a link to NextAuth's default sign-in page.
- The README is the create-t3-app template.

## Visual target

The reference is Airtable's web app as of 2025: a white base header with a
narrow left rail, a table tabs bar tinted in the base colour, and the view
toolbar's tools on the right. The older look, with the whole header in the base
colour, is not the target. No agent can open real Airtable, so this section is
the spec, and the orchestrator reviews screenshots against it.

Screens are designed for desktop widths (1280 px and up) and must still work at
1024 px. Mobile is out of scope.

### Tokens
These go in `globals.css` as Tailwind theme colours (`--color-at-*`), so
classes read like `text-at-text` and `border-at-border`.

| Token | Value | Use |
|---|---|---|
| `at-text` | `#1d1f25` | Body text, active labels |
| `at-text-muted` | `#616670` | Toolbar labels, icons, secondary text |
| `at-text-subtle` | `#989aa1` | Placeholders, row numbers |
| `at-border` | `#e1e3e6` | Chrome borders (header, sidebars, toolbar) |
| `at-grid-line` | `#dfe2e4` | Grid lines (as in Phase 2) |
| `at-hover` | `#f2f4f8` | Hover background for buttons and menu items |
| `at-selected` | `#e8ecf3` | Selected item in a list (active view) |
| `at-blue` | `#166ee1` | Active cell, focus rings, links |
| `at-primary` | `#1b61c9` | Primary buttons ("Create", "Save") |
| `at-hidden-tint` | `#c4ecff` | "Hide fields" button when fields are hidden |
| `at-filter-tint` | `#cff5d1` | "Filter" button when filtered; filtered column `#ebfbec` |
| `at-sort-tint` | `#ffe0cc` | "Sort" button when sorted; sorted column `#fff3e9` |

- **Font:** the system stack Airtable uses
  (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
  Arial, sans-serif`), 13 px base. Geist goes.
- **Radius:** 6 px for buttons, inputs and menus; 3 px for table tabs.
- **Menu and popover surface:** white, 6 px radius,
  `box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.12)`, no border.
  Items are 32 px tall, 13 px text, 16 px `at-text-muted` icons, `at-hover` on
  hover.
- **Buttons:** 28 px tall in toolbars, 13 px text, 16 px icon, 8 px horizontal
  padding, no border, `at-hover` on hover.
- The shadcn primitives in `src/components/ui/` are restyled once with these
  tokens (3.1), so every feature popover and menu matches without per-feature
  CSS.

### Base colours
Bases get a colour, as in Airtable. It is stored on `Base.color` (a new column,
default `blue`) and picked at random from the palette when a base is created.

| Name | Icon / Share button | Table tabs bar tint |
|---|---|---|
| blue | `#166ee1` | `#e9f1fd` |
| cyan | `#0d7f9e` | `#e3f4f9` |
| teal | `#0b8a7a` | `#e1f4f1` |
| green | `#048a0e` | `#e6f5e7` |
| yellow | `#b87503` | `#fdf3dc` |
| orange | `#d54402` | `#fdeee6` |
| red | `#dc043b` | `#fde8ed` |
| pink | `#b2158b` | `#f9e7f4` |
| purple | `#6b1cb0` | `#f1e8fa` |
| gray | `#616670` | `#eff0f2` |

`BaseIcon` (shared): a rounded square (radius 6 px at 32 px, 10 px at 56 px)
filled with the base colour, holding the name's first two letters in white
(`"Ba"` style: first letter upper case, second as typed). It is used in the base
header, the home cards and the create-base dialog.

### Base page layout

```
┌──────┬───────────────────────────────────────────────────────────────────┐
│      │ [Ba] Base name ▾        Data  Automations  Interfaces  Forms   ⟲ [Share] │ 56 px, white
│ rail ├───────────────────────────────────────────────────────────────────┤
│ 56px │ Table 1 ▾ │ Table 2 │ ▾ │ + Add or import          Extensions  Tools ▾ │ 32 px, base tint
│      ├───────────────────────────────────────────────────────────────────┤
│ logo │ ☰ │ ⊞ Grid view ▾    Hide fields Filter Group Sort Color ≡ Share and sync ⚡ 🔍 │ 48 px, white
│      ├────────────┬──────────────────────────────────────────────────────┤
│      │ views      │ grid (fills the rest; the grid's own footer at the   │
│  ?   │ sidebar    │ bottom)                                              │
│  🔔  │ 280 px     │                                                      │
│ (A)  │            │                                                      │
└──────┴────────────┴──────────────────────────────────────────────────────┘
```

The page is a `h-screen` flex layout from the base layout down:
- Base layout: `flex h-screen overflow-hidden` with the rail, then a
  `flex min-w-0 flex-1 flex-col` column holding the header, the table tabs
  bar and `{children}` in a `flex min-h-0 flex-1 flex-col`.
- `GridWorkspace`: the toolbar (`flex-none`), then a `flex min-h-0 flex-1` row
  with the views sidebar and a `relative min-w-0 flex-1` box that the grid fills
  with `h-full`. `FillViewportHeight` is deleted.
- Only the grid scrolls (and the views list, inside the sidebar). The page
  never scrolls.

**Left rail** (56 px, white, right border `at-border`):
- Top: the Airtable mark (24 px, the coloured logo glyph cropped from
  `airtable_logo.svg`), linking home, with the tooltip "Back to home".
- Bottom: Help (`CircleHelp`, a tooltip with the keyboard shortcuts), a
  notifications bell (decorative), and the avatar with the account menu (name,
  email, Log out).

**Base header** (56 px, white, bottom border):
- Left: `BaseIcon` (32 px), the base name (17 px, weight 600) and a chevron. The
  name and chevron open a popover:
  - a rename input (saves on Enter or blur);
  - the 10 colour swatches (the current one ringed);
  - "Delete base", with a confirm step.
- Centre: the tabs Data, Automations, Interfaces, Forms. 13 px, `at-text-muted`;
  the active tab (Data) is `at-text`, weight 500, with a 2 px underline in the
  base colour. The other three are decorative.
- Right:
  - a history icon button (decorative);
  - "Share": 28 px, filled in the base colour, white text, the `Users` icon.

**Table tabs bar** (32 px, the base tint):
- Each table is a tab, 13 px. The active tab is white, weight 500, with 3 px top
  corners and a chevron. Inactive tabs have `at-text` text and a 1 px separator
  between them, with `rgba(0,0,0,.05)` on hover.
- The active tab's chevron menu: Rename table (inline rename in the tab) and
  Delete table (with a confirm step; disabled for the last table).
- Tabs that don't fit scroll horizontally, with the scrollbar hidden. A "▾"
  button lists all tables, with a search box.
- "+ Add or import" opens a popover with a name field and "Create table". It
  creates the table and navigates to it.
- Right: "Extensions" and "Tools ▾" (decorative).

**View toolbar** (48 px, white, bottom border):
- Left:
  - "☰" toggles the views sidebar (tooltip "Hide/Show sidebar"). The open state
    is remembered per browser in `localStorage`.
  - A separator.
  - The view: a blue grid icon, the view name (weight 500) and a chevron. The
    chevron menu has Rename view and Delete view (disabled for the last view).
- Right, in this order:
  - Hide fields;
  - Filter;
  - Group (decorative);
  - Sort;
  - Color (decorative);
  - a row-height icon (decorative);
  - Share and sync (decorative);
  - "⚡ 100k rows" (the brief's add-100k button, tooltip "Add 100,000 fake
    records", "Adding…" with a spinner while it runs);
  - search (a magnifier icon).
- Active states, as in Airtable:

  | Button | Active label | Background |
  |---|---|---|
  | Hide fields | "1 hidden field" / "N hidden fields" | `at-hidden-tint` |
  | Filter | "Filtered by Name" / "Filtered by N fields" | `at-filter-tint` |
  | Sort | "Sorted by 1 field" | `at-sort-tint` |

- Search: the magnifier opens a panel under the toolbar's right edge. It holds a
  "Find in view" input (autofocused), a clear ×, and a line under it with the
  match count ("12 records" / "No records"). The icon is tinted while a search
  is active. Esc closes the panel and keeps the search.
- The filter, sort and hide-fields popovers keep their behaviour and are
  restyled: 13 px, Airtable's wording ("In this view, show records where",
  "Sort by", "Find a field"), with `at-primary` text links for "+ Add condition"
  and "+ Add another sort".
- The fetch progress bar stays at the toolbar's bottom edge.
- **Decorative controls** look real but do nothing on click. They show the
  tooltip "Not available in this demo" through the shared `NotInDemo` wrapper
  (3.1). The same goes for the decorative controls in every other bar.

**Views sidebar** (280 px, white, right border; hidden when toggled off):
- Top: "+ Create new…" (full width, 32 px, left-aligned) opens a popover of
  view types with their Airtable colours: Grid (blue), Form (pink), Calendar
  (orange), Gallery (purple), Kanban (green), Timeline (red), List (blue), Gantt
  (teal), then "New section". Only Grid works. It opens a small dialog with the
  name pre-filled ("Grid 2", the next free number) and "Create new view". The
  others are wrapped in `NotInDemo`. Icons are lucide (`Sheet`, `ClipboardList`,
  `CalendarDays`, `LayoutGrid`, `SquareKanban`, `ChartNoAxesGantt`, `List`,
  `ChartGantt`), not hand-drawn SVGs.
- Below it: "Find a view" (a search icon plus input), which filters the list as
  you type, with "No views match" when nothing does.
- The list: 32 px rows with the blue grid icon and the name (13 px). The active
  view uses `at-selected` and weight 500. Hovered rows show a "…" button with
  Rename view (inline) and Delete view (disabled for the last view).
  Double-clicking a row renames it inline, and the right-click menu offers the
  same actions.

**Grid** (dimensions unchanged from Phase 2):
- Header: `#f4f4f4` background, 13 px `at-text` names at weight 400, and 14 px
  `at-text-muted` type icons. A chevron appears at the right on hover and opens
  the field menu (as now).
- Sorted and filtered columns: every cell in the column is tinted
  (`#fff3e9` sorted, `#ebfbec` filtered, sorted wins), as in Airtable. The
  header keeps a slightly stronger tint.
- The whole row gets `#f8f8f8` on hover. The active cell keeps the 2 px
  `at-blue` outline, and the active row's number cell is `at-text` instead of
  `at-text-subtle`.
- Row numbers: 12 px, `at-text-subtle`, left-aligned with 16 px padding.
- Number fields are right-aligned (in the cell and the editor).
- The primary field has a `#c8ccd1` right border, plus the existing shadow while
  scrolled horizontally.
- Footer: 34 px, white, top border. On the left, "+ Add record" as a ghost
  button. On the right, the count in 12 px `at-text-muted`.
- The field menu and the add-field popover use the shared menu surface. The
  add-field popover gets Airtable's layout: "Field name", a type list with icons
  ("Single line text", "Number"), and "Cancel" / "Create field".
- Empty states use 13 px text and an `at-primary` button.

### Home page

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ☰ [airtable]            [🔍 Search…          ⌘K]              ? Help  🔔 (A) │ 56 px
├──────────────┬────────────────────────────────────────────────────────────┤
│ ⌂ Home       │ Home                                                        │
│ ☆ Starred    │                                                             │
│ ⇄ Shared     │ Opened anytime ▾                                  ☰  ⊞       │
│ ⊟ Workspaces │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│              │ │ [Ba] Name   │ │ [Pr] Name   │ │ [Ma] Name   │              │
│              │ │      Base   │ │      Base   │ │      Base   │              │
│              │ └─────────────┘ └─────────────┘ └─────────────┘              │
│ Templates…   │                                                             │
│ Marketplace  │                                                             │
│ Import       │                                                             │
│ [ + Create ] │                                                             │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- **Top bar** (56 px, white, bottom border, a light shadow):
  - "☰" collapses the sidebar to a 48 px icon strip.
  - The Airtable wordmark (102 px).
  - A centred search (340 px, rounded-full, `at-hover` fill, "Search…" with a
    ⌘K hint). It filters the base cards by name as you type, and ⌘K / Ctrl+K
    focuses it.
  - On the right: Help, a bell (decorative) and the avatar menu.
- **Sidebar** (300 px, white, right border):
  - The items Home (active, `at-selected`), Starred, Shared and Workspaces.
    Only Home works; the rest are `NotInDemo`.
  - At the bottom: Templates and apps, Marketplace, Import (decorative), then a
    full-width "+ Create" button in `at-primary`.
  - "+ Create" opens the create-base dialog: a name field, the colour swatches
    with a live `BaseIcon` preview, and "Create base". It creates the base and
    navigates to it.
- **Main** (`#f9fafb` background, 48 px side padding):
  - "Home" at 27 px, weight 600.
  - "Opened anytime ▾" (decorative) and list / grid toggles. The list view is
    real: one 48 px row per base.
  - **Base card:**
    - 92 px tall, white, 1 px `at-border`, 6 px radius;
    - a shadow on hover;
    - a 56 px `BaseIcon`, the name (13 px, weight 600) and "Base" (11 px,
      `at-text-muted`).
    - On hover, a "…" menu with Rename (inline), Change colour (swatches) and
      Delete (with a confirm step).
    - The cards sit in a `repeat(auto-fill, minmax(286px, 1fr))` grid with a
      16 px gap.
  - **Empty state:** "You don't have any bases yet" and a "+ Create a base"
    button.
  - **No search matches:** "No bases match "…"".

### Sign-in page
- A two-column layout:
  - Left (max 500 px, vertically centred, 48 px padding):
    - the Airtable mark (40 px);
    - "Sign in to Airtable" (32 px, weight 600);
    - "Continue with Google": full width, 40 px, white, 1 px `at-border`,
      6 px radius, the Google "G" as an inline SVG.
    - It calls NextAuth's `signIn("google")` from a server action, so there is
      no detour through NextAuth's default sign-in page.
  - Right (hidden below 1024 px): a panel in a soft blue gradient showing three
    facts about the demo: "1,000,000 rows that scroll without lag", "Search,
    filter and sort run in Postgres", "Keyboard editing like a spreadsheet".
- Footer line, 12 px, `at-text-muted`: "A portfolio clone of Airtable built
  with the T3 stack. Not affiliated with Airtable." It includes a link to the
  GitHub repo.

### No flash after a search change: swap when ready
`useRowPages` double-buffers its page store:
- A key change (`viewId`, `search`, `configKey`) or a `reset()` builds a
  **pending** store next to the **shown** one.
- The pending store is primed:
  - after a key change, with the first screen of rows (the shown store's last
    range length, starting at row 0);
  - after `reset()`, with the shown store's last range, because the scroll
    position is kept.
- Its total comes only from a count query for the new key that is **not**
  placeholder data.
- It becomes the shown store once its count has arrived and every page in its
  primed range (clamped to the new total) has loaded, or once one of those
  fetches fails. The old store is then disposed.
- While a store is pending, the grid keeps rendering the shown store's rows and
  count, `isFetching` is true (so the progress bar runs), and `patchRow` patches
  both stores.
- `useRowPages` returns a `resultKey` that changes at the swap. `Grid` uses it
  instead of `search` / `scrollResetKey` to scroll to the top and to clear the
  selection, so the reset happens in the same frame as the new rows.
- Unit tests:
  - the swap waits for both the count and the pages;
  - a placeholder count never reaches the pending store;
  - a key change while another store is pending replaces that pending store;
  - a failed fetch still swaps;
  - `patchRow` reaches both stores;
  - `reset()` primes the old range.

### README
- What it is, in two sentences, with the live link and a "Sign in with Google"
  note.
- A GIF of about 10 s: scroll the 1M-row table, drag the scrollbar to the
  bottom, edit a cell with the keyboard, type a search. Recorded with
  Playwright's video capture and converted with `ffmpeg` (installed in the
  container), under 5 MB, in `docs/images/`.
- Screenshots: home, the base page, filter and sort popovers open, and
  sign-in. PNGs at 1440×900, optimised.
- **Requirements table:** each item of the brief and where it lives
  (file / feature).
- **Architecture:** Mermaid diagrams (GitHub renders them):
  1. Request flow: grid → `useRowPages` → `RowPageStore` → tRPC `row.getRows`
     → `queryRows` → Postgres.
  2. The page cache: a keyset chain from cached neighbours, one offset fetch
     after a jump, backward keyset, and the swap.
  3. Scaled scrolling: an 8M px spacer mapped linearly to `total × 32 px`.

  Each diagram has a short paragraph on JSONB rows, sort expression indexes,
  and why offset is only used after a jump.
- The benchmark table (copied from `docs/benchmarks.md`, with a link).
- **Running locally:** env vars, Postgres, `prisma migrate deploy`,
  `npm run dev`, `npm test` (with `TEST_DATABASE_URL`), and `npm run bench`.
- Tech stack and project layout. Phases 1–3 as a short "how it was built"
  section that links the plan docs.

## Tasks

Each task is one commit (a task can be a few commits if the agent commits as it
goes). A task is done when `npx tsc --noEmit`, `npm run lint` (no warnings in
the task's files), `npm run format:check` (from 3.0 on) and `npm test` pass, and
its listed checks pass. UI tasks also hand in Playwright screenshots at
1440×900 and 1024×768 of every state they changed. They are saved to
`/tmp/claude-pgbench/shots-3.N/`, and the orchestrator reviews them against the
spec above.

| # | Task | Depends on |
|---|---|---|
| 3.0 | **Prep** (orchestrator). Run `prettier --write` on the whole repo in one commit, so later diffs are clean. Make `next.config.js` take `distDir` from `NEXT_DIST_DIR` (default `.next`) and ignore `/.next-*/`, so parallel agents can each run a dev server. | — |
| 3.1 | **Tokens, primitives and base colour.** <br>• The token table and font in `globals.css`; drop Geist; set the root metadata title to "Airtable clone". <br>• Restyle the shadcn primitives in `src/components/ui/` (button, input, popover, dropdown-menu, context-menu, dialog, select, switch, tooltip) to the tokens. <br>• Add `src/lib/baseColors.ts` (the palette and a `BaseColor` type), the `BaseIcon`, `AirtableMark` and `NotInDemo` components in `src/components/at/`, and `ColorSwatches` (the swatch row used by the header and home). <br>• Server: a migration adding `Base.color` (text, default `'blue'`). `base.create` takes an optional `color` (random when omitted). A new `base.setColor` mutation, ownership checked. `base.list` returns `color`. Tests for all three. | 3.0 |
| 3.2 | **Swap when ready.** The double-buffered `useRowPages` and `resultKey`, as designed above, with the unit tests listed there. `Grid.tsx` only switches its scroll and selection resets to `resultKey`. Check: Playwright on the 1M-row table types a search and clears it, sampling every animation frame; no frame shows shimmer rows or a total from the previous key once the new rows are shown. | 3.0 |
| 3.3 | **Page layout and component split.** <br>• Build the flex layout above and delete `FillViewportHeight`. <br>• Move the chrome into new files with `git mv`, keeping behaviour and roughly today's look: `_components/base/BaseRail.tsx` (new), `BaseHeader.tsx` (from `BaseNavbar`), `TableTabs.tsx` (from `TableNavbar` + `TableDropdown` + `CreateTable`); `_components/toolbar/ViewToolbar.tsx` (from `TableNavbar2`); `_components/views/ViewsSidebar.tsx` (from `TableSidebar`). <br>• `GridWorkspace` owns the sidebar open state and passes it to the toolbar and the sidebar. The base layout passes `color` down. <br>Check: resizing the window resizes the grid, with no JS height and no page scrollbar. The 1M-row drag to the bottom still works. | 3.1 |
| 3.4 | **Home page.** The top bar, sidebar, main area, base cards (grid and list), create-base dialog, card menu, search with ⌘K, and the empty and no-match states, as specified. Move the files to `_components/home/`. Replace the shadcn `Sidebar` with a plain component. | 3.1 |
| 3.5 | **Sign-in page.** As specified, with a server action calling `signIn("google")`. Move it to `_components/auth/SignInPage.tsx`. | 3.1 |
| 3.6 | **Base rail and header.** `BaseRail.tsx` and `BaseHeader.tsx` as specified: the rename / colour / delete popover, the tabs, Share, and the account menu in the rail. The header and the tabs bar update straight away after a rename or colour change (`router.refresh()` on success, since the layout is a server component). | 3.3 |
| 3.7 | **Table tabs bar.** `TableTabs.tsx` (and helpers in `_components/base/`) as specified: tint, active tab, chevron menu with inline rename and confirm-delete, overflow scroll with the all-tables list, and "+ Add or import". | 3.3 |
| 3.8 | **Views sidebar.** `ViewsSidebar.tsx` as specified: "+ Create new…" with the view types and the create dialog, the working "Find a view", the list with hover menu, inline rename and the context menu. | 3.3 |
| 3.9 | **View toolbar.** `ViewToolbar.tsx`, `FilterPopover`, `SortPopover`, `HideFieldsPopover` and `FetchProgressBar` (moved into `_components/toolbar/`) as specified: the order, the active-state labels and tints, the search panel with match count, the 100k button, and the view chevron menu. | 3.3 |
| 3.10 | **Grid styling.** As specified, in `_components/grid/` only: header, column tints (`GridColumn` already carries `sortDirection` and `filtered`), row hover, active row number, right-aligned numbers, primary border, footer, field menu and add-field popover. Check: the 1M-row Playwright drag and keyboard-editing scripts still pass. | 3.2 |
| 3.11 | **Cleanup.** <br>• Delete what is now unused: `_components/ui/` leftovers (`Navbar`, `ColorPicker`, `UserDropdown` if replaced), `components/ui/sidebar.tsx`, `sheet.tsx`, `hooks/use-mobile.ts`, `context/SessionContext.tsx`, and any orphaned asset. <br>• `npm run lint` reports **0 warnings** repo-wide, and `format:check` is clean. <br>• Check with `npx knip`, or a grep of imports, that nothing exported is unused. | 3.4–3.10 |
| 3.12 | **README.** As specified: record the GIF and screenshots (from the dev DB and the 1M-row bench DB), write the README, and add `docs/images/`. The orchestrator writes or reviews the architecture section. | 3.11 |
| 3.13 | **Review and verification** (orchestrator): <br>• review the full diff; <br>• take a screenshot of every page and popover and compare it with the spec; <br>• run the 1M-row e2e (scrollbar jumps, keyboard editing, filter, sort, search, hide fields); <br>• check a migration dry run against a copy of the dev DB; <br>• then open the PR. | all |

## Execution
- **Waves** (tasks in a wave run in parallel):
  1. 3.1 and 3.2.
  2. 3.3, 3.4 and 3.5.
  3. 3.6, 3.7, 3.8, 3.9 and 3.10.
  4. 3.11, then 3.12, then 3.13.
- **Agents:** Sonnet subagents, one per task, run in the background in this
  checkout. Each prompt lists the files the agent owns and the files it must not
  touch. Shared primitives are fixed after 3.1: a wave-3 agent that needs a
  primitive changed reports it instead of editing `src/components/ui/`.
- **Commits:** agents commit as they go, with `git add <own paths>` only (never
  `-A`). If `index.lock` is taken, wait and retry. Errors from `tsc` or lint in
  files the agent doesn't own get reported, not fixed.
- **Per agent:**
  - its own dev server: `NEXT_DIST_DIR=.next-3N npx next dev -p 31N`
    (port 3101 for 3.1, …, 3113);
  - its own test DB (`airtable_t1`…`airtable_t5`, migrated with
    `prisma migrate deploy` first);
  - its own screenshot directory.
- **Data:** UI screenshots use the dev DB `airtable` (session token
  `tok-walk-17`). Agents may create bases and tables there but must not delete
  ones they didn't create. Scroll checks use the bench DB (`benchtok`), read-only
  apart from the cell edits the e2e reverts.
- **Review:** after each task, the orchestrator reads the diff and the
  screenshots and sends fixes back to the same agent (`SendMessage`) before the
  next wave starts.

## Out of scope for Phase 3
- Guest login, demo abuse limits, the pre-seeded 1M-row showcase table and the
  Firefox check (Phase 4).
- Working Group, Color, row height, Share, other view types, starring, and
  workspaces: they are decorative, with the "Not available in this demo"
  tooltip.
- Mobile layouts and a dark theme.
