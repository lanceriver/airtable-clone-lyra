import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowCursor, RowRecord } from "~/server/db/rows";
import {
  planFetches,
  pagesInRange,
  pagesToEvict,
  RowPageStore,
  type PageRequest,
  type PageResponse,
  type PlannerState,
} from "./rowPageStore";

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------
describe("planFetches", () => {
  const cur = (n: number): RowCursor => ({ order: n, id: `r${n}` });
  /** A cached page k as a server would return it. */
  const cached = (k: number, last = false) => ({
    nextCursor: last ? null : cur(k * 100 + 99),
    prevCursor: k === 0 ? null : cur(k * 100),
  });

  function state(
    cachedPages: number[],
    over: Partial<PlannerState> = {},
  ): PlannerState {
    return {
      pageSize: 100,
      total: 100_000,
      pages: new Map(cachedPages.map((k) => [k, cached(k)])),
      inFlight: new Set(),
      ...over,
    };
  }
  const row = (a: number, b: number) => ({ start: a, end: b });

  it("fetches page 0 as first when nothing is cached", () => {
    const plan = planFetches(state([]), row(0, 40));
    expect(plan.immediate).toEqual([{ page: 0, request: { kind: "first" } }]);
    expect(plan.detached).toBeNull();
  });

  it("fetches page 0 as first even when page 1 is cached", () => {
    const plan = planFetches(state([1]), row(0, 40));
    expect(plan.immediate).toEqual([{ page: 0, request: { kind: "first" } }]);
  });

  it("fetches the page after a cached page by forward keyset", () => {
    const plan = planFetches(state([0]), row(50, 150));
    expect(plan.immediate).toEqual([
      { page: 1, request: { kind: "forward", cursor: cur(99) } },
    ]);
    expect(plan.detached).toBeNull();
  });

  it("fetches the page before a cached page by backward keyset", () => {
    const plan = planFetches(state([50]), row(4950, 4990));
    expect(plan.immediate).toEqual([
      { page: 49, request: { kind: "backward", cursor: cur(5000) } },
    ]);
    expect(plan.detached).toBeNull();
  });

  it("prefers forward when both neighbours are cached", () => {
    const plan = planFetches(state([9, 11]), row(1000, 1050));
    expect(plan.immediate).toEqual([
      { page: 10, request: { kind: "forward", cursor: cur(999) } },
    ]);
  });

  it("plans a detached page by offset, not immediately", () => {
    const plan = planFetches(state([0]), row(5000, 5050));
    expect(plan.immediate).toEqual([]);
    expect(plan.detached).toEqual({
      page: 50,
      request: { kind: "offset", offset: 5000 },
    });
  });

  it("picks only the first detached page of the range", () => {
    const plan = planFetches(state([0]), row(4950, 5250));
    expect(plan.immediate).toEqual([]);
    expect(plan.detached).toEqual({
      page: 49,
      request: { kind: "offset", offset: 4900 },
    });
  });

  it("chains keyset fetches from cached pages in one range", () => {
    // 10 and 13 are cached; 11 goes forward, 12 backward (13 is cached).
    const plan = planFetches(state([10, 13]), row(1000, 1399));
    expect(plan.immediate).toEqual([
      { page: 11, request: { kind: "forward", cursor: cur(1099) } },
      { page: 12, request: { kind: "backward", cursor: cur(1300) } },
    ]);
    expect(plan.detached).toBeNull();
  });

  it("does not plan pages that are cached or in flight", () => {
    const plan = planFetches(
      state([0, 1], { inFlight: new Set([2]) }),
      row(0, 299),
    );
    expect(plan.immediate).toEqual([]);
    expect(plan.detached).toBeNull();
  });

  it("defers a page whose before-neighbour is in flight", () => {
    const plan = planFetches(
      state([], { inFlight: new Set([50]) }),
      row(5000, 5150),
    );
    expect(plan.immediate).toEqual([]);
    expect(plan.detached).toBeNull();
  });

  it("defers a page whose after-neighbour is in flight", () => {
    const plan = planFetches(
      state([], { inFlight: new Set([50]) }),
      row(4900, 5050),
    );
    expect(plan.immediate).toEqual([]);
    expect(plan.detached).toBeNull();
  });

  it("defers pages that will chain from a page this plan issues", () => {
    // Nothing cached: page 1 waits for page 0 instead of being detached.
    const plan = planFetches(state([]), row(0, 250));
    expect(plan.immediate).toEqual([{ page: 0, request: { kind: "first" } }]);
    expect(plan.detached).toBeNull();
    // Page 49 is issued backward, so 47 and 48 wait for the chain.
    const up = planFetches(state([50]), row(4700, 5050));
    expect(up.immediate).toEqual([
      { page: 49, request: { kind: "backward", cursor: cur(5000) } },
    ]);
    expect(up.detached).toBeNull();
  });

  it("still detaches a page that no fetch will reach", () => {
    const plan = planFetches(
      state([], { inFlight: new Set([10]) }),
      row(5000, 5050),
    );
    expect(plan.detached?.page).toBe(50);
  });

  it("does not request pages after the last one", () => {
    const pages = new Map([[0, { nextCursor: null, prevCursor: null }]]);
    const plan = planFetches(state([], { pages }), row(0, 450));
    expect(plan).toEqual({ immediate: [], detached: null });
  });

  it("clamps the range to the total and plans nothing for an empty view", () => {
    const small = planFetches(state([], { total: 150 }), row(0, 10_000));
    expect(small.immediate).toEqual([{ page: 0, request: { kind: "first" } }]);
    expect(small.detached).toBeNull();
    const none = planFetches(state([], { total: 0 }), row(0, 50));
    expect(none).toEqual({ immediate: [], detached: null });
    const beyond = planFetches(state([0], { total: 150 }), row(900, 950));
    // Clamped to the last row (page 1), which chains from page 0.
    expect(beyond.immediate.map((f) => f.page)).toEqual([1]);
  });

  it("treats an unknown total as unbounded", () => {
    const plan = planFetches(state([], { total: null }), row(0, 250));
    expect(plan.immediate.map((f) => f.page)).toEqual([0]);
  });

  it("skips pages that failed", () => {
    const plan = planFetches(state([0], { failed: new Set([1]) }), row(0, 150));
    expect(plan).toEqual({ immediate: [], detached: null });
  });

  it("accepts a reversed or negative range", () => {
    expect(pagesInRange({ start: 250, end: 50 }, 100, null)).toEqual([0, 1, 2]);
    expect(pagesInRange({ start: -20, end: 10 }, 100, null)).toEqual([0]);
  });
});

