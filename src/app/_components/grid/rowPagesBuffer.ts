/**
 * Double-buffered page cache behind `useRowPages`, without React. See
 * docs/plans/phase-3-polish.md ("No flash after a search change: swap when
 * ready").
 *
 * The buffer owns a **shown** store, which the grid reads, and at most one
 * **pending** store, being built next to it:
 *
 * - A new key (view, search, filters and sort) or `reset()` builds a pending
 *   store and primes it: the first screen of rows after a key change (the
 *   shown store's last range length, from row 0), the shown store's last
 *   range after a reset (the scroll position is kept).
 * - The pending store's total comes only from `offerCounts` for its own key.
 * - Once its count has arrived and every page of the primed range (clamped to
 *   the new total) is loaded, or one of those fetches failed, the pending
 *   store becomes the shown one and the old store is disposed.
 * - Until then the grid keeps the shown store's rows and count.
 *
 * The very first store, or one replacing a shown store that has no count yet
 * (nothing on screen to keep), is shown at once.
 */
import type { RowRecord } from "~/server/db/rows";
import type { RowPageStore, RowRange } from "./rowPageStore";

/** The two numbers `row.countRows` returns. */
export type RowCounts = {
  /** Rows matching the view. */
  count: number;
  /** Rows in the table, ignoring filters and search. */
  total: number;
};

type PendingKind = "key" | "reset";

type Entry<Meta> = {
  key: string;
  meta: Meta;
  /** Why the store was built: a new key (starts at the top) or a reset. */
  kind: PendingKind;
  store: RowPageStore;
  counts: RowCounts | null;
  /** The range to have loaded before this store is swapped in (pending only). */
  primed: RowRange | null;
  /** The count query for this store's key failed (pending only). */
  countFailed: boolean;
  unsubscribe: () => void;
};

export class RowPagesBuffer<Meta = undefined> {
  private shown: Entry<Meta> | null = null;
  private pending: Entry<Meta> | null = null;
  private create: (() => RowPageStore) | null = null;
  private defaultRows = 100;
  private disposed = false;
  private version = 0;
  private swaps = 0;
  private pendingBuilds = 0;
  private readonly listeners = new Set<() => void>();

  // -- Reading --------------------------------------------------------------

  /** Rows matching the shown rows' view; undefined until counted. */
  get total(): number | undefined {
    return this.shown?.counts?.count;
  }

  get totalUnfiltered(): number | undefined {
    return this.shown?.counts?.total;
  }

  /** The key the shown rows were fetched for ("" before the first store). */
  get resultKey(): string {
    return this.shown?.key ?? "";
  }

  /** The meta given with the shown rows' key. */
  get resultMeta(): Meta | undefined {
    return this.shown?.meta;
  }

  /** The key being built, or the shown key when nothing is pending. */
  get targetKey(): string | undefined {
    return (this.pending ?? this.shown)?.key;
  }

  /** True while a pending store waits to be swapped in. */
  get isPending(): boolean {
    return this.pending !== null;
  }

