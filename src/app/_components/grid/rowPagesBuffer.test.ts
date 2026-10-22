import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowCursor, RowRecord } from "~/server/db/rows";
import { RowPagesBuffer } from "./rowPagesBuffer";
import {
  RowPageStore,
  type PageRequest,
  type PageResponse,
} from "./rowPageStore";

const PAGE = 100;

type Waiting = {
  request: PageRequest;
  resolve: () => void;
  reject: (error: Error) => void;
};

/**
 * A fake server for one key: `total` rows with ids `${label}${i}`, whose
 * responses the test releases by hand.
 */
function makeServer(label: string, total: number) {
  const requests: PageRequest[] = [];
  const waiting: Waiting[] = [];
  const row = (i: number): RowRecord => ({
    id: `${label}${i}`,
    order: i,
    data: { v: `${label}${i}` },
  });
  const cursor = (i: number): RowCursor => ({ order: i, id: `${label}${i}` });

  function respond(request: PageRequest): PageResponse {
    let start = 0;
    let end = 0;
    if (request.kind === "first") end = Math.min(PAGE, total);
    else if (request.kind === "offset") {
      start = Math.min(request.offset, total);
      end = Math.min(start + PAGE, total);
    } else if (request.kind === "forward") {
      start = (request.cursor as { order: number }).order + 1;
      end = Math.min(start + PAGE, total);
    } else {
      end = (request.cursor as { order: number }).order;
      start = Math.max(0, end - PAGE);
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

  return {
    label,
    requests,
    kinds: () => requests.map((r) => r.kind),
    fetchPage: (request: PageRequest) =>
      new Promise<PageResponse>((resolve, reject) => {
        requests.push(request);
        waiting.push({
          request,
          resolve: () => resolve(respond(request)),
          reject,
        });
      }),
    /** Releases every waiting response (and those they trigger). */
    async flush() {
      for (;;) {
        const batch = waiting.splice(0);
        if (batch.length === 0) return;
        for (const w of batch) w.resolve();
        await vi.advanceTimersByTimeAsync(0);
      }
    },
    async releaseOne() {
      waiting.shift()?.resolve();
      await vi.advanceTimersByTimeAsync(0);
    },
    async failAll() {
      for (const w of waiting.splice(0)) w.reject(new Error("boom"));
      await vi.advanceTimersByTimeAsync(0);
    },
    get waitingCount() {
      return waiting.length;
    },
  };
}
type Server = ReturnType<typeof makeServer>;

/** What `setKey` takes for a key whose rows come from `server`. */
function keyed(server: Server, options: { retryDelayMs?: number } = {}) {
  const stores: RowPageStore[] = [];
  const create = () => {
    const store = new RowPageStore({
      pageSize: PAGE,
      fetchPage: server.fetchPage,
      retryDelayMs: options.retryDelayMs,
    });
    stores.push(store);
    return store;
  };
  return { create, stores };
}

describe("RowPagesBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A buffer showing key "a" with `total` rows, scrolled to `range`. */
  async function shownA(total = 100_000, range = { start: 0, end: 60 }) {
    const a = makeServer("a", total);
    const ka = keyed(a);
    const buffer = new RowPagesBuffer<string>();
    buffer.setKey("a", "A", ka.create);
    buffer.offerCounts("a", { count: total, total });
    buffer.ensureRange(range.start, range.end);
    await vi.advanceTimersByTimeAsync(200);
    await a.flush();
    return { buffer, a, ka };
  }

  it("shows the very first store at once, without a pending one", () => {
    const a = makeServer("a", 1000);
    const buffer = new RowPagesBuffer<string>();
    buffer.setKey("a", "A", keyed(a).create);
    expect(buffer.isPending).toBe(false);
    expect(buffer.resultKey).toBe("a");
    expect(buffer.resultMeta).toBe("A");
    expect(buffer.total).toBeUndefined();
    expect(a.requests).toEqual([]); // nothing is primed or fetched yet
  });

  it("takes the first count and fetches what the grid asks for", async () => {
    const a = makeServer("a", 1000);
    const buffer = new RowPagesBuffer<string>();
    buffer.setKey("a", "A", keyed(a).create);
    buffer.ensureRange(0, 40);
    buffer.offerCounts("a", { count: 1000, total: 1000 });
    await a.flush();
    expect(buffer.total).toBe(1000);
    expect(buffer.totalUnfiltered).toBe(1000);
    expect(buffer.getRow(0)?.id).toBe("a0");
    expect(buffer.isLoaded(40)).toBe(true);
    expect(buffer.isFetching).toBe(false);
  });

  it("updates the shown count when it changes without a new key", async () => {
    const { buffer } = await shownA(1000);
    const listener = vi.fn();
    buffer.subscribe(listener);
    buffer.offerCounts("a", { count: 1000, total: 1000 }); // same: no change
    expect(listener).not.toHaveBeenCalled();
    buffer.offerCounts("a", { count: 1001, total: 1001 });
    expect(buffer.total).toBe(1001);
    expect(listener).toHaveBeenCalled();
  });

  describe("a key change", () => {
    it("keeps the shown rows and count while the new ones load", async () => {
      const { buffer } = await shownA(100_000);
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b).create);

      expect(buffer.isPending).toBe(true);
      expect(buffer.isFetching).toBe(true);
      expect(buffer.resultKey).toBe("a");
      expect(buffer.resultMeta).toBe("A");
      expect(buffer.total).toBe(100_000);
      expect(buffer.getRow(5)?.id).toBe("a5");

      await b.flush();
      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.isPending).toBe(false);
      expect(buffer.resultKey).toBe("b");
      expect(buffer.resultMeta).toBe("B");
      expect(buffer.total).toBe(500);
      expect(buffer.getRow(5)?.id).toBe("b5");
    });

    it("primes the first screen: the shown range length, from row 0", async () => {
      // The grid was scrolled to rows 4000-4250 (251 rows = pages 0..2).
      const { buffer } = await shownA(100_000, { start: 4000, end: 4250 });
      const b = makeServer("b", 100_000);
      buffer.setKey("b", "B", keyed(b).create);
      expect(b.kinds()).toEqual(["first"]); // not an offset at row 4000
      await b.flush();
      expect(b.kinds()).toEqual(["first", "forward", "forward"]);
      buffer.offerCounts("b", { count: 100_000, total: 100_000 });
      expect(buffer.resultKey).toBe("b");
      expect(buffer.getRow(250)?.id).toBe("b250");
      expect(buffer.isLoaded(300)).toBe(false);
    });

    it("waits for the count when every page has loaded", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b).create);
      await b.flush();
      expect(buffer.isPending).toBe(true);
      expect(buffer.resultKey).toBe("a");
      expect(buffer.total).toBe(100_000);
      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.resultKey).toBe("b");
    });

    it("waits for the pages when the count has arrived", async () => {
      const { buffer } = await shownA(100_000, { start: 0, end: 250 });
      const b = makeServer("b", 5000);
      buffer.setKey("b", "B", keyed(b).create);
      buffer.offerCounts("b", { count: 5000, total: 5000 });
      expect(buffer.resultKey).toBe("a");

      await b.releaseOne(); // page 0 of 0..2
      expect(buffer.isPending).toBe(true);
      expect(buffer.total).toBe(100_000);
      await b.releaseOne(); // page 1
      expect(buffer.isPending).toBe(true);
      await b.releaseOne(); // page 2: the whole range
      expect(buffer.isPending).toBe(false);
      expect(buffer.resultKey).toBe("b");
      expect(buffer.total).toBe(5000);
    });

    it("clamps the primed range to the new total", async () => {
      const { buffer } = await shownA(100_000, { start: 0, end: 450 });
      const b = makeServer("b", 30);
      buffer.setKey("b", "B", keyed(b).create);
      await b.flush();
      expect(b.kinds()).toEqual(["first"]); // page 1 does not exist
      buffer.offerCounts("b", { count: 30, total: 1000 });
      expect(buffer.resultKey).toBe("b");
      expect(buffer.total).toBe(30);
      expect(buffer.totalUnfiltered).toBe(1000);
    });

    it("swaps in an empty result as soon as its count says 0", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 0);
      buffer.setKey("b", "B", keyed(b).create);
      buffer.offerCounts("b", { count: 0, total: 1000 });
      expect(buffer.resultKey).toBe("b");
      expect(buffer.total).toBe(0);
      await b.flush();
      expect(buffer.getRow(0)).toBeUndefined();
    });

    it("tells subscribers once at the swap, and disposes the old store", async () => {
      const { buffer, ka } = await shownA();
      const b = makeServer("b", 500);
      const kb = keyed(b);
      buffer.setKey("b", "B", kb.create);
      await b.flush();

      const listener = vi.fn();
      buffer.subscribe(listener);
      const before = buffer.getSnapshot();
      const epoch = buffer.epoch;
      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.getSnapshot()).not.toBe(before);
      expect(buffer.epoch).toBe(epoch + 1);
      expect(listener).toHaveBeenCalled();
      expect(ka.stores[0]!.isDisposed).toBe(true);
      expect(kb.stores[0]!.isDisposed).toBe(false);
    });

    it("does nothing for the key that is already shown or pending", async () => {
      const { buffer } = await shownA();
      const create = vi.fn();
      buffer.setKey("a", "A", create);
      expect(create).not.toHaveBeenCalled();
      expect(buffer.isPending).toBe(false);

      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b).create);
      const again = vi.fn();
      buffer.setKey("b", "B", again);
      expect(again).not.toHaveBeenCalled();
      expect(b.requests).toHaveLength(1);
    });

    it("shows a new store at once while nothing has been counted yet", async () => {
      const a = makeServer("a", 1000);
      const buffer = new RowPagesBuffer<string>();
      const ka = keyed(a);
      buffer.setKey("a", "A", ka.create);
      const b = makeServer("b", 1000);
      buffer.setKey("b", "B", keyed(b).create);
      expect(buffer.isPending).toBe(false);
      expect(buffer.resultKey).toBe("b");
      expect(ka.stores[0]!.isDisposed).toBe(true);
    });
  });

  describe("counts", () => {
    it("never takes a count that belongs to another key", async () => {
      // The count query keeps the previous search's data as placeholder data
      // while the new one loads; the hook never offers it, and the buffer
      // would not take it for the pending key anyway.
      const { buffer } = await shownA(100_000);
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b).create);
      await b.flush();

      buffer.offerCounts("a", { count: 99, total: 99 });
      expect(buffer.isPending).toBe(true); // the pages are there, no count
      expect(buffer.total).toBe(100_000);

      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.total).toBe(500);
    });

    it("keeps the shown count as it was while a store is pending", async () => {
      const { buffer } = await shownA(100_000);
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b).create);
      // A background refetch of the old key's count must not change the footer
      // or the shown store in the middle of a swap.
      buffer.offerCounts("a", { count: 100_001, total: 100_001 });
      expect(buffer.total).toBe(100_000);
    });

    it("swaps without a count when the count query fails", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b).create);
      await b.flush();
      buffer.offerCountError("a"); // another key: ignored
      expect(buffer.isPending).toBe(true);
      buffer.offerCountError("b");
      expect(buffer.isPending).toBe(false);
      expect(buffer.resultKey).toBe("b");
      expect(buffer.total).toBeUndefined();
      // A later successful count is taken by the shown store.
      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.total).toBe(500);
    });
  });

  describe("a key change while another store is pending", () => {
    it("replaces the pending store and disposes the abandoned one", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 500);
      const kb = keyed(b);
      buffer.setKey("b", "B", kb.create);
      expect(b.waitingCount).toBe(1);

      const c = makeServer("c", 700);
      const kc = keyed(c);
      buffer.setKey("c", "C", kc.create);
      expect(kb.stores[0]!.isDisposed).toBe(true);
      expect(buffer.targetKey).toBe("c");
      expect(buffer.resultKey).toBe("a");

      // The abandoned store's late page and count change nothing.
      await b.flush();
      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.isPending).toBe(true);
      expect(buffer.resultKey).toBe("a");

      await c.flush();
      buffer.offerCounts("c", { count: 700, total: 700 });
      expect(buffer.resultKey).toBe("c");
      expect(buffer.total).toBe(700);
      expect(buffer.getRow(1)?.id).toBe("c1");
      expect(kc.stores[0]!.isDisposed).toBe(false);
    });

    it("primes the replacement from the shown store, not the abandoned one", async () => {
      const { buffer } = await shownA(100_000, { start: 0, end: 150 });
      const b = makeServer("b", 5000);
      buffer.setKey("b", "B", keyed(b).create);
      const c = makeServer("c", 5000);
      buffer.setKey("c", "C", keyed(c).create);
      await c.flush();
      expect(c.kinds()).toEqual(["first", "forward"]);
    });

    it("drops the pending store when the key goes back to the shown one", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 500);
      const kb = keyed(b);
      buffer.setKey("b", "B", kb.create);
      const create = vi.fn();
      buffer.setKey("a", "A", create);
      expect(create).not.toHaveBeenCalled();
      expect(buffer.isPending).toBe(false);
      expect(buffer.isFetching).toBe(false);
      expect(kb.stores[0]!.isDisposed).toBe(true);
      expect(buffer.resultKey).toBe("a");
      expect(buffer.getRow(0)?.id).toBe("a0");
    });
  });

  describe("a failed fetch", () => {
    it("still swaps, with the count it has", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b, { retryDelayMs: 5000 }).create);
      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.isPending).toBe(true);
      await b.failAll();
      expect(buffer.isPending).toBe(false);
      expect(buffer.resultKey).toBe("b");
      expect(buffer.total).toBe(500);
    });

    it("swaps when the page fails before the count arrives", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b, { retryDelayMs: 5000 }).create);
      await b.failAll();
      expect(buffer.resultKey).toBe("b");
      expect(buffer.total).toBeUndefined();
      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.total).toBe(500);
    });

    it("retries the failed page in the swapped-in store", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b, { retryDelayMs: 1000 }).create);
      buffer.offerCounts("b", { count: 500, total: 500 });
      await b.failAll();
      buffer.ensureRange(0, 40);
      await vi.advanceTimersByTimeAsync(1000);
      await b.flush();
      expect(buffer.getRow(0)?.id).toBe("b0");
    });
  });

  describe("patchRow", () => {
    it("patches both the shown and the pending store", async () => {
      const { buffer } = await shownA();
      const b = makeServer("b", 500);
      buffer.setKey("b", "B", keyed(b).create);
      await b.flush();

      // Row "a3" is only in the shown store, "b3" only in the pending one.
      const patchedA: RowRecord = { id: "a3", order: 3, data: { v: "edited" } };
      const patchedB: RowRecord = { id: "b3", order: 3, data: { v: "edited" } };
      expect(buffer.patchRow(patchedA)).toBe(true);
      expect(buffer.patchRow(patchedB)).toBe(true);
      expect(buffer.patchRow({ id: "zz", order: 0, data: {} })).toBe(false);
      expect(buffer.getRow(3)?.data.v).toBe("edited");

      buffer.offerCounts("b", { count: 500, total: 500 });
      expect(buffer.getRow(3)?.id).toBe("b3");
      expect(buffer.getRow(3)?.data.v).toBe("edited");
    });

    it("patches a row that is in both stores", async () => {
      const { buffer } = await shownA();
      const same = makeServer("a", 500); // the same ids in the pending store
      buffer.setKey("a2", "A", keyed(same).create);
      await same.flush();
      buffer.patchRow({ id: "a1", order: 1, data: { v: "edited" } });
      expect(buffer.getRow(1)?.data.v).toBe("edited");
      buffer.offerCounts("a2", { count: 500, total: 500 });
      expect(buffer.getRow(1)?.data.v).toBe("edited");
    });
  });

  describe("reset", () => {
    it("primes the pending store with the shown store's last range", async () => {
      // Scrolled to rows 4950-5100 (pages 49..51).
      const server = makeServer("a", 100_000);
      const { buffer } = await shownWith(keyed(server), 100_000, {
        start: 4950,
        end: 5100,
      });
      await server.flush();
      server.requests.length = 0;

      buffer.reset();
      // One offset fetch at once (no debounce), not a fetch from row 0.
      expect(server.requests).toEqual([{ kind: "offset", offset: 4900 }]);
      await server.flush();
      expect(server.kinds()).toEqual(["offset", "forward", "forward"]);
      buffer.offerCounts("a", { count: 100_001, total: 100_001 });
      expect(buffer.isPending).toBe(false);
      expect(buffer.getRow(5000)?.id).toBe("a5000");
      expect(buffer.getRow(4950)?.id).toBe("a4950");
    });

    it("keeps the shown rows and count until the new count and pages are in", async () => {
      const server = makeServer("a", 1000);
      const { buffer } = await shownWith(keyed(server), 1000, {
        start: 0,
        end: 60,
      });
      await server.flush();
      const epoch = buffer.epoch;
      buffer.reset();
      expect(buffer.isPending).toBe(true);
      expect(buffer.isFetching).toBe(true);
      expect(buffer.total).toBe(1000);
      expect(buffer.getRow(0)?.id).toBe("a0");

      await server.flush();
      expect(buffer.isPending).toBe(true); // no new count yet
      buffer.offerCounts("a", { count: 1001, total: 1001 });
      expect(buffer.isPending).toBe(false);
      expect(buffer.total).toBe(1001);
      expect(buffer.epoch).toBe(epoch + 1);
    });

    it("keeps the result key, so the grid keeps its scroll position", async () => {
      const server = makeServer("a", 1000);
      const { buffer } = await shownWith(keyed(server), 1000, {
        start: 0,
        end: 60,
      });
      buffer.reset();
      await server.flush();
      buffer.offerCounts("a", { count: 1000, total: 1000 });
      expect(buffer.isPending).toBe(false);
      expect(buffer.resultKey).toBe("a");
    });

    it("rebuilds a pending key change in place, still starting at the top", async () => {
      const { buffer } = await shownA(100_000, { start: 3000, end: 3150 });
      const b = makeServer("b", 5000);
      const kb = keyed(b);
      buffer.setKey("b", "B", kb.create);
      buffer.reset();
      expect(kb.stores).toHaveLength(2);
      expect(kb.stores[0]!.isDisposed).toBe(true);
      expect(b.kinds()).toEqual(["first", "first"]); // not an offset at 3000
      expect(buffer.targetKey).toBe("b");
      expect(buffer.resultKey).toBe("a");
    });

    it("asks for the count again with every new pending store", async () => {
      const { buffer } = await shownA();
      const seq = buffer.pendingSeq;
      buffer.reset();
      expect(buffer.pendingSeq).toBe(seq + 1);
    });

    it("does nothing before there is a store", () => {
      const buffer = new RowPagesBuffer<string>();
      buffer.reset();
      expect(buffer.isPending).toBe(false);
    });
  });

  describe("dispose", () => {
    it("disposes both stores and ignores later calls", async () => {
      const { buffer, ka } = await shownA();
      const b = makeServer("b", 500);
      const kb = keyed(b);
      buffer.setKey("b", "B", kb.create);
      buffer.dispose();
      expect(buffer.isDisposed).toBe(true);
      expect(ka.stores[0]!.isDisposed).toBe(true);
      expect(kb.stores[0]!.isDisposed).toBe(true);

      await b.flush();
      buffer.offerCounts("b", { count: 500, total: 500 });
      buffer.setKey("c", "C", keyed(makeServer("c", 1)).create);
      buffer.reset();
      expect(buffer.getRow(0)).toBeUndefined();
      expect(buffer.isPending).toBe(false);
      buffer.dispose(); // twice is fine
    });
  });
});

/** A buffer showing key "a" built by `keyed`, counted and scrolled to `range`. */
async function shownWith(
  k: ReturnType<typeof keyed>,
  total: number,
  range: { start: number; end: number },
) {
  const buffer = new RowPagesBuffer<string>();
  buffer.setKey("a", "A", k.create);
  buffer.offerCounts("a", { count: total, total });
  buffer.ensureRange(range.start, range.end);
  await vi.advanceTimersByTimeAsync(200);
  return { buffer };
}
