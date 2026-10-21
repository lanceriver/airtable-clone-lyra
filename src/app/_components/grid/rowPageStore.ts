/**
 * Sparse page cache for the grid: loads rows by index, in fixed-size pages,
 * without React. See docs/plans/phase-2-grid.md ("Row loading").
 *
 * A page is fetched, in order of preference, by
 *   - forward keyset from the page before it (its `nextCursor`),
 *   - backward keyset from the page after it (its `prevCursor`),
 *   - `first` (page 0), or
 *   - offset, for a "detached" page with no cached neighbour (a scrollbar
 *     jump). Offsets are debounced, so dragging the scrollbar only fetches
 *     where the drag stops. Once that page lands, its neighbours chain by
 *     keyset in either direction.
 *
 * The decision is the pure function `planFetches`; `RowPageStore` only runs
 * the plan (timers, in-flight bookkeeping, eviction, notifications).
 */
import type { RowCursor, RowRecord } from "~/server/db/rows";

export type PageRequest =
  | { kind: "first" }
  | { kind: "forward"; cursor: RowCursor }
  | { kind: "backward"; cursor: RowCursor }
  | { kind: "offset"; offset: number };

export type PageResponse = {
  rows: RowRecord[];
  nextCursor: RowCursor | null;
  prevCursor: RowCursor | null;
};

/** Loads one page of `pageSize` rows. */
export type FetchPage = (request: PageRequest) => Promise<PageResponse>;

/** Inclusive range of row indexes. */
export type RowRange = { start: number; end: number };

export type PlannerState = {
  pageSize: number;
  /** Total matching rows, or null while unknown (pages are then unbounded). */
  total: number | null;
  /** The cursors of every cached page, by page index. */
  pages: ReadonlyMap<
    number,
    { nextCursor: RowCursor | null; prevCursor: RowCursor | null }
  >;
  inFlight: ReadonlySet<number>;
  /** Pages whose last fetch failed; not planned until the retry delay passes. */
  failed?: ReadonlySet<number>;
};

export type PlannedFetch = { page: number; request: PageRequest };

export type FetchPlan = {
  /** Keyset and first-page fetches: issue right away. */
  immediate: PlannedFetch[];
  /** At most one offset fetch, to be debounced. */
  detached: PlannedFetch | null;
};

/** Pages intersecting `range`, clamped to the rows that exist. */
export function pagesInRange(
  range: RowRange,
  pageSize: number,
  total: number | null,
): number[] {
  let start = Math.max(0, Math.floor(Math.min(range.start, range.end)));
  let end = Math.max(0, Math.floor(Math.max(range.start, range.end)));
  if (total !== null) {
    if (total <= 0) return [];
    end = Math.min(end, total - 1);
    start = Math.min(start, end);
  }
  const first = Math.floor(start / pageSize);
  const last = Math.floor(end / pageSize);
  const pages: number[] = [];
  for (let k = first; k <= last; k++) pages.push(k);
  return pages;
}

/**
 * Decides which of the pages covering `range` to fetch, and how.
 *
 * - Page 0 is always fetched as `first` (no cursor needed).
 * - Page k with page k-1 cached: forward keyset. Else with page k+1 cached:
 *   backward keyset. These fire immediately.
 * - A page that is next to a page being fetched (in flight, or issued by this
 *   plan), directly or through other missing pages of the range, waits for it
 *   and then chains by keyset. It is not "detached".
 * - Otherwise the page is detached. Only the first detached page in the range
 *   is planned (by offset); the others chain from it once it has landed.
 * - A cached page whose `nextCursor` is null is the last page, so the pages
 *   after it are never requested.
 */