  /** True while the pending store exists or any page is being fetched. */
  get isFetching(): boolean {
    return this.pending !== null || this.shown?.store.isFetching === true;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Counts every swap (reset swaps too): the shown store's identity. */
  get epoch(): number {
    return this.swaps;
  }

  /** Counts the pending stores built; a new one wants a count offered again. */
  get pendingSeq(): number {
    return this.pendingBuilds;
  }

  getRow = (index: number): RowRecord | undefined =>
    this.shown?.store.getRow(index);

  isLoaded = (index: number): boolean =>
    this.shown?.store.isLoaded(index) === true;

  /** Changes on every change of what the grid reads; for `useSyncExternalStore`. */
  getSnapshot = (): number => this.version;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  // -- Writing --------------------------------------------------------------

  /**
   * Sets the key the rows should be for. A key that differs from the shown
   * one builds a pending store with `create`; the same key as the one already
   * shown or pending does nothing, and going back to the shown key while
   * another is pending drops the pending store. `create` must not fetch (the
   * buffer primes the store itself).
   */
  setKey(key: string, meta: Meta, create: () => RowPageStore): void {
    if (this.disposed) return;
    this.create = create;
    if (!this.shown) {
      this.shown = this.build(key, meta, create, "key");
      this.defaultRows = this.shown.store.pageSize;
      this.changed();
      return;
    }
    if (key === (this.pending ?? this.shown).key) return;

    if (key === this.shown.key) {
      // Back to what is on screen: the pending store is no longer wanted.
      this.discardPending();
      this.changed();
      return;
    }
    this.startPending(key, meta, "key");
  }

  /**
   * Rebuilds the rows for the current key (a record was added or deleted),
   * keeping the scroll position: the pending store is primed with the shown
   * store's last range. A pending store for another key is rebuilt in place.
   */
  reset(): void {
    if (this.disposed || !this.shown || !this.create) return;
    const target = this.pending ?? this.shown;
    this.startPending(target.key, target.meta, this.pending?.kind ?? "reset");
  }

  /**
   * The count for `key`, as a fresh (not placeholder, not stale) answer of the
   * count query. It goes to the pending store when `key` is the pending key,
   * and otherwise updates the shown store when `key` is the shown key. A count
   * for any other key is ignored, so the old key's count can never reach the
   * new store.
   */
  offerCounts(key: string, counts: RowCounts): void {
    if (this.disposed) return;
    const pending = this.pending;
    if (pending) {
      if (pending.key !== key) return;
      pending.counts = counts;
      pending.store.setTotal(counts.count);
      this.maybeSwap();
      return;
    }
    const shown = this.shown;
    if (!shown || shown.key !== key) return;
    const previous = shown.counts;
    if (previous?.count === counts.count && previous.total === counts.total) {
      return;
    }
    shown.counts = counts;
    shown.store.setTotal(counts.count);
    this.changed();
  }

  /**
   * The count query for `key` failed. A pending store for that key is swapped
   * in anyway (without a total) instead of waiting for ever.
   */
  offerCountError(key: string): void {
    if (this.disposed || this.pending?.key !== key) return;
    this.pending.countFailed = true;
    this.maybeSwap();
  }

  /** The grid's visible range (plus prefetch); goes to the shown store. */
  ensureRange = (start: number, end: number): void => {
    this.shown?.store.ensureRange(start, end);
  };

  /** Patches the row in both stores; true if either had it. */
  patchRow = (row: RowRecord): boolean => {
    const inShown = this.shown?.store.patchRow(row) ?? false;
    const inPending = this.pending?.store.patchRow(row) ?? false;
    return inShown || inPending;
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.discardPending();
    this.release(this.shown);
    this.shown = null;
    this.listeners.clear();
  }

  // -- Internals ------------------------------------------------------------

  private build(
    key: string,
    meta: Meta,
    create: () => RowPageStore,
    kind: PendingKind,
  ) {
    const store = create();
    const entry: Entry<Meta> = {
      key,
      meta,
      kind,
      store,
      counts: null,
      primed: null,
      countFailed: false,
      unsubscribe: () => undefined,
    };
    entry.unsubscribe = store.subscribe(() => this.onStoreChange(entry));
    return entry;
  }

  private release(entry: Entry<Meta> | null) {
    if (!entry) return;
    entry.unsubscribe();
    entry.store.dispose();
  }

  private discardPending() {
    this.release(this.pending);
    this.pending = null;
  }

  private startPending(key: string, meta: Meta, kind: PendingKind) {
    const { shown, create } = this;
    if (!shown || !create) return;

    if (!shown.counts) {
      // Nothing is on screen yet: show the new store at once.
      this.discardPending();
      const entry = this.build(key, meta, create, kind);
      this.release(shown);
      this.shown = entry;
      this.swaps++;
      this.changed();
      return;
    }

    // The range to prime. A reset keeps the scroll position: the shown
    // store's last range. A new key starts at the top, with as many rows.
    const last = shown.store.lastRange;
    const length = last
      ? Math.abs(last.end - last.start) + 1
      : this.defaultRows;
    const primed: RowRange =
      kind === "reset" && last
        ? {
            start: Math.min(last.start, last.end),
            end: Math.max(last.start, last.end),
          }
        : { start: 0, end: length - 1 };

    this.discardPending();
    const entry = this.build(key, meta, create, kind);
    entry.primed = primed;
    this.pending = entry;
    this.pendingBuilds++;
    entry.store.ensureRange(primed.start, primed.end, { immediate: true });
    this.changed();
    // Nothing to wait for if the store is somehow ready already.
    this.maybeSwap();
  }

  private onStoreChange(entry: Entry<Meta>) {
    if (this.disposed) return;
    if (this.shown === entry) this.changed();
    else if (this.pending === entry) this.maybeSwap();
  }

  /** Swaps the pending store in once its count and primed pages are there. */
  private maybeSwap() {
    const pending = this.pending;
    if (!pending || this.disposed) return;
    const failed = pending.countFailed || pending.store.hasFailedPages;
    const ready =
      pending.counts !== null &&
      (pending.primed === null || pending.store.isRangeLoaded(pending.primed));
    if (!ready && !failed) return;

    const old = this.shown;
    this.shown = pending;
    this.pending = null;
    pending.primed = null;
    this.release(old);
    this.swaps++;
    this.changed();
  }

  private changed() {
    this.version++;
    for (const listener of [...this.listeners]) listener();
  }
}
