import { describe, it, expect } from "vitest";
import { EditorCommandBus } from "../core/commands/commandBus";
import { createMockCommandBus } from "./helpers/commandTestUtils";

describe("EditorCommandBus (Bus-Centric)", () => {
  it("dispatch routes to the executor", () => {
    const { bus, executor } = createMockCommandBus();
    bus.dispatch({ type: "setMarkdown", content: "# Hi" });
    expect(executor.run).toHaveBeenCalledWith({
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
    const { bus, executor } = createMockCommandBus();
    bus.dispatch({ type: "undo" });
    expect(executor.run).toHaveBeenCalledWith({ type: "undo" });
  });

  it('dispatch forwards "redo" action type to the executor', () => {
    const { bus, executor } = createMockCommandBus();
    bus.dispatch({ type: "redo" });
    expect(executor.run).toHaveBeenCalledWith({ type: "redo" });
  });

  it("non-undoable commands (no inverse) are dispatched without error", () => {
    const { bus, executor } = createMockCommandBus();
    bus.dispatch({ type: "format", format: "bold" });
    bus.dispatch({ type: "focus" });
    expect(executor.run).toHaveBeenCalledTimes(2);
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
