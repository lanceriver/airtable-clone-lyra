# Handoff — Airtable clone (Lyra take-home → portfolio demo)

Last updated: 2026-10-22, after Phase 3 shipped to production. Next: plan
Phase 4 on branch `phase-4-extras` (created from `main` at `c661c8f`).

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
| 3 Visual polish + README (Airtable tokens, base colours, home, sign-in, header/rail, table tabs, views sidebar, toolbar, grid styling, flex layout, swap-when-ready search, 0 lint warnings, README with GIF) | ✅ merged (#4, squash `c661c8f`) |
| Production | ✅ live at https://airtable-clone-lyra.vercel.app with Phase 3. The `base_color` migration ran on deploy. The new sign-in page was checked with no console errors, and the Google redirect works; the user checked the signed-in pages. |
| 4 Portfolio extras | ⏳ to plan (scope and open questions below) |

Design docs: `docs/plans/phase-1-data-layer.md`, `phase-2-grid.md`,
`phase-3-polish.md`; measured numbers in `docs/benchmarks.md`. The README
summarises the architecture (request flow, page cache, scaled scrolling).

## How the user wants to work
- **Plan first for each phase.** Write `docs/plans/phase-N-*.md` with the
  design and a table of **atomic tasks** (one commit each, with dependencies),
  commit it, brief the user on it, then execute when they say go.
- **Use Sonnet subagents for the tasks** (`Agent` tool, `model: "sonnet"`,
  run in the background). The orchestrator (you) owns the design, reviews each
  report, diff and screenshot set, runs the final verification, and opens the
  PR.
- Run tasks in parallel only with **strict file ownership** (list "you own /
  don't touch" files in each prompt). Give each agent its own test DB and its
  own dev-server port. Tell agents to commit as they go (`git add <own paths>`,
  never `-A`).
  - Container restarts have killed agents twice.
  - Five agents at once hit the account's usage limit once in Phase 3. After
    it resets, resume each one with `SendMessage` (its work and context are
    kept) instead of starting over.
- When two parallel tasks need the same new helper, write it yourself first
  (Phase 3 did this with `useViewActions`), so the agents don't each build one.
- **One branch and PR per phase.** Ask the user before opening the PR and
  before merging. Squash-merge with a title ending in `(#N)`. "Deploy" means
  merge to `main`: Vercel then builds production and migrates. Commit trailers:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: …`.
- The user prefers short, direct answers and likes to see results (screenshots,
  numbers) rather than descriptions.

## Phase 4 scope (to plan)
Approved earlier by the user:
1. **Guest/demo login** next to "Continue with Google", so reviewers can try it
   without a Google account.
2. **Abuse limits for the public demo:** a per-user row cap, and a rate limit
   on the 100k button.
3. **A pre-seeded 1M-row showcase table** that every visitor can open.
4. **Firefox check** of scaled scrolling.

Worth proposing in the plan (not yet approved):
- **Guest cleanup:** a Vercel Cron route that deletes guest users (and their
  data) older than N hours.
- **E2e scripts in the repo:** move the reusable Playwright scripts into
  `scripts/e2e/` (1M-row checks, layout, flash sampling, scroll perf), so they
  survive container restarts. Today they live in `/tmp` (see Environment).
- Refresh `docs/benchmarks.md` against the production database (Neon) to show
  real network latency next to the local numbers.

### Facts and constraints found while preparing Phase 4
- **Auth today:** NextAuth v5 with `PrismaAdapter` and **database sessions**
  (`src/server/auth/config.ts`); Google is the only provider.
  - Auth.js's Credentials provider only works with JWT sessions. So a guest
    login means either switching to JWT sessions (and changing the `session`
    callback, which reads `user.id`), or a custom route or server action that
    creates a `User` plus a `Session` row and sets the `authjs.session-token`
    cookie. That is exactly how Playwright authenticates locally.
  - The second option keeps database sessions and the existing code. Decide in
    the plan.
- **Deleting a user does not drop their sort indexes.** `User → Base → Table →
  Row` cascades in SQL, but the runtime sort indexes (`rs_<table>_<column>_<a|d>`)
  are only dropped by `base.delete`, `table.delete` and `column.delete`, through
  `dropSortIndexes`. Any guest cleanup must call `dropSortIndexes` per table
  before deleting. Big tables should also be deleted in batches
  (`DELETE_BATCH_SIZE` in `src/server/db/tables.ts`) rather than with one
  cascading delete.
- **Size of a 1M-row table:** about **1.5 GB** in Postgres (833 MB of rows plus
  680 MB of indexes, mostly the trigram search index), measured locally on
  `airtable_bench`.
  - Check the Neon plan's storage limit before seeding production. The free
    tier is far smaller than this.
  - One shared table is affordable; one per guest is not.
- **Access model:** every procedure checks `base.ownerId === session user`
  (`src/server/api/access.ts`); not-found and forbidden look the same.
  - A shared showcase needs a read-only path: e.g. a `Base.isShowcase` flag
    readable by anyone and writes rejected.
  - View config (sort, filters, search, hidden fields, widths) is stored on the
    `View` row, so a shared view would be changed by every visitor. Options:
    per-user views of the showcase table, or showcase view state kept on the
    client only.
  - Pre-build the showcase's sort indexes when seeding.
- **Where the row cap would go:** `row.addFakeRows`, `row.createRow`,
  `table.create` (50 seed rows) and `base.create` (a first table) in
  `src/server/api/routers/`.
  - Counting a user's rows across tables means a join through `Table` and
    `Base`; at 1M rows a count is about 50 ms (see benchmarks). Keep a counter,
    or cap per table, if that's too slow.
  - There is no Redis. A rate limit needs a DB table or a timestamp column.
- **100k insert timing:** about 8 s locally (`fakeRows.test.ts` asserts < 10 s).
  On Vercel with Neon it may take longer, so check the function's duration
  limit for the tRPC route.
- **Firefox:** only Chromium is installed in the container (`/opt/pw-browsers`).
  Installing Playwright's Firefox needs network access that may be blocked.
  Otherwise, ask the user to check it by hand. Firefox's maximum element height
  (about 17.9M px) is why the scroll spacer is capped at 8M px
  (`gridConstants.ts`, `SCROLL_CAP`).

### Known, unreproduced reports from Phase 3
Agents testing against a shared `next dev` server saw these. Neither reproduced
on a production build.
- The header popover closing on its own right after page load.
- The sort label staying "Sorted by 1 field" after "Remove sort". 10/10 fast
  add-and-remove cycles were fine.

## Environment notes (cloud container)
- **Local Postgres 16:** socket `/tmp`, port 5433, user `postgres`, no
  password, data dir `/tmp/claude-pgbench/data`. It **stops on container
  restart**. Start it with:
  `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/claude-pgbench/data -l /tmp/claude-pgbench/log -o '-p 5433 -k /tmp' start"`
  (If `/tmp` was wiped, re-create it with `initdb` and `prisma migrate deploy`.)
- **DBs** (all migrated through `base_color`):
  - `airtable`: the dev DB. `.env` points here. User session token
    `tok-walk-17`. Bases: "Walkthrough Base" (a 200k-row table; its view has
    1 hidden field) and "Untitled Base". Don't modify these; create test bases
    and delete them afterwards (through `base.delete`, so sort indexes go too).
  - `airtable_test`: the test DB. Spare per-agent test DBs: `airtable_t12` …
    `airtable_t19`.
  - `airtable_bench`: has a **1M-row table** `bench-1000000`. Session token
    `benchtok`. URL
    `/cmviezbek00027dgvb63b4c0x/cmvif2zbg00027d501mk1klkz?viewId=cmvif2zbg00077d50xuedqm5i`.
    Leave its view clean (no sort, filters, hidden fields or search;
    `columnWidths` `{}`); the views table is `views`. Row 3 holds made-up
    values from the README capture.
  - `at`: the old pre-Phase-1 schema with 1M rows. `airtable_main`: unknown,
    leave alone. Don't modify either.
- **Auth for Playwright:** insert or refresh a `Session` row and set cookie
  `authjs.session-token=<token>` on localhost. If the session expired:
  `UPDATE "Session" SET expires = now() + interval '2 days'`.
- **Playwright:** the global install
  (`require(execSync('npm root -g').toString().trim() + '/playwright')`),
  with Chromium at `/opt/pw-browsers`. `ffmpeg` is installed; `pngquant` and
  `optipng` aren't.
- **Reusable scripts in `/tmp/claude-pgbench`** (gone after `/tmp` is wiped):
  - `review/e2e.cjs`: the 1M-row e2e, 14 checks. It now waits for the
    hide-fields popover to close before dragging a resize handle, because the
    popover opens over the Email column's handle.
  - `review/perf.cjs`: the wheel-scroll frame timing.
  - `shots-3.2/flash.cjs`: per-frame flash sampling.
  - `shots-3.3/layout.cjs`: no page scrollbar.
  - `shots-3.12/`: the README GIF capture.
- **Tests:** `TEST_DATABASE_URL="postgresql://postgres@localhost:5433/airtable_test?host=/tmp" npm test`
  (478 tests, about 80 s). Run `prisma migrate deploy` on test DBs after schema
  changes. `fakeRows.test.ts`'s 10 s limit can fail when the machine is busy;
  rerun it alone before treating it as a regression.
- **Bench:** `npm run bench -- --reuse` writes `docs/benchmarks.md`.

## Gotchas
- `next dev` or `next build` with a custom `NEXT_DIST_DIR` rewrites
  `tsconfig.json` (adds its types dir). Never commit that; run
  `git checkout tsconfig.json`.
- Several agents on one `next dev` server each trigger Fast Refresh for the
  others, which closes popovers mid-test. Use `next build` + `next start` for
  stable Playwright runs and for performance numbers.
- `pkill -f "next start"` kills your own shell, because the pattern matches
  the bash command line. Use `pgrep -f "[n]ext-server"` and kill those PIDs.
- Two `next dev` servers sharing one `.next` crash with webpack errors. Give
  each server its own `NEXT_DIST_DIR` and port.
- `createdb -T airtable` fails while a server holds connections; copy with
  `pg_dump | psql` instead.
- After switching branches with different schemas, run `npx prisma generate`,
  or tests fail with "column does not exist".
- Radix popovers keep catching clicks while they fade out (about 150 ms). In
  Playwright, wait for `[data-radix-popper-content-wrapper]` to detach before
  clicking what was under one.
- **Vercel:**
  - `npm run vercel-build` (`scripts/vercel-build.mjs`) builds, then runs
    `prisma migrate deploy` **only when `VERCEL_ENV=production`**. Preview
    deploys never migrate, so a preview of a branch with a new migration fails
    at runtime if it shares the production DB.
  - Migrations need a non-pooled connection (advisory locks): set `DIRECT_URL`
    when `DATABASE_URL` is Neon's `-pooler` host. Running
    `prisma migrate deploy` through the pooler times out with P1002.
  - A deploy that fails at "Vulnerable version of Next.js detected" needs a
    Next patch upgrade.
- Sort indexes are created at runtime as partial expression indexes named
  `rs_<tableId>_<columnId>_<a|d>`. Prisma's drift check ignores them, which
  was verified.