describe("pagesToEvict", () => {
  it("evicts nothing under the cap", () => {
    expect(pagesToEvict([1, 2, 3], { start: 0, end: 10 }, 100, 3)).toEqual([]);
  });

  it("evicts the pages farthest from the range, never those inside it", () => {
    const evicted = pagesToEvict(
      [0, 1, 2, 10, 11, 50],
      { start: 1000, end: 1150 },
      100,
      4,
    );
    expect(new Set(evicted)).toEqual(new Set([0, 50]));
    const all = pagesToEvict([10, 11], { start: 1000, end: 1150 }, 100, 0);
    expect(all).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const PAGE = 100;

type Pending = {
  request: PageRequest;
  resolve: () => void;
  reject: (e: Error) => void;
};

/** A fake server over `total` rows whose responses the test releases. */
function makeFetcher(total: number) {
  const requests: PageRequest[] = [];
  const pending: Pending[] = [];
  const row = (i: number): RowRecord => ({
    id: `r${i}`,
    order: i,
    data: { v: i },
  });
  const cursor = (i: number): RowCursor => ({ order: i, id: `r${i}` });

  function respond(request: PageRequest): PageResponse {
    let start = 0;
    let end = 0;
    switch (request.kind) {
      case "first":
        end = Math.min(PAGE, total);
        break;
      case "offset":
        start = Math.min(request.offset, total);
        end = Math.min(start + PAGE, total);
        break;
      case "forward": {
        start = (request.cursor as { order: number }).order + 1;
        end = Math.min(start + PAGE, total);
        break;
      }
      case "backward": {
        end = (request.cursor as { order: number }).order;
        start = Math.max(0, end - PAGE);
        break;
      }
    }
    const rows: RowRecord[] = [];
    for (let i = start; i < end; i++) rows.push(row(i));
    const backward = request.kind === "backward";
    return {
      rows,
      nextCursor:
        rows.length > 0 && (backward || end < total) ? cursor(end - 1) : null,
      prevCursor: rows.length > 0 && start > 0 ? cursor(start) : null,
    };
  }

  const fetchPage = (request: PageRequest) =>
    new Promise<PageResponse>((resolve, reject) => {
      requests.push(request);
      pending.push({
        request,
        resolve: () => resolve(respond(request)),
        reject,
      });
    });

  return {
    fetchPage,
    requests,
    kinds: () => requests.map((r) => r.kind),
    /** Releases every response that is waiting, and lets the store react. */
    async flush() {
      for (;;) {
        const batch = pending.splice(0);
        if (batch.length === 0) return;
        for (const p of batch) p.resolve();
        await vi.advanceTimersByTimeAsync(0);
      }
    },
    /** Releases only the oldest waiting response. */
    async releaseOne() {
      pending.shift()?.resolve();
      await vi.advanceTimersByTimeAsync(0);
    },
    async failOne() {
      pending.shift()?.reject(new Error("boom"));
      await vi.advanceTimersByTimeAsync(0);
    },
    get pendingCount() {
      return pending.length;
    },
  };
}

describe("RowPageStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(
    total = 100_000,
    options: Partial<ConstructorParameters<typeof RowPageStore>[0]> = {},
  ) {
    const server = makeFetcher(total);
    const store = new RowPageStore({
      pageSize: PAGE,
      fetchPage: server.fetchPage,
      jumpDebounceMs: 120,
      ...options,
    });
    store.setTotal(total);
    return { server, store };
  }

  it("scrolling down from the top uses first then a forward chain only", async () => {
    const { server, store } = setup();
    for (let top = 0; top <= 1000; top += 50) {
      store.ensureRange(top, top + 40 + 30); // viewport plus overscan
      await server.flush();
      await vi.advanceTimersByTimeAsync(300); // far longer than the debounce
    }
    expect(new Set(server.kinds())).toEqual(new Set(["first", "forward"]));
    expect(server.kinds().filter((k) => k === "first")).toHaveLength(1);
    // Every page from 0 to 10 once, in order, with no offset or backward.
    expect(server.requests.length).toBe(11);
    expect(store.getRow(0)?.id).toBe("r0");
    expect(store.getRow(1050)?.id).toBe("r1050");
    expect(store.isLoaded(1100)).toBe(false);
  });

  it("a first range over several pages chains without any offset", async () => {
    const { server, store } = setup();
    store.ensureRange(0, 250);
    expect(server.kinds()).toEqual(["first"]);
    await server.flush();
    await vi.advanceTimersByTimeAsync(500);
    expect(server.kinds()).toEqual(["first", "forward", "forward"]);
    expect(store.isLoaded(299)).toBe(true);
  });

  it("a jump fires exactly one offset after the debounce, then chains by keyset", async () => {
    const { server, store } = setup();
    store.ensureRange(0, 60);
    await server.flush();
    server.requests.length = 0;

    // The range covers pages 49, 50, 51.
    store.ensureRange(4950, 5150);
    await vi.advanceTimersByTimeAsync(119);
    expect(server.requests).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.requests).toEqual([{ kind: "offset", offset: 4900 }]);
    expect(store.isFetching).toBe(true);

    await server.flush();
    expect(server.kinds()).toEqual(["offset", "forward", "forward"]);
    expect(store.getRow(4950)?.id).toBe("r4950");
    expect(store.getRow(5199)?.id).toBe("r5199");
    expect(store.isFetching).toBe(false);

    // Scrolling back up from there uses backward keyset, never another offset.
    server.requests.length = 0;
    store.ensureRange(4600, 4800);
    await server.flush();
    await vi.advanceTimersByTimeAsync(500);
    expect(server.kinds()).toEqual(["backward", "backward", "backward"]);
    expect(store.getRow(4600)?.id).toBe("r4600");
    expect(store.getRow(4899)?.id).toBe("r4899");
  });

  it("a jump to the last page works, and a short last page is stored", async () => {
    const { server, store } = setup(1234);
    store.ensureRange(1200, 1233);
    await vi.advanceTimersByTimeAsync(120);
    expect(server.requests).toEqual([{ kind: "offset", offset: 1200 }]);
    await server.flush();
    expect(store.getRow(1233)?.id).toBe("r1233");
    expect(store.getRow(1234)).toBeUndefined();
    // A range running past the end is clamped to the rows that exist.
    store.ensureRange(1100, 5000);
    await server.flush();
    expect(server.requests).toHaveLength(2);
    expect(server.requests[1]).toMatchObject({ kind: "backward" });
    expect(store.getRow(1100)?.id).toBe("r1100");
  });

  it("rapid ensureRange calls during a drag fire only one offset", async () => {
    const { server, store } = setup();
    store.ensureRange(0, 60);
    await server.flush();
    server.requests.length = 0;

    // A drag: a new far-away range every 16 ms for about a second.
    for (let i = 0; i < 60; i++) {
      const top = 1000 + i * 1500;
      store.ensureRange(top, top + 70);
      await vi.advanceTimersByTimeAsync(16);
    }
    expect(server.requests).toEqual([]);
    // The drag stops at the last range: top = 1000 + 59 * 1500 = 89500.
    await vi.advanceTimersByTimeAsync(120);
    expect(server.requests).toEqual([{ kind: "offset", offset: 89500 }]);
  });

  it("drops the pending offset when the range comes back to loaded rows", async () => {
    const { server, store } = setup();
    store.ensureRange(0, 60);
    await server.flush();
    server.requests.length = 0;
    store.ensureRange(5000, 5060);
    await vi.advanceTimersByTimeAsync(60);
    store.ensureRange(0, 60);
    await vi.advanceTimersByTimeAsync(500);
    expect(server.requests).toEqual([]);
  });

  it("the offset uses the latest range when the timer fires", async () => {
    const { server, store } = setup();
    store.ensureRange(0, 60);
    await server.flush();
    server.requests.length = 0;
    store.ensureRange(5000, 5060);
    await vi.advanceTimersByTimeAsync(100);
    store.ensureRange(7000, 7060);
    await vi.advanceTimersByTimeAsync(100);
    expect(server.requests).toEqual([]);
    await vi.advanceTimersByTimeAsync(20);
    expect(server.requests).toEqual([{ kind: "offset", offset: 7000 }]);
  });

  it("fires offsets at once when the debounce is 0", () => {
    const { server, store } = setup(100_000, { jumpDebounceMs: 0 });
    store.ensureRange(5000, 5060);
    expect(server.requests).toEqual([{ kind: "offset", offset: 5000 }]);
  });

  it("defers a neighbour of an in-flight page instead of firing an offset", async () => {
    const { server, store } = setup();
    store.ensureRange(5000, 5060);
    await vi.advanceTimersByTimeAsync(120);
    expect(server.requests).toEqual([{ kind: "offset", offset: 5000 }]);

    // While page 50 is in flight, the view moves down into page 51.
    store.ensureRange(5080, 5160);
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.requests).toHaveLength(1);

    // Once 50 lands, 51 goes forward by keyset.
    await server.flush();
    expect(server.requests).toEqual([
      { kind: "offset", offset: 5000 },
      { kind: "forward", cursor: { order: 5099, id: "r5099" } },
    ]);
    expect(store.getRow(5160)?.id).toBe("r5160");
  });

  it("does not let a backward neighbour fire an offset while its page is in flight", async () => {
    const { server, store } = setup();
    store.ensureRange(5000, 5060);
    await vi.advanceTimersByTimeAsync(120);
    store.ensureRange(4950, 5010);
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.requests).toHaveLength(1);
    await server.flush();
    expect(server.requests[1]).toEqual({
      kind: "backward",
      cursor: { order: 5000, id: "r5000" },
    });
  });

  it("evicts the pages farthest from the last requested range", async () => {
    const { server, store } = setup(100_000, { maxPages: 5 });
    for (let top = 0; top < 800; top += 100) {
      store.ensureRange(top, top + 99);
      await server.flush();
    }
    expect(store.cachedPageCount).toBe(5);
    // The viewport is on page 7: the nearest five (3..7) remain.
    expect(store.isLoaded(750)).toBe(true);
    expect(store.isLoaded(300)).toBe(true);
    expect(store.isLoaded(250)).toBe(false);
    expect(store.isLoaded(0)).toBe(false);
    // Scrolling back reloads page 2 by backward keyset (page 3 is cached).
    server.requests.length = 0;
    store.ensureRange(200, 299);
    await server.flush();
    expect(server.requests).toEqual([
      { kind: "backward", cursor: { order: 300, id: "r300" } },
    ]);
    expect(store.getRow(250)?.id).toBe("r250");
    expect(store.cachedPageCount).toBe(5);
  });

  it("patchRow replaces a cached row by id and notifies", async () => {
    const { server, store } = setup();
    store.ensureRange(0, 250);
    await server.flush();
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    const untouched = store.getRow(10);

    const patched: RowRecord = {
      id: "r150",
      order: 150,
      data: { v: "edited" },
    };
    expect(store.patchRow(patched)).toBe(true);
    expect(store.getRow(150)).toBe(patched);
    expect(store.getRow(10)).toBe(untouched);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);

    // An unknown row is ignored without a notification.
    expect(store.patchRow({ id: "nope", order: 1, data: {} })).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("dispose cancels timers and ignores late responses", async () => {
    const { server, store } = setup();
    store.ensureRange(0, 60);
    await server.releaseOne();
    expect(store.isLoaded(0)).toBe(true);

    // One response is in flight and an offset is waiting on the debounce.
    store.ensureRange(100, 160);
    store.ensureRange(5000, 5060);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(server.pendingCount).toBe(1);
    store.dispose();

    await vi.advanceTimersByTimeAsync(1000);
    expect(server.requests).toHaveLength(2); // no offset was issued
    await server.flush();
    expect(store.isLoaded(100)).toBe(false);
    expect(store.isFetching).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    store.ensureRange(5000, 5060);
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.requests).toHaveLength(2);
  });

  it("getSnapshot changes on every update, and listeners are told", async () => {
    const { server, store } = setup(5000);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const seen = new Set<number>([store.getSnapshot()]);

    store.ensureRange(0, 60); // starts a fetch
    seen.add(store.getSnapshot());
    expect(store.isFetching).toBe(true);
    await server.flush(); // page lands
    seen.add(store.getSnapshot());
    store.setTotal(4000); // total changes
    seen.add(store.getSnapshot());
    expect(seen.size).toBe(4);
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);

    // No change, no notification.
    const calls = listener.mock.calls.length;
    const snap = store.getSnapshot();
    store.setTotal(4000);
    store.ensureRange(0, 60);
    expect(store.getSnapshot()).toBe(snap);
    expect(listener.mock.calls.length).toBe(calls);

    unsubscribe();
    store.setTotal(10);
    expect(listener.mock.calls.length).toBe(calls);
  });

  it("fetches before the total is known, and stops when it is 0", async () => {
    const server = makeFetcher(1000);
    const store = new RowPageStore({ fetchPage: server.fetchPage });
    store.ensureRange(0, 60);
    expect(server.kinds()).toEqual(["first"]);
    await server.flush();
    store.setTotal(0);
    store.ensureRange(0, 60);
    await server.flush();
    expect(server.requests).toHaveLength(1);
  });

  it("does not loop when the total is stale and a page comes back short", async () => {
    // The view says 1000 rows but the server only has 130.
    const server = makeFetcher(130);
    const store = new RowPageStore({
      pageSize: PAGE,
      fetchPage: server.fetchPage,
    });
    store.setTotal(1000);
    store.ensureRange(0, 450);
    await server.flush();
    await vi.advanceTimersByTimeAsync(1000);
    await server.flush();
    expect(server.requests).toHaveLength(2); // first + forward, then it stops
    expect(store.getRow(129)?.id).toBe("r129");
    expect(store.getRow(130)).toBeUndefined();
    expect(store.isFetching).toBe(false);
  });

  it("retries a failed page after a delay, not in a loop", async () => {
    const { server, store } = setup(100_000, { retryDelayMs: 1000 });
    store.ensureRange(0, 60);
    await server.failOne();
    expect(store.isFetching).toBe(false);
    // Further scrolling does not hammer the failed page.
    store.ensureRange(0, 61);
    store.ensureRange(0, 62);
    await vi.advanceTimersByTimeAsync(999);
    expect(server.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.requests).toEqual([{ kind: "first" }, { kind: "first" }]);
    await server.flush();
    expect(store.isLoaded(0)).toBe(true);
  });

  it("treats a synchronous fetch error like a rejected promise", async () => {
    const store = new RowPageStore({
      fetchPage: () => {
        throw new Error("sync");
      },
      retryDelayMs: 50,
    });
    store.setTotal(100);
    store.ensureRange(0, 10);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.isFetching).toBe(false);
    store.dispose();
  });

  it("a range wider than one page chains forward page by page", async () => {
    const server = makeFetcher(500);
    const store = new RowPageStore({ fetchPage: server.fetchPage });
    store.ensureRange(0, 60);
    await server.flush();
    store.setTotal(500);
    store.ensureRange(0, 450);
    await server.flush();
    expect(server.kinds()).toEqual([
      "first",
      "forward",
      "forward",
      "forward",
      "forward",
    ]);
  });
});