export function planFetches(state: PlannerState, range: RowRange): FetchPlan {
  const { pageSize, pages, inFlight } = state;
  const plan: FetchPlan = { immediate: [], detached: null };

  // Pages that are being fetched by keyset, or will be once the plan is run.
  const anchored = new Set<number>();
  const isAnchor = (k: number) => inFlight.has(k) || anchored.has(k);
  const unreachable: number[] = [];
  let pastTheEnd = Infinity;

  for (const k of pagesInRange(range, pageSize, state.total)) {
    if (pages.has(k) || inFlight.has(k) || state.failed?.has(k)) continue;

    if (k === 0) {
      plan.immediate.push({ page: 0, request: { kind: "first" } });
      anchored.add(0);
      continue;
    }

    const before = pages.get(k - 1);
    if (before) {
      if (before.nextCursor) {
        plan.immediate.push({
          page: k,
          request: { kind: "forward", cursor: before.nextCursor },
        });
        anchored.add(k);
      } else {
        // Page k-1 was the end of the data: k and later have no rows.
        pastTheEnd = Math.min(pastTheEnd, k);
      }
      continue;
    }
    const after = pages.get(k + 1)?.prevCursor;
    if (after) {
      plan.immediate.push({
        page: k,
        request: { kind: "backward", cursor: after },
      });
      anchored.add(k);
      continue;
    }
    unreachable.push(k);
  }

  // Wait for a neighbour that is being fetched instead of jumping by offset.
  for (let changed = true; changed; ) {
    changed = false;
    for (const k of unreachable) {
      if (!anchored.has(k) && (isAnchor(k - 1) || isAnchor(k + 1))) {
        anchored.add(k);
        changed = true;
      }
    }
  }

  const detached = unreachable.find((k) => k < pastTheEnd && !anchored.has(k));
  if (detached !== undefined) {
    plan.detached = {
      page: detached,
      request: { kind: "offset", offset: detached * pageSize },
    };
  }
  return plan;
}

/**
 * The pages to drop so that at most `maxPages` remain: those farthest from
 * `range` go first. Pages inside the range are never dropped.
 */
export function pagesToEvict(
  cached: Iterable<number>,
  range: RowRange,
  pageSize: number,
  maxPages: number,
): number[] {
  const all = [...cached];
  if (all.length <= maxPages) return [];
  const lo = Math.floor(
    Math.max(0, Math.min(range.start, range.end)) / pageSize,
  );
  const hi = Math.floor(
    Math.max(0, Math.max(range.start, range.end)) / pageSize,
  );
  const distance = (k: number) => (k < lo ? lo - k : k > hi ? k - hi : 0);
  return all
    .map((k) => ({ k, d: distance(k) }))
    .filter((p) => p.d > 0)
    .sort((a, b) => b.d - a.d)
    .slice(0, all.length - maxPages)
    .map((p) => p.k);
}

export type RowPageStoreOptions = {
  pageSize?: number;
  fetchPage: FetchPage;
  /** How long ensureRange must be quiet before an offset fetch fires. */
  jumpDebounceMs?: number;
  /** Most pages kept; the ones farthest from the viewport are evicted. */
  maxPages?: number;
  /** How long a failed page waits before it is planned again. */
  retryDelayMs?: number;
};

type CachedPage = PageResponse;

export class RowPageStore {
  readonly pageSize: number;
  private readonly fetchPage: FetchPage;
  private readonly jumpDebounceMs: number;
  private readonly maxPages: number;
  private readonly retryDelayMs: number;

  private total: number | null = null;
  private range: RowRange = { start: 0, end: 0 };
  private hasRange = false;
  private readonly pages = new Map<number, CachedPage>();
  private readonly inFlight = new Set<number>();
  private readonly failed = new Set<number>();
  private readonly retryTimers = new Set<ReturnType<typeof setTimeout>>();
  private jumpTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private dirty = false;
  private disposed = false;

  constructor(options: RowPageStoreOptions) {
    this.pageSize = options.pageSize ?? 100;
    this.fetchPage = options.fetchPage;
    this.jumpDebounceMs = options.jumpDebounceMs ?? 120;
    this.maxPages = options.maxPages ?? 300;
    this.retryDelayMs = options.retryDelayMs ?? 2000;
  }

  // -- Reading --------------------------------------------------------------

  getRow(index: number): RowRecord | undefined {
    if (!Number.isInteger(index) || index < 0) return undefined;
    const page = this.pages.get(Math.floor(index / this.pageSize));
    return page?.rows[index % this.pageSize];
  }

