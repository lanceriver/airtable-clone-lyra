import { describe, expect, it } from "vitest";

import {
  gridReducer,
  initialGridState,
  type GridAction,
  type GridContext,
  type GridState,
} from "./gridReducer";

const CTX: GridContext = { rowCount: 5, colCount: 3 };
const EMPTY: GridContext = { rowCount: 0, colCount: 0 };

const at = (row: number, col: number): GridState => ({
  active: { row, col },
  editing: false,
  editSeed: null,
});
const editing = (
  row: number,
  col: number,
  seed: string | null = null,
): GridState => ({
  active: { row, col },
  editing: true,
  editSeed: seed,
});

const run = (state: GridState, action: GridAction, ctx = CTX) =>
  gridReducer(state, action, ctx);

describe("select", () => {
  it("selects a cell", () => {
    expect(run(initialGridState, { type: "select", row: 2, col: 1 })).toEqual(
      at(2, 1),
    );
  });

  it("clamps out-of-range cells", () => {
    expect(run(at(0, 0), { type: "select", row: 99, col: 99 })).toEqual(
      at(4, 2),
    );
    expect(run(at(1, 1), { type: "select", row: -3, col: -1 })).toEqual(
      at(0, 0),
    );
  });

  it("ends an edit when another cell is selected", () => {
    expect(run(editing(1, 1, "x"), { type: "select", row: 2, col: 1 })).toEqual(
      at(2, 1),
    );
  });

  it("keeps the edit when the edited cell is selected again", () => {
    const state = editing(1, 1, "x");
    expect(run(state, { type: "select", row: 1, col: 1 })).toBe(state);
  });

  it("returns the same state for the cell that is already selected", () => {
    const state = at(1, 1);
    expect(run(state, { type: "select", row: 1, col: 1 })).toBe(state);
  });
});

describe("move", () => {
  it.each([
    ["down", { dRow: 1, dCol: 0 }, at(2, 1), at(3, 1)],
    ["up", { dRow: -1, dCol: 0 }, at(2, 1), at(1, 1)],
    ["right", { dRow: 0, dCol: 1 }, at(2, 1), at(2, 2)],
    ["left", { dRow: 0, dCol: -1 }, at(2, 1), at(2, 0)],
  ])("moves %s", (_name, delta, from, to) => {
    expect(run(from, { type: "move", ...delta })).toEqual(to);
  });

  it("clamps at every edge without wrapping", () => {
    expect(run(at(0, 1), { type: "move", dRow: -1, dCol: 0 })).toEqual(
      at(0, 1),
    );
    expect(run(at(4, 1), { type: "move", dRow: 1, dCol: 0 })).toEqual(at(4, 1));
    expect(run(at(2, 0), { type: "move", dRow: 0, dCol: -1 })).toEqual(
      at(2, 0),
    );
    expect(run(at(2, 2), { type: "move", dRow: 0, dCol: 1 })).toEqual(at(2, 2));
  });

  it("returns the same state when clamped in place", () => {
    const state = at(0, 0);
    expect(run(state, { type: "move", dRow: -1, dCol: -1 })).toBe(state);
  });

  it("selects the first cell when nothing is selected", () => {
    expect(run(initialGridState, { type: "move", dRow: 1, dCol: 0 })).toEqual(
      at(0, 0),
    );
  });

  it("ends an edit", () => {
    expect(run(editing(1, 1), { type: "move", dRow: 1, dCol: 0 })).toEqual(
      at(2, 1),
    );
  });
});

describe("tab", () => {
  const tab = (state: GridState, shift = false, ctx = CTX) =>
    run(state, { type: "tab", shift }, ctx);

  it("goes to the next cell in the row", () => {
    expect(tab(at(1, 0))).toEqual(at(1, 1));
    expect(tab(at(1, 1))).toEqual(at(1, 2));
  });

  it("wraps from the last cell of a row to the first of the next", () => {
    expect(tab(at(1, 2))).toEqual(at(2, 0));
  });

  it("stays put at the last cell of the table", () => {
    const last = at(4, 2);
    expect(tab(last)).toBe(last);
  });

  it("goes to the previous cell with shift", () => {
    expect(tab(at(1, 2), true)).toEqual(at(1, 1));
    expect(tab(at(1, 1), true)).toEqual(at(1, 0));
  });

  it("wraps back to the last cell of the previous row with shift", () => {
    expect(tab(at(2, 0), true)).toEqual(at(1, 2));
  });

  it("stays put at the first cell of the table with shift", () => {
    const first = at(0, 0);
    expect(tab(first, true)).toBe(first);
  });

  it("works with a single column: tab moves down a row", () => {
    const one = { rowCount: 3, colCount: 1 };
    expect(tab(at(0, 0), false, one)).toEqual(at(1, 0));
    expect(tab(at(1, 0), true, one)).toEqual(at(0, 0));
  });

  it("selects the first cell when nothing is selected", () => {
    expect(tab(initialGridState)).toEqual(at(0, 0));
    expect(tab(initialGridState, true)).toEqual(at(0, 0));
  });

  it("ends an edit", () => {
    expect(tab(editing(1, 0, "a"))).toEqual(at(1, 1));
  });
});

