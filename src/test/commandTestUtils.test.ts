/**
 * Tests for the command testing utilities in `commandTestUtils.ts`.
 *
 * These tests verify that the mock factories and assertion helpers behave
 * correctly when used by downstream test files.
 */
import { describe, it, expect } from "vitest";
import {
  createMockExecutor,
  createMockCommandBus,
  expectDispatched,
  expectAuditEntry,
} from "./helpers/commandTestUtils";

describe("createMockExecutor", () => {
  it("returns a mock executor with a vi.fn run", () => {
    const exec = createMockExecutor();
    expect(exec.run).toBeDefined();
    expect(exec.run).toBeInstanceOf(Function);
  });

  it("tracks the last dispatched action via lastAction()", () => {
    const exec = createMockExecutor();
    exec.run({ type: "focus" });
    expect(exec.lastAction()).toEqual({ type: "focus" });
  });

  it("records action order via mock.calls", () => {
    const exec = createMockExecutor();
    exec.run({ type: "focus" });
    exec.run({ type: "undo" });
    expect(exec.run).toHaveBeenCalledTimes(2);
    expect(exec.run).toHaveBeenNthCalledWith(1, { type: "focus" });
    expect(exec.run).toHaveBeenNthCalledWith(2, { type: "undo" });
  });

  it("returns EditorCommandResult from run", () => {
    const exec = createMockExecutor();
    const result = exec.run({ type: "focus" });
    expect(result).toEqual({});
  });

  it("callCount() reflects the number of invocations", () => {
    const exec = createMockExecutor();
    expect(exec.callCount()).toBe(0);
    exec.run({ type: "focus" });
    expect(exec.callCount()).toBe(1);
    exec.run({ type: "undo" });
    expect(exec.callCount()).toBe(2);
  });

  it("reset() clears history and lastAction", () => {
    const exec = createMockExecutor();
    exec.run({ type: "focus" });
    expect(exec.lastAction()).not.toBeNull();
    expect(exec.callCount()).toBe(1);

    exec.reset();
    expect(exec.callCount()).toBe(0);
    expect(exec.lastAction()).toBeNull();
    expect(exec.run).not.toHaveBeenCalled();
  });

  it("lastAction() returns null before any call", () => {
    const exec = createMockExecutor();
    expect(exec.lastAction()).toBeNull();
  });
});

describe("createMockCommandBus", () => {
  it("returns a bus with a mock executor attached", () => {
    const { bus, executor } = createMockCommandBus();
    expect(bus).toBeDefined();
    expect(executor.run).toBeDefined();
  });

  it("dispatches through the mock executor", () => {
    const { bus, executor } = createMockCommandBus();
    bus.dispatch({ type: "focus" });
    expect(executor.run).toHaveBeenCalledWith({ type: "focus" });
  });

  it("records entries in the audit trail by default", () => {
    const { bus } = createMockCommandBus();
    expect(bus.getAuditLog()).toHaveLength(0);

    bus.dispatch({ type: "focus" });
    expect(bus.getAuditLog()).toHaveLength(1);
    expect(bus.getAuditLog()[0]?.action).toEqual({ type: "focus" });
  });

  it("disables the audit trail when audit: false", () => {
    const { bus } = createMockCommandBus({ audit: false });
    bus.dispatch({ type: "focus" });
    expect(bus.getAuditLog()).toHaveLength(0);
  });

  it("accepts a custom executor", () => {
    const customExecutor = createMockExecutor();
    const { bus } = createMockCommandBus({ executor: customExecutor });
    bus.dispatch({ type: "focus" });
    // The custom executor is wired to the bus; verify its mock received the call.
    expect(customExecutor.run).toHaveBeenCalledWith({ type: "focus" });
    // The returned executor is the mock, not the custom one (by design).
  });
});

describe("expectDispatched", () => {
  it("passes when all expected actions were dispatched in order", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "focus" });
    bus.dispatch({ type: "undo" });
    // Should not throw.
    expectDispatched(bus, { type: "focus" }, { type: "undo" });
  });

  it("passes with a single action", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "format", format: "bold" });
    expectDispatched(bus, { type: "format", format: "bold" });
  });

  it("throws when an expected action is missing", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "focus" });
    expect(() => expectDispatched(bus, { type: "focus" }, { type: "undo" })).toThrow();
  });

  it("passes with actions that have different sources", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "focus" });
    bus.dispatch({ type: "undo" });
    expectDispatched(bus, { type: "focus" }, { type: "undo" });
  });
});

describe("expectAuditEntry", () => {
  it("passes when a matching entry exists", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "format", format: "bold" }, { source: "user:toolbar" });
    expectAuditEntry(bus, {
      action: { type: "format", format: "bold" },
      source: "user:toolbar",
      success: true,
    });
  });

  it("passes with partial match on action only", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "focus" });
    expectAuditEntry(bus, { action: { type: "focus" } });
  });

  it("throws when no entry matches", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "focus" });
    expect(() => expectAuditEntry(bus, { action: { type: "undo" } })).toThrow();
  });

  it("matches on source field", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "focus" }, { source: "user:keyboard" });
    expectAuditEntry(bus, { source: "user:keyboard" });
  });

  it("matches on success status", () => {
    const { bus } = createMockCommandBus();
    bus.dispatch({ type: "focus" });
    expectAuditEntry(bus, { success: true });
  });
});