  isLoaded(index: number): boolean {
    return this.getRow(index) !== undefined;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get isFetching(): boolean {
    return this.inFlight.size > 0;
  }

  /** Number of cached pages (for tests and diagnostics). */
  get cachedPageCount(): number {
    return this.pages.size;
  }

  /** Changes on every state change; for `useSyncExternalStore`. */
  getSnapshot = (): number => this.version;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  // -- Writing --------------------------------------------------------------

  /** Sets the number of rows the view has (from `row.countRows`). */
  setTotal(total: number): void {
    if (this.disposed || this.total === total) return;
    this.total = total;
    this.touch();
    this.replan("settled");
    this.flush();
  }

  /**
   * The grid calls this on scroll with the visible rows plus overscan.
   * Fetches what's missing; an offset fetch waits until calls stop coming.
   */
  ensureRange(startIndex: number, endIndex: number): void {
    if (this.disposed) return;
    this.range = { start: startIndex, end: endIndex };
    this.hasRange = true;
    this.replan("scroll");
    this.flush();
  }

  /** Replaces a cached row (matched by id), wherever it is. */
  patchRow(row: RowRecord): boolean {
    if (this.disposed) return false;
    for (const [k, page] of this.pages) {
      const i = page.rows.findIndex((r) => r.id === row.id);
      if (i < 0) continue;
      const rows = page.rows.slice();
      rows[i] = row;
      this.pages.set(k, { ...page, rows });
      this.touch();
      this.flush();
      return true;
    }
    return false;
  }

  /** Cancels timers and makes in-flight responses be ignored. */
  dispose(): void {
    this.disposed = true;
    this.clearJumpTimer();
    for (const t of this.retryTimers) clearTimeout(t);
    this.retryTimers.clear();
    this.listeners.clear();
    this.inFlight.clear();
  }

  // -- Internals ------------------------------------------------------------

  private touch() {
    this.dirty = true;
  }

  private flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.version++;
    for (const listener of [...this.listeners]) listener();
  }

  private clearJumpTimer() {
    if (this.jumpTimer !== null) clearTimeout(this.jumpTimer);
    this.jumpTimer = null;
  }

  /**
   * Plans and issues fetches for the last requested range.
   * - "scroll" (an ensureRange call) restarts the offset debounce.
   * - "settled" (a response, a total change, a retry) leaves a running
   *   debounce alone, and starts one if an offset is needed.
   * - "timer" (the debounce fired) issues the offset fetch.
   */
  private replan(mode: "scroll" | "settled" | "timer") {
    if (this.disposed || !this.hasRange) return;
    const plan = planFetches(
      {
        pageSize: this.pageSize,
        total: this.total,
        pages: this.pages,
        inFlight: this.inFlight,
        failed: this.failed,
      },
      this.range,
    );
    for (const fetch of plan.immediate) this.issue(fetch);

    if (!plan.detached) {
      this.clearJumpTimer();
      return;
    }
    if (mode === "timer" || this.jumpDebounceMs <= 0) {
      this.clearJumpTimer();
      this.issue(plan.detached);
      return;
    }
    if (mode === "scroll" || this.jumpTimer === null) {
      this.clearJumpTimer();
      this.jumpTimer = setTimeout(() => {
        this.jumpTimer = null;
        // Plan again with the latest range and cache.
        this.replan("timer");
        this.flush();
      }, this.jumpDebounceMs);
    }
  }

  private issue({ page, request }: PlannedFetch) {
    if (this.inFlight.has(page)) return;
    this.inFlight.add(page);
    this.touch();

    let promise: Promise<PageResponse>;
    try {
      promise = Promise.resolve(this.fetchPage(request));
    } catch (error) {
      promise = Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    promise.then(
      (response) => {
        if (this.disposed) return;
        this.inFlight.delete(page);
        this.failed.delete(page);
        this.pages.set(page, {
          rows: response.rows,
          nextCursor: response.nextCursor,
          prevCursor: response.prevCursor,
        });
        this.evict();
        this.touch();
        // Neighbours of the page that just landed can now chain by keyset.
        this.replan("settled");
        this.flush();
      },
      () => {
        if (this.disposed) return;
        this.inFlight.delete(page);
        this.failed.add(page);
        const timer = setTimeout(() => {
          this.retryTimers.delete(timer);
          if (this.disposed) return;
          this.failed.delete(page);
          this.replan("settled");
          this.flush();
        }, this.retryDelayMs);
        this.retryTimers.add(timer);
        this.touch();
        this.flush();
      },
    );
  }

  private evict() {
    if (this.pages.size <= this.maxPages) return;
    for (const k of pagesToEvict(
      this.pages.keys(),
      this.range,
      this.pageSize,
      this.maxPages,
    )) {
      this.pages.delete(k);
    }
  }
}
