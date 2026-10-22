import { describe, expect, it } from "vitest";

import { createRequestSequence, sequenceFor } from "./requestSequence";

describe("createRequestSequence", () => {
  it("numbers requests upward from 1", () => {
    const s = createRequestSequence();
    expect([s.next(), s.next(), s.next()]).toEqual([1, 2, 3]);
  });

  it("only the newest issued request is the latest", () => {
    const s = createRequestSequence();
    const a = s.next();
    expect(s.isLatest(a)).toBe(true);
    const b = s.next();
    expect(s.isLatest(a)).toBe(false);
    expect(s.isLatest(b)).toBe(true);
  });

  it("an older response arriving last is recognized as stale", () => {
    const s = createRequestSequence();
    const first = s.next();
    const second = s.next();
    const applied: number[] = [];
    // Responses arrive out of order: second, then first.
    for (const seq of [second, first]) if (s.isLatest(seq)) applied.push(seq);
    expect(applied).toEqual([second]);
  });

  it("a response is current again until another request is sent", () => {
    const s = createRequestSequence();
    const a = s.next();
    expect(s.isLatest(a)).toBe(true);
    expect(s.isLatest(a)).toBe(true);
  });
});

describe("sequenceFor", () => {
  it("shares one sequence per key", () => {
    const a1 = sequenceFor("view-a");
    const a2 = sequenceFor("view-a");
    const b = sequenceFor("view-b");
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    const first = a1.next();
    a2.next();
    expect(a1.isLatest(first)).toBe(false);
  });
});
