/**
 * Numbers requests in the order they are issued, so a response that arrives
 * after a newer request was sent can be told apart from the latest one.
 */
export type RequestSequence = {
  /** Registers a new request and returns its number. */
  next: () => number;
  /** True when no request newer than `seq` has been issued. */
  isLatest: (seq: number) => boolean;
};

export function createRequestSequence(): RequestSequence {
  let issued = 0;
  return {
    next: () => ++issued,
    isLatest: (seq) => seq === issued,
  };
}

const sequences = new Map<string, RequestSequence>();

/**
 * The shared sequence for `key` (a view id). Every `useUpdateViewConfig`
 * instance for a view uses the same one, so a search save and a filter change
 * made through different instances still order against each other.
 */
export function sequenceFor(key: string): RequestSequence {
  let sequence = sequences.get(key);
  if (!sequence) {
    sequence = createRequestSequence();
    sequences.set(key, sequence);
  }
  return sequence;
}