describe("home and end", () => {
  it("go to the first and last field of the row", () => {
    expect(run(at(3, 1), { type: "home" })).toEqual(at(3, 0));
    expect(run(at(3, 1), { type: "end" })).toEqual(at(3, 2));
  });

  it("do nothing at the ends", () => {
    const first = at(3, 0);
    const last = at(3, 2);
    expect(run(first, { type: "home" })).toBe(first);
    expect(run(last, { type: "end" })).toBe(last);
  });

  it("select the first / last field of the first row with nothing selected", () => {
    expect(run(initialGridState, { type: "home" })).toEqual(at(0, 0));
    expect(run(initialGridState, { type: "end" })).toEqual(at(0, 2));
  });
});

describe("jumpRow", () => {
  it("jumps to the first and last row, keeping the column", () => {
    expect(run(at(2, 1), { type: "jumpRow", to: "first" })).toEqual(at(0, 1));
    expect(run(at(2, 1), { type: "jumpRow", to: "last" })).toEqual(at(4, 1));
  });

  it("selects in the first column with nothing selected", () => {
    expect(run(initialGridState, { type: "jumpRow", to: "last" })).toEqual(
      at(4, 0),
    );
  });

  it("does nothing when already there", () => {
    const state = at(4, 1);
    expect(run(state, { type: "jumpRow", to: "last" })).toBe(state);
  });
});

describe("startEdit", () => {
  it("starts editing without a seed (Enter, double-click)", () => {
    expect(run(at(1, 1), { type: "startEdit" })).toEqual(editing(1, 1, null));
  });

  it("starts editing with the typed character as the seed", () => {
    expect(run(at(1, 1), { type: "startEdit", seed: "a" })).toEqual(
      editing(1, 1, "a"),
    );
  });

  it("does nothing without an active cell", () => {
    expect(run(initialGridState, { type: "startEdit", seed: "a" })).toBe(
      initialGridState,
    );
  });

  it("does nothing while already editing", () => {
    const state = editing(1, 1, "a");
    expect(run(state, { type: "startEdit", seed: "b" })).toBe(state);
  });
});

describe("commitEdit", () => {
  const commitWith = (
    state: GridState,
    move: Extract<GridAction, { type: "commitEdit" }>["move"],
    ctx = CTX,
  ) => run(state, { type: "commitEdit", move }, ctx);

  it("ends editing in place without a move", () => {
    expect(commitWith(editing(2, 1, "x"), undefined)).toEqual(at(2, 1));
    expect(commitWith(editing(2, 1), null)).toEqual(at(2, 1));
  });

  it.each([
    ["down", at(3, 1)],
    ["up", at(1, 1)],
    ["right", at(2, 2)],
    ["left", at(2, 0)],
    ["tab", at(2, 2)],
    ["shiftTab", at(2, 0)],
  ] as const)("moves %s after committing", (move, expected) => {
    expect(commitWith(editing(2, 1, "x"), move)).toEqual(expected);
  });

  it("stays on the last row when committing down (Enter)", () => {
    expect(commitWith(editing(4, 1), "down")).toEqual(at(4, 1));
  });

  it("clamps up, left and right at the edges", () => {
    expect(commitWith(editing(0, 1), "up")).toEqual(at(0, 1));
    expect(commitWith(editing(1, 0), "left")).toEqual(at(1, 0));
    expect(commitWith(editing(1, 2), "right")).toEqual(at(1, 2));
  });

  it("tabs across rows after committing", () => {
    expect(commitWith(editing(1, 2), "tab")).toEqual(at(2, 0));
    expect(commitWith(editing(2, 0), "shiftTab")).toEqual(at(1, 2));
    expect(commitWith(editing(4, 2), "tab")).toEqual(at(4, 2));
    expect(commitWith(editing(0, 0), "shiftTab")).toEqual(at(0, 0));
  });

  it("does nothing when not editing", () => {
    const state = at(2, 1);
    expect(commitWith(state, "down")).toBe(state);
    expect(commitWith(initialGridState, "down")).toBe(initialGridState);
  });
});

