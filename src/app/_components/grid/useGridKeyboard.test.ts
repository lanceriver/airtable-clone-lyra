import { describe, expect, it } from "vitest";

import type { GridAction } from "./gridReducer";
import {
  keyCommand,
  type KeyCommand,
  type KeyEventLike,
} from "./useGridKeyboard";

const key = (k: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});
const act = (action: GridAction): KeyCommand => ({ type: "action", action });

const selected = { editing: false, hasActive: true };
const nothing = { editing: false, hasActive: false };
const editing = { editing: true, hasActive: true };

describe("keyCommand, not editing", () => {
  it.each([
    ["ArrowUp", { type: "move", dRow: -1, dCol: 0 }],
    ["ArrowDown", { type: "move", dRow: 1, dCol: 0 }],
    ["ArrowLeft", { type: "move", dRow: 0, dCol: -1 }],
    ["ArrowRight", { type: "move", dRow: 0, dCol: 1 }],
    ["Home", { type: "home" }],
    ["End", { type: "end" }],
    ["Enter", { type: "startEdit" }],
    ["Escape", { type: "clear" }],
    ["Tab", { type: "tab", shift: false }],
  ] as [string, GridAction][])("%s", (k, action) => {
    expect(keyCommand(key(k), selected)).toEqual(act(action));
  });

  it("Shift+Enter adds a record, with or without a selection", () => {
    const shiftEnter = key("Enter", { shiftKey: true });
    expect(keyCommand(shiftEnter, selected)).toEqual({ type: "addRecord" });
    expect(keyCommand(shiftEnter, nothing)).toEqual({ type: "addRecord" });
    expect(keyCommand(shiftEnter, editing)).toEqual(
      act({ type: "commitEdit", move: "down" }),
    );
  });

  it("Shift+Tab goes back", () => {
    expect(keyCommand(key("Tab", { shiftKey: true }), selected)).toEqual(
      act({ type: "tab", shift: true }),
    );
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])(
    "Ctrl / Cmd with arrows jumps (%o)",
    (mods) => {
      expect(keyCommand(key("ArrowUp", mods), selected)).toEqual(
        act({ type: "jumpRow", to: "first" }),
      );
      expect(keyCommand(key("ArrowDown", mods), selected)).toEqual(
        act({ type: "jumpRow", to: "last" }),
      );
      expect(keyCommand(key("ArrowLeft", mods), selected)).toEqual(
        act({ type: "home" }),
      );
      expect(keyCommand(key("ArrowRight", mods), selected)).toEqual(
        act({ type: "end" }),
      );
    },
  );

  it("Delete and Backspace clear the cell", () => {
    expect(keyCommand(key("Delete"), selected)).toEqual({ type: "clearCell" });
    expect(keyCommand(key("Backspace"), selected)).toEqual({
      type: "clearCell",
    });
  });

  it("a printable character starts editing with that seed", () => {
    expect(keyCommand(key("a"), selected)).toEqual(
      act({ type: "startEdit", seed: "a" }),
    );
    expect(keyCommand(key("A", { shiftKey: true }), selected)).toEqual(
      act({ type: "startEdit", seed: "A" }),
    );
    expect(keyCommand(key("7"), selected)).toEqual(
      act({ type: "startEdit", seed: "7" }),
    );
    expect(keyCommand(key(" "), selected)).toEqual(
      act({ type: "startEdit", seed: " " }),
    );
    expect(keyCommand(key("é"), selected)).toEqual(
      act({ type: "startEdit", seed: "é" }),
    );
    expect(keyCommand(key("😀"), selected)).toEqual(
      act({ type: "startEdit", seed: "😀" }),
    );
  });

  it("leaves shortcuts and non-printable keys to the browser", () => {
    expect(keyCommand(key("c", { ctrlKey: true }), selected)).toBeNull();
    expect(keyCommand(key("v", { metaKey: true }), selected)).toBeNull();
    expect(keyCommand(key("ArrowLeft", { altKey: true }), selected)).toBeNull();
    expect(keyCommand(key("F5"), selected)).toBeNull();
    expect(keyCommand(key("Shift"), selected)).toBeNull();
    expect(keyCommand(key("PageDown"), selected)).toBeNull();
  });

  it("with nothing selected, arrows, Home and End select; the rest is left alone", () => {
    expect(keyCommand(key("ArrowDown"), nothing)).toEqual(
      act({ type: "move", dRow: 1, dCol: 0 }),
    );
    expect(keyCommand(key("Home"), nothing)).toEqual(act({ type: "home" }));
    expect(keyCommand(key("Tab"), nothing)).toBeNull(); // focus may leave
    expect(keyCommand(key("Enter"), nothing)).toBeNull();
    expect(keyCommand(key("a"), nothing)).toBeNull();
    expect(keyCommand(key("Delete"), nothing)).toBeNull();
    expect(keyCommand(key("Escape"), nothing)).toBeNull();
  });
});

describe("keyCommand, editing", () => {
  it("Escape cancels, Enter commits and moves down", () => {
    expect(keyCommand(key("Escape"), editing)).toEqual(
      act({ type: "cancelEdit" }),
    );
    expect(keyCommand(key("Enter"), editing)).toEqual(
      act({ type: "commitEdit", move: "down" }),
    );
  });

  it("Tab and Shift+Tab commit and move", () => {
    expect(keyCommand(key("Tab"), editing)).toEqual(
      act({ type: "commitEdit", move: "tab" }),
    );
    expect(keyCommand(key("Tab", { shiftKey: true }), editing)).toEqual(
      act({ type: "commitEdit", move: "shiftTab" }),
    );
  });

  it("up and down commit and move", () => {
    expect(keyCommand(key("ArrowDown"), editing)).toEqual(
      act({ type: "commitEdit", move: "down" }),
    );
    expect(keyCommand(key("ArrowUp"), editing)).toEqual(
      act({ type: "commitEdit", move: "up" }),
    );
  });

  it("ignores everything else", () => {
    for (const k of [
      "ArrowLeft",
      "ArrowRight",
      "a",
      "Delete",
      "Backspace",
      "Home",
    ]) {
      expect(keyCommand(key(k), editing)).toBeNull();
    }
    expect(keyCommand(key("ArrowDown", { ctrlKey: true }), editing)).toBeNull();
  });
});
