# Handoff — Airtable clone (Lyra take-home → portfolio demo)

Last updated: 2026-10-22, after Phases 1 and 2 shipped to production.

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
| 3 Visual 1:1 polish + README | ⏳ next (branch `phase-3-polish` exists, holds only this file) |
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
  restarts have killed agents twice.
- **One branch and PR per phase.** Ask the user before merging (they have
  approved merges each time so far). Commit trailers:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: …`.

## Phase 3 scope (to plan)
- 1:1 visual pass against real Airtable:
  - base header (colour, logo, Data/Automations/Interfaces/Forms tabs, Share);
  - table tabs bar;
  - views sidebar (search, create view types);
  - toolbar (Views, Grid view, Hide fields, Filter, Group, Sort, Color, Share
    and sync, search);
  - home page (bases grid, sidebar, create base);
  - sign-in page;
  - grid header styling.
- Replace `FillViewportHeight` (the grid height is set in JS because the page
  layout isn't a bounded flex column) with a real `h-screen` flex layout.
- Fix the brief stale total and shimmer flash after a search change
  (`useRowPages` keeps the previous count via `keepPreviousData`).
- Remove the 20 remaining lint warnings in `BaseNavbar`, `HomeSidebar`,
  `Navbar`, `SignInPage`, `layout` and `sidebar`. Prettier the old UI files.
- README for the portfolio:
  - what it is and a live link;
  - GIF/screenshots;
  - an architecture diagram covering JSONB rows, the keyset/offset page cache
    and scaled scrolling;
  - the benchmark table, how to run it locally, and the tests.

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
- **DBs:**
  - `airtable`: the dev DB. `.env` points here. User session token
    `tok-walk-17`.
  - `airtable_test`: the test DB.
  - `airtable_t1x`: spare per-agent test DBs.
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
  (435 tests). Run `prisma migrate deploy` on test DBs after schema changes.
- **Bench:** `npm run bench -- --reuse` writes `docs/benchmarks.md`.

## Gotchas
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
