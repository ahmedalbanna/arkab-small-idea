import { describe, it, expect, vi } from "vitest";
import {
  EditorCommandBus,
  type EditorCommandAction,
  type EditorCommandResult,
} from "../plugins/editorCommandBus";

function mockExecutor(run?: (a: EditorCommandAction) => EditorCommandResult): {
  run: ReturnType<typeof vi.fn<(a: EditorCommandAction) => EditorCommandResult>>;
} {
  const fn = vi.fn<(a: EditorCommandAction) => EditorCommandResult>(
    run ?? ((_a: EditorCommandAction) => ({})),
  );
  return { run: fn };
}

describe("EditorCommandBus (Bus-Centric)", () => {
  it("dispatch routes to the executor", () => {
    const { run } = mockExecutor();
    const bus = new EditorCommandBus();
    bus.setExecutor({ run });
    bus.dispatch({ type: "setMarkdown", content: "# Hi" });
    expect(run).toHaveBeenCalledWith({
      type: "setMarkdown",
      content: "# Hi",
    });
  });

  it("query returns the executor's value", () => {
    const bus = new EditorCommandBus();
    bus.setExecutor({
      run: (a) => (a.type === "getHtml" ? { value: "<p>x</p>" } : { value: undefined }),
    });
    expect(bus.query<string>({ type: "getHtml" })).toBe("<p>x</p>");
  });

  it('dispatch forwards "undo" action type to the executor', () => {
    const { run } = mockExecutor();
    const bus = new EditorCommandBus();
    bus.setExecutor({ run });
    bus.dispatch({ type: "undo" });
    expect(run).toHaveBeenCalledWith({ type: "undo" });
  });

  it('dispatch forwards "redo" action type to the executor', () => {
    const { run } = mockExecutor();
    const bus = new EditorCommandBus();
    bus.setExecutor({ run });
    bus.dispatch({ type: "redo" });
    expect(run).toHaveBeenCalledWith({ type: "redo" });
  });

  it("non-undoable commands (no inverse) are dispatched without error", () => {
    const { run } = mockExecutor(() => ({}));
    const bus = new EditorCommandBus();
    bus.setExecutor({ run });
    bus.dispatch({ type: "format", format: "bold" });
    bus.dispatch({ type: "focus" });
    // No properties to assert beyond the calls themselves
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("dispatch / query are safe no-ops without an executor", () => {
    const bus = new EditorCommandBus();
    expect(() => bus.dispatch({ type: "setMarkdown", content: "x" })).not.toThrow();
    expect(bus.query({ type: "getHtml" })).toBeUndefined();
  });

  it("query defaults to query<T> returning undefined without executor", () => {
    const bus = new EditorCommandBus();
    expect(bus.query<string>({ type: "getHeadings" })).toBeUndefined();
  });
});
