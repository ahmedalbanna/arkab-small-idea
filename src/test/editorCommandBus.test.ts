import { describe, it, expect, vi } from "vitest";
import {
  EditorCommandBus,
  type EditorCommandAction,
  type EditorCommandResult,
} from "../plugins/editorCommandBus";

function mockExecutor(
  run?: (a: EditorCommandAction) => EditorCommandResult,
): { run: ReturnType<typeof vi.fn<(a: EditorCommandAction) => EditorCommandResult>> } {
  const fn = vi.fn<(a: EditorCommandAction) => EditorCommandResult>(
    run ??
      ((a: EditorCommandAction) =>
        a.type === "setMarkdown"
          ? { inverse: { type: "setMarkdown", content: "BEFORE" } }
          : {}),
  );
  return { run: fn };
}

describe("EditorCommandBus", () => {
  it("dispatch routes to the executor and records undoable commands", () => {
    const { run } = mockExecutor();
    const bus = new EditorCommandBus();
    bus.setExecutor({ run });
    bus.dispatch({ type: "setMarkdown", content: "# Hi" });
    expect(run).toHaveBeenCalledWith({
      type: "setMarkdown",
      content: "# Hi",
    });
    expect(bus.canUndo).toBe(true);
    expect(bus.canRedo).toBe(false);
  });

  it("query returns the executor's value", () => {
    const bus = new EditorCommandBus();
    bus.setExecutor({
      run: (a) =>
        a.type === "getHtml" ? { value: "<p>x</p>" } : { value: undefined },
    });
    expect(bus.query<string>({ type: "getHtml" })).toBe("<p>x</p>");
  });

  it("undo replays the inverse, redo replays the original (LIFO ordering)", () => {
    const types: string[] = [];
    const bus = new EditorCommandBus();
    bus.setExecutor({
      run: (a) => {
        types.push(a.type);
        if (a.type === "setMarkdown")
          return { inverse: { type: "setMarkdown", content: "BEFORE" } };
        return {};
      },
    });

    bus.dispatch({ type: "setMarkdown", content: "ONE" });
    bus.dispatch({ type: "setMarkdown", content: "TWO" });

    bus.undo(); // inverse of TWO
    bus.undo(); // inverse of ONE
    bus.redo(); // re-run ONE
    bus.redo(); // re-run TWO

    expect(types).toEqual([
      "setMarkdown", // dispatch ONE
      "setMarkdown", // dispatch TWO
      "setMarkdown", // undo TWO (inverse)
      "setMarkdown", // undo ONE (inverse)
      "setMarkdown", // redo ONE
      "setMarkdown", // redo TWO
    ]);
    expect(bus.canRedo).toBe(false); // redo stack exhausted
    expect(bus.canUndo).toBe(true);  // both back in undo stack
  });

  it("dispatching a new command after undo clears the redo stack", () => {
    const bus = new EditorCommandBus();
    bus.setExecutor({
      run: () => ({ inverse: { type: "setMarkdown", content: "" } }),
    });

    bus.dispatch({ type: "setMarkdown", content: "A" });
    bus.dispatch({ type: "setMarkdown", content: "B" });
    bus.undo();                        // back to A
    expect(bus.canRedo).toBe(true);

    bus.dispatch({ type: "setMarkdown", content: "C" }); // new branch
    expect(bus.canRedo).toBe(false);   // redo stack cleared
  });

  it("non-undoable commands (no inverse) are not recorded", () => {
    const bus = new EditorCommandBus();
    bus.setExecutor({ run: () => ({}) }); // never returns an inverse

    bus.dispatch({ type: "format", format: "bold" });
    bus.dispatch({ type: "focus" });
    expect(bus.canUndo).toBe(false);
  });

  it("clearHistory resets both undo and redo stacks", () => {
    const bus = new EditorCommandBus();
    bus.setExecutor({ run: () => ({ inverse: { type: "setMarkdown", content: "" } }) });
    bus.dispatch({ type: "setMarkdown", content: "x" });
    bus.clearHistory();
    expect(bus.canUndo).toBe(false);
    expect(bus.canRedo).toBe(false);
  });

  it("dispatch / query are safe no-ops without an executor", () => {
    const bus = new EditorCommandBus();
    expect(() =>
      bus.dispatch({ type: "setMarkdown", content: "x" }),
    ).not.toThrow();
    expect(bus.query({ type: "getHtml" })).toBeUndefined();
  });

  it("query defaults to query<T> returning undefined without executor", () => {
    const bus = new EditorCommandBus();
    expect(bus.query<string>({ type: "getHeadings" })).toBeUndefined();
  });
});