describe("cancelEdit", () => {
  it("ends the edit and keeps the selection", () => {
    expect(run(editing(2, 1, "x"), { type: "cancelEdit" })).toEqual(at(2, 1));
  });

  it("does nothing when not editing", () => {
    const state = at(2, 1);
    expect(run(state, { type: "cancelEdit" })).toBe(state);
  });
});

describe("clear", () => {
  it("deselects, and ends any edit", () => {
    expect(run(at(2, 1), { type: "clear" })).toEqual(initialGridState);
    expect(run(editing(2, 1, "x"), { type: "clear" })).toEqual(
      initialGridState,
    );
  });

  it("does nothing when nothing is selected", () => {
    expect(run(initialGridState, { type: "clear" })).toBe(initialGridState);
  });
});

describe("clamp", () => {
  const clamp = (state: GridState, ctx: GridContext) =>
    run(state, { type: "clamp" }, ctx);

  it("leaves a cell that is still inside alone", () => {
    const state = at(2, 1);
    expect(clamp(state, CTX)).toBe(state);
    expect(clamp(editing(2, 1, "x"), CTX)).toEqual(editing(2, 1, "x"));
  });

  it("pulls the cell into the table when rows shrink", () => {
    expect(clamp(at(4, 1), { rowCount: 2, colCount: 3 })).toEqual(at(1, 1));
  });

  it("pulls the cell into the table when columns shrink", () => {
    expect(clamp(at(2, 2), { rowCount: 5, colCount: 1 })).toEqual(at(2, 0));
  });

  it("clamps both at once and ends an edit on a cell that moved", () => {
    expect(clamp(editing(4, 2, "x"), { rowCount: 1, colCount: 1 })).toEqual(
      at(0, 0),
    );
  });

  it("deselects when the table becomes empty", () => {
    expect(clamp(at(2, 1), { rowCount: 0, colCount: 3 })).toEqual(
      initialGridState,
    );
    expect(clamp(editing(2, 1), { rowCount: 5, colCount: 0 })).toEqual(
      initialGridState,
    );
  });

  it("does nothing with no active cell", () => {
    expect(clamp(initialGridState, EMPTY)).toBe(initialGridState);
  });
});

describe("empty table", () => {
  const actions: GridAction[] = [
    { type: "select", row: 0, col: 0 },
    { type: "move", dRow: 1, dCol: 1 },
    { type: "tab", shift: false },
    { type: "tab", shift: true },
    { type: "home" },
    { type: "end" },
    { type: "jumpRow", to: "first" },
    { type: "jumpRow", to: "last" },
    { type: "startEdit", seed: "a" },
    { type: "commitEdit", move: "down" },
    { type: "cancelEdit" },
    { type: "clear" },
    { type: "clamp" },
  ];

  it.each(actions.map((action) => [action.type, action] as const))(
    "%s is a no-op and keeps active null",
    (_type, action) => {
      expect(gridReducer(initialGridState, action, EMPTY)).toBe(
        initialGridState,
      );
    },
  );

  it("also holds with rows but no visible fields, and fields but no rows", () => {
    for (const ctx of [
      { rowCount: 5, colCount: 0 },
      { rowCount: 0, colCount: 3 },
    ]) {
      for (const action of actions) {
        expect(gridReducer(initialGridState, action, ctx).active).toBeNull();
      }
    }
  });
});

describe("a typing session", () => {
  it("type-to-edit, Tab to commit, Enter to edit and commit down, Escape to cancel", () => {
    let state = run(initialGridState, { type: "select", row: 0, col: 0 });
    state = run(state, { type: "startEdit", seed: "h" });
    expect(state).toEqual(editing(0, 0, "h"));
    state = run(state, { type: "commitEdit", move: "tab" });
    expect(state).toEqual(at(0, 1));
    state = run(state, { type: "startEdit" });
    state = run(state, { type: "commitEdit", move: "down" });
    expect(state).toEqual(at(1, 1));
    state = run(state, { type: "startEdit" });
    state = run(state, { type: "cancelEdit" });
    expect(state).toEqual(at(1, 1));
    state = run(state, { type: "clear" });
    expect(state).toEqual(initialGridState);
  });
});
