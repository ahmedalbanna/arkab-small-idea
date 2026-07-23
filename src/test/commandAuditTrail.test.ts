/**
 * Tests for the command audit trail (`CommandAuditTrail`) and its integration
 * with `EditorCommandBus` (dispatch recording, source tagging).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandAuditTrail } from "../core/commands/auditTrail";
import { EditorCommandBus } from "../core/commands/commandBus";
import type { EditorCommandAction, EditorCommandResult } from "../core/commands/commandBus";
import type { CommandSource } from "../core/commands/auditTrail";

// ---------------------------------------------------------------------------
// 1. CommandAuditTrail unit tests
// ---------------------------------------------------------------------------

describe("CommandAuditTrail", () => {
  it("records an entry with auto-generated id and timestamp", () => {
    const trail = new CommandAuditTrail();
    const entry = trail.record({
      action: { type: "focus" },
      source: "user:keyboard",
      success: true,
    });
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("1");
    expect(entry!.timestamp).toBeGreaterThan(0);
    expect(entry!.action).toEqual({ type: "focus" });
    expect(entry!.source).toBe("user:keyboard");
    expect(entry!.success).toBe(true);
  });

  it("increments ids for each entry", () => {
    const trail = new CommandAuditTrail();
    const e1 = trail.record({ action: { type: "undo" }, source: "user:keyboard", success: true });
    const e2 = trail.record({ action: { type: "redo" }, source: "user:keyboard", success: true });
    expect(e1!.id).toBe("1");
    expect(e2!.id).toBe("2");
  });

  it("respects maxEntries limit", () => {
    const trail = new CommandAuditTrail({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      trail.record({ action: { type: "focus" }, source: "system", success: true });
    }
    expect(trail.size).toBe(3);
    // The oldest entries should have been dropped; only the last 3 remain.
    const recent = trail.getRecent();
    expect(recent[0].id).toBe("3");
    expect(recent[2].id).toBe("5");
  });

  it("filters by source", () => {
    const trail = new CommandAuditTrail();
    trail.record({ action: { type: "undo" }, source: "ai", success: true });
    trail.record({ action: { type: "undo" }, source: "user:keyboard", success: true });
    trail.record({ action: { type: "focus" }, source: "system", success: true });

    expect(trail.getBySource("ai")).toHaveLength(1);
    expect(trail.getBySource("user:keyboard")).toHaveLength(1);
    expect(trail.getBySource("system")).toHaveLength(1);
    expect(trail.getBySource("user:toolbar")).toHaveLength(0);
  });

  it("clears all entries", () => {
    const trail = new CommandAuditTrail();
    trail.record({ action: { type: "focus" }, source: "system", success: true });
    trail.record({ action: { type: "focus" }, source: "system", success: true });
    expect(trail.size).toBe(2);

    trail.clear();
    expect(trail.size).toBe(0);
    expect(trail.getRecent()).toHaveLength(0);
  });

  it("returns null when disabled", () => {
    const trail = new CommandAuditTrail({ enabled: false });
    const entry = trail.record({
      action: { type: "focus" },
      source: "system",
      success: true,
    });
    expect(entry).toBeNull();
    expect(trail.size).toBe(0);
  });

  it("getRecent returns correct slice", () => {
    const trail = new CommandAuditTrail({ maxEntries: 10 });
    for (let i = 0; i < 5; i++) {
      trail.record({ action: { type: "focus" }, source: "system", success: true });
    }
    // All entries
    expect(trail.getRecent()).toHaveLength(5);
    // Only last 2
    expect(trail.getRecent(2)).toHaveLength(2);
    expect(trail.getRecent(2)[0].id).toBe("4");
  });

  it("includes duration when provided", () => {
    const trail = new CommandAuditTrail();
    const entry = trail.record({
      action: { type: "format", format: "bold" },
      source: "user:toolbar",
      success: true,
      duration: 1.5,
    });
    expect(entry!.duration).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// 2. EditorCommandBus audit integration
// ---------------------------------------------------------------------------

describe("EditorCommandBus audit integration", () => {
  let bus: EditorCommandBus;
  let exec: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    bus = new EditorCommandBus({ audit: { enabled: true } });
    // Properly typed mock: vi.fn with explicit signature.
    const run = vi.fn<(action: EditorCommandAction) => EditorCommandResult>(() => ({}));
    exec = { run };
    bus.setExecutor(exec as any);
  });

  it("records an audit entry when dispatching", () => {
    bus.dispatch({ type: "focus" }, { source: "user:keyboard" });
    const log = bus.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].action).toEqual({ type: "focus" });
    expect(log[0].source).toBe("user:keyboard");
    expect(log[0].success).toBe(true);
    expect(log[0].duration).toBeGreaterThanOrEqual(0);
  });

  it("defaults source to 'system' when not provided", () => {
    bus.dispatch({ type: "focus" });
    const log = bus.getAuditLog();
    expect(log[0].source).toBe("system");
  });

  it("records success when executor runs without throwing", () => {
    exec.run.mockImplementation(() => ({ value: "ok" }));
    bus.dispatch({ type: "format", format: "bold" }, { source: "user:toolbar" });
    const log = bus.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].success).toBe(true);
  });

  it("records failure when executor throws", () => {
    const error = new Error("executor failed");
    exec.run.mockImplementation(() => {
      throw error;
    });

    expect(() => {
      bus.dispatch({ type: "format", format: "bold" });
    }).toThrow(error);

    const log = bus.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].success).toBe(false);
    expect(log[0].duration).toBeGreaterThanOrEqual(0);
  });

  it("getAuditLog returns entries in order", () => {
    bus.dispatch({ type: "focus" }, { source: "user:keyboard" });
    bus.dispatch({ type: "undo" }, { source: "user:keyboard" });
    bus.dispatch({ type: "redo" }, { source: "user:keyboard" });

    const log = bus.getAuditLog();
    expect(log).toHaveLength(3);
    expect(log[0].action).toEqual({ type: "focus" });
    expect(log[1].action).toEqual({ type: "undo" });
    expect(log[2].action).toEqual({ type: "redo" });
  });

  it("returns empty log when audit trail is disabled", () => {
    const noAuditBus = new EditorCommandBus({ audit: { enabled: false } });
    noAuditBus.setExecutor(exec as any);
    noAuditBus.dispatch({ type: "focus" });
    expect(noAuditBus.getAuditLog()).toHaveLength(0);
  });

  it("does not record audit entries for queries", () => {
    // Queries are not wrapped with audit recording — only dispatch.
    bus.query({ type: "getHeadings" });
    expect(bus.getAuditLog()).toHaveLength(0);
  });

  it("handles all CommandSource values", () => {
    const sources: CommandSource[] = [
      "user:keyboard",
      "user:toolbar",
      "user:slash",
      "user:context",
      "user:palette",
      "plugin",
      "ai",
      "system",
    ];

    for (const source of sources) {
      bus.dispatch({ type: "focus" }, { source });
    }

    const log = bus.getAuditLog();
    expect(log).toHaveLength(sources.length);
    for (let i = 0; i < sources.length; i++) {
      expect(log[i].source).toBe(sources[i]);
    }
  });
});
