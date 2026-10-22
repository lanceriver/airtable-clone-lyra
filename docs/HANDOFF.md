# Handoff — Airtable clone (Lyra take-home → portfolio demo)

Last updated: 2026-10-22, after Phase 3 was finished on branch `phase-3-polish`
(Phases 1 and 2 are in production).

## Goal
Turn the original 2-week Lyra trial (T3 Airtable clone) into a polished
portfolio demo that meets every requirement of the original brief (below)
with a nicer UI/UX.

**Brief (summary):** T3 stack, deployed on Vercel; TanStack Table; Postgres;
UI 1:1 with Airtable; Google login; create bases, then tables; add columns
dynamically (text, number); edit cells with arrow keys and Tab moving
smoothly; new tables get default rows and columns from faker; a 100k-row table
scrolls without lag; a button adds 100k rows; virtualized infinite scroll with
tRPC hooks and TanStack Virtual; search across all cells that acts as a
filter; saved views with filters (number: gt and lt; text: empty, not empty,
contains, not contains, equal to), simple sort, search and hide/show columns
with search; search, filter and sort done in the DB; loading states; 1M rows
still load without issue.

## Status
| Phase | State |
|---|---|
| 1 Data layer (JSONB rows, query builder, keyset pagination, sort indexes, ownership checks, fast 100k insert) | ✅ merged (#1) |
| Next.js 15.3.2 → 15.5.28 (Vercel refused to deploy the vulnerable version) | ✅ merged (#3) |
| 2 Grid (full-size scrollbar via paged loading, scaled scrolling, keyboard nav/editing, column tools, footer, empty/loading states) | ✅ merged (#2) |
| Production | ✅ live at https://airtable-clone-lyra.vercel.app, all migrations applied |
| 3 Visual 1:1 polish + README (tokens, base colours, home, sign-in, header/rail, table tabs, views sidebar, toolbar, grid styling, flex layout, swap-when-ready search, 0 lint warnings, README with GIF) | ✅ done on `phase-3-polish`, verified (1M e2e 14/14, 478 tests); PR next |
| 4 Portfolio extras | ⏳ later |

Read `docs/plans/phase-1-data-layer.md`, `docs/plans/phase-2-grid.md` and
`docs/benchmarks.md` for the design and measured numbers.

## How the user wants to work
- **Plan first for each phase.** Write `docs/plans/phase-N-*.md` with the
  design and a table of **atomic tasks** (one commit each, with dependencies),
  commit it, then execute.
- **Use Sonnet subagents for the tasks** (`Agent` tool, `model: "sonnet"`,
  run in the background). The orchestrator (you) owns the design, reviews each
  report and diff, runs the final verification, and opens the PR.
- Run tasks in parallel only with **strict file ownership** (list "you own /
  don't touch" files in each prompt). Give each agent its own test DB and its
  own dev-server port. Tell agents to commit as they go, since container
  restarts have killed agents twice. Five agents at once hit the account's
  usage limit once in Phase 3; after it resets, resume each one with
  `SendMessage` (its work and context are kept) instead of starting over.
- **One branch and PR per phase.** Ask the user before merging (they have
  approved merges each time so far). Commit trailers:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: …`.

## Phase 3 notes (for review and Phase 4)
- Design and task list: `docs/plans/phase-3-polish.md`. Commits are
  "Phase 3.N: …", one or more per task.
- New migration `20261023000000_base_color` (`Base.color text not null default
  'blue'`). It is applied to every local DB except `at` and `airtable_main`, and
  Vercel applies it on the next production deploy. A dry run on a copy of the
  dev DB applied cleanly with no drift.
- Swap when ready: `grid/rowPagesBuffer.ts` (plain class, unit-tested) behind
  `useRowPages`; `Grid` resets scroll and selection on `rowPages.resultKey`.
- Shared UI: `src/components/at/` (`BaseIcon`, `AirtableMark`, `NotInDemo`,
  `ColorSwatches`), `src/lib/baseColors.ts`, `_components/AccountMenu.tsx`,
  `_components/HelpButton.tsx`, `_components/views/useViewActions.ts`.
- Row hover is pure CSS (`group-hover/row`); a 210-step wheel scroll on the 1M
  table runs at 60 fps on a production build (one frame over 17 ms in about
  2,500).
- The old e2e script (`/tmp/claude-pgbench/review/e2e.cjs`) must wait for the
  hide-fields popover to close before dragging a resize handle: the popover now
  opens over the Email column's handle.
- Review screenshots: `/tmp/claude-pgbench/review/`; per-task shots in
  `/tmp/claude-pgbench/shots-3.N/` (may be gone after a restart).

## Phase 4 scope (later)
- Guest/demo login next to Google (user approved). Abuse limits for the public
  demo: a per-user row cap and a rate limit on the 100k button.
- A pre-seeded 1M-row showcase table.
- Firefox check of scaled scrolling (only Chromium is available in the
  container).

## Environment notes (cloud container)
- **Local Postgres 16:** socket `/tmp`, port 5433, user `postgres`, no
  password, data dir `/tmp/claude-pgbench/data`. It **stops on container
  restart**. Start it with:
  `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/claude-pgbench/data -l /tmp/claude-pgbench/log -o '-p 5433 -k /tmp' start"`
  (If `/tmp` was wiped, re-create it with `initdb` and `prisma migrate deploy`.)
- **DBs:** (spare per-agent test DBs are `airtable_t12` … `airtable_t19`)
  - `airtable`: the dev DB. `.env` points here. User session token
    `tok-walk-17`.
  - `airtable_test`: the test DB.
  - `airtable_bench`: has a **1M-row table** `bench-1000000`. Session token
    `benchtok`. URL `/cmviezbek00027dgvb63b4c0x/cmvif2zbg00027d501mk1klkz?viewId=cmvif2zbg00077d50xuedqm5i`.
  - `at`: the old pre-Phase-1 schema with 1M rows. Don't modify it.
- **Auth for Playwright:** insert or refresh a `Session` row and set cookie
  `authjs.session-token=<token>` on localhost. If the session expired, refresh
  it with `UPDATE "Session" SET expires = now() + interval '2 days'`.
- **Playwright:** the global install
  (`require(execSync('npm root -g').toString().trim() + '/playwright')`),
  with Chromium at `/opt/pw-browsers`. There's a reusable 1M-row e2e at
  `/tmp/claude-pgbench/shots-2.10/e2e.cjs`, which may be gone after a restart.
- **Tests:** `TEST_DATABASE_URL="postgresql://postgres@localhost:5433/airtable_test?host=/tmp" npm test`
  (478 tests). Run `prisma migrate deploy` on test DBs after schema changes.
- **Bench:** `npm run bench -- --reuse` writes `docs/benchmarks.md`.

## Gotchas
- `next dev` with a custom `NEXT_DIST_DIR` rewrites `tsconfig.json` (adds its
  types dir). Never commit that; `git checkout tsconfig.json` before reviewing.
- Several agents on one `next dev` server each trigger Fast Refresh for the
  others, which closes popovers mid-test. Use `next build` + `next start` for
  stable Playwright runs.
- `pkill -f "next start"` kills your own shell, because the pattern matches
  the bash command line. Use `pgrep -f "[n]ext-server"` and kill those PIDs.
- Two `next dev` servers sharing one `.next` crash with webpack errors. Give
  parallel agents separate ports, or a copy of the checkout.
- After switching branches with different schemas, run `npx prisma generate`,
  or tests fail with "column does not exist".
- **Vercel:**
  - `npm run vercel-build` (`scripts/vercel-build.mjs`) builds, then runs
    `prisma migrate deploy` **only when `VERCEL_ENV=production`**.
  - `DIRECT_URL` is optional, for pooled Neon URLs.
  - A deploy that fails at "Vulnerable version of Next.js detected" needs a
    Next patch upgrade.
- Sort indexes are created at runtime as partial expression indexes named
  `rs_<tableId>_<columnId>_<a|d>`. Prisma's drift check ignores them, which
  was verified.
