/**
 * Tests for the CommandInspector devtools class.
 *
 * Verifies that the inspector correctly reads from the command bus and
 * registered command list to produce snapshots, search/filter results,
 * and trace diagnostics.
 */
import { describe, it, expect } from "vitest";
import { EditorCommandBus } from "../core/commands/commandBus";
import { CommandInspector } from "../plugins/devtools/commandInspector";
import { createMockExecutor } from "./helpers/commandTestUtils";
import type { EditorCommand } from "../plugins/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_COMMANDS: EditorCommand[] = [
  {
    id: "bold",
    label: "Bold",
    key: "Mod-b",
    run: () => true,
    slash: true,
  },
  {
    id: "italic",
    label: "Italic",
    key: "Mod-i",
    run: () => true,
    slash: true,
  },
  {
    id: "undo",
    label: "Undo",
    key: "Mod-z",
    run: () => true,
  },
  {
    id: "dev:inspect",
    label: "Open Command Inspector",
    key: "Mod-Shift-i",
    run: () => true,
  },
];

function createBusWithEntries(): EditorCommandBus {
  const bus = new EditorCommandBus({ audit: { enabled: true } });
  const exec = createMockExecutor();
  bus.setExecutor(exec);
  bus.dispatch({ type: "focus" }, { source: "user:keyboard" });
  bus.dispatch({ type: "format", format: "bold" }, { source: "user:toolbar" });
  bus.dispatch({ type: "undo" }, { source: "user:keyboard" });
  return bus;
}

describe("CommandInspector", () => {
  describe("constructor", () => {
    it("creates an inspector with bus and optional commands", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus);
      expect(inspector).toBeInstanceOf(CommandInspector);
    });

    it("accepts commands at construction time", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const snap = inspector.snapshot();
      expect(snap.commands).toHaveLength(4);
    });
  });

  describe("snapshot", () => {
    it("returns a BusSnapshot with the correct shape", () => {
      const bus = createBusWithEntries();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const snap = inspector.snapshot();

      expect(snap).toHaveProperty("commands");
      expect(snap).toHaveProperty("recentDispatches");
      expect(snap).toHaveProperty("executorAttached");
      expect(snap).toHaveProperty("auditSize");
    });

    it("maps commands to CommandInfo with correct fields", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const snap = inspector.snapshot();

      const bold = snap.commands.find((c) => c.id === "bold");
      expect(bold).toBeDefined();
      expect(bold?.key).toBe("Mod-b");
      expect(bold?.label).toBe("Bold");
      expect(bold?.source).toBe("unknown");
      expect(bold?.slash).toBe(true);
      expect(bold?.hasKeybinding).toBe(true);

      const undo = snap.commands.find((c) => c.id === "undo");
      expect(undo?.slash).toBeUndefined();
      expect(undo?.hasKeybinding).toBe(true);
    });

    it("recentDispatches returns the most recent 10 entries", () => {
      const bus = createBusWithEntries();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const snap = inspector.snapshot();

      expect(snap.recentDispatches).toHaveLength(3);
      expect(snap.recentDispatches[0]?.action).toEqual({ type: "focus" });
    });

    it("auditSize reflects total entries in the trail", () => {
      const bus = createBusWithEntries();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      expect(inspector.snapshot().auditSize).toBe(3);
    });

    it("executorAttached is true when entries exist", () => {
      const bus = createBusWithEntries();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      expect(inspector.snapshot().executorAttached).toBe(true);
    });

    it("executorAttached is false when no entries exist", () => {
      const bus = new EditorCommandBus({ audit: { enabled: true } });
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      expect(inspector.snapshot().executorAttached).toBe(false);
    });
  });

  describe("updateCommands", () => {
    it("replaces the registered command list", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus);
      expect(inspector.snapshot().commands).toHaveLength(0);

      inspector.updateCommands(SAMPLE_COMMANDS);
      expect(inspector.snapshot().commands).toHaveLength(4);
    });
  });

  describe("setCommandSource", () => {
    it("tags a command with a source for display", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      inspector.setCommandSource("dev:inspect", "plugin");

      const cmd = inspector.snapshot().commands.find((c) => c.id === "dev:inspect");
      expect(cmd?.source).toBe("plugin");
    });

    it("leaves untagged commands as 'unknown'", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);

      const cmd = inspector.snapshot().commands.find((c) => c.id === "bold");
      expect(cmd?.source).toBe("unknown");
    });
  });

  describe("search", () => {
    it("finds commands by id (case-insensitive)", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const results = inspector.search("BOLD");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("bold");
    });

    it("finds commands by label", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const results = inspector.search("Italic");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("italic");
    });

    it("finds commands by keybinding", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const results = inspector.search("Mod-z");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("undo");
    });

    it("returns empty array when no match", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      expect(inspector.search("nonexistent")).toHaveLength(0);
    });

    it("returns multiple matches for partial ids", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const results = inspector.search("i");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("filterBySource", () => {
    it("filters audit entries by source and returns unique command types", () => {
      const bus = createBusWithEntries();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const results = inspector.filterBySource("user:keyboard");

      // We dispatched focus (keyboard), bold (toolbar), undo (keyboard)
      // So keyboard-sourced entries: focus, undo → 2 unique types
      expect(results.length).toBeGreaterThanOrEqual(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain("focus");
      expect(ids).toContain("undo");
    });

    it("returns empty array when source has no entries", () => {
      const bus = createBusWithEntries();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const results = inspector.filterBySource("user:slash");
      expect(results).toHaveLength(0);
    });

    it("returns unique action types only (no duplicates)", () => {
      const bus = new EditorCommandBus({ audit: { enabled: true } });
      const exec = createMockExecutor();
      bus.setExecutor(exec);
      bus.dispatch({ type: "focus" }, { source: "user:keyboard" });
      bus.dispatch({ type: "focus" }, { source: "user:keyboard" });

      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const results = inspector.filterBySource("user:keyboard");
      expect(results).toHaveLength(1);
    });
  });

  describe("traceDispatch", () => {
    it("returns valid=true for a valid action", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const result = inspector.traceDispatch({ type: "focus" });
      expect(result.valid).toBe(true);
    });

    it("returns valid=false for an invalid action", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const result = inspector.traceDispatch({ type: "INVALID" as never });
      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues!.length).toBeGreaterThan(0);
    });

    it("returns matching entry when action is in audit trail", () => {
      const bus = createBusWithEntries();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const result = inspector.traceDispatch({ type: "focus" });
      expect(result.valid).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.action).toEqual({ type: "focus" });
      expect(result.source).toBe("user:keyboard");
    });

    it("returns no entry when action is not in audit trail", () => {
      const bus = createBusWithEntries();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const result = inspector.traceDispatch({ type: "insertText", before: "hello" });
      expect(result.valid).toBe(true);
      expect(result.entry).toBeUndefined();
      expect(result.source).toBeUndefined();
    });

    it("handles invalid JSON-like structures gracefully", () => {
      const bus = new EditorCommandBus();
      const inspector = new CommandInspector(bus, SAMPLE_COMMANDS);
      const result = inspector.traceDispatch({} as never);
      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
    });
  });
});
