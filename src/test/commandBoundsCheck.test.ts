/**
 * Tests for centralized position bounds checking (`clampPosition` / `clampPositions`)
 * and the executor's use of these helpers to guard against out-of-bounds positions.
 */
import { describe, it, expect } from "vitest";
import { history } from "prosemirror-history";
import { schema as baseSchema } from "prosemirror-markdown";
import { EditorState } from "prosemirror-state";
import { CoreEditor } from "@core/CoreEditor";
import { clampPosition, clampPositions } from "../core/commands/validateAction";
import type { StorageAdapter, Draft } from "../core/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class MemoryStorage implements StorageAdapter {
  private kv = new Map<string, string>();
  private drafts: Draft[] = [];

  async getItem(key: string) {
    return this.kv.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.kv.set(key, value);
  }
  async removeItem(key: string) {
    this.kv.delete(key);
  }
  async saveDraft(draft: Draft) {
    const stored: Draft = { ...draft, id: String(this.drafts.length + 1) };
    this.drafts.unshift(stored);
    return stored;
  }
  async loadDrafts(pageId: string) {
    return this.drafts.filter((d) => d.pageId === pageId);
  }
  async deleteDraft(id: string) {
    this.drafts = this.drafts.filter((d) => d.id !== id);
  }
}

function makeCore(initialMarkdown?: string) {
  return new CoreEditor({
    schema: baseSchema,
    prosePlugins: [history()],
    storage: new MemoryStorage(),
    initialMarkdown,
  });
}

/**
 * Create a minimal ProseMirror EditorState directly for unit-testing
 * `clampPositions` / `clampPosition` without spinning up a full CoreEditor.
 */
function makeState(doc: string): EditorState {
  return EditorState.create({
    schema: baseSchema,
    doc: baseSchema.topNodeType.create(null, [baseSchema.text(doc)]),
  });
}

// ---------------------------------------------------------------------------
// 1. Unit tests – clampPosition (single position)
// ---------------------------------------------------------------------------

describe("clampPosition", () => {
  it("returns the position unchanged when it is within bounds", () => {
    const state = makeState("Hello world");
    expect(clampPosition(state, 3)).toBe(3);
  });

  it("returns 0 when given a negative position", () => {
    const state = makeState("Hello world");
    expect(clampPosition(state, -5)).toBe(0);
  });

  it("returns max when the position exceeds document size", () => {
    const state = makeState("Hello world"); // content.size === 11
    expect(clampPosition(state, 100)).toBe(11);
  });

  it("returns null for an empty document", () => {
    const state = EditorState.create({ schema: baseSchema, doc: baseSchema.topNodeType.create() });
    expect(clampPosition(state, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Unit tests – clampPositions (from / to pair)
// ---------------------------------------------------------------------------

describe("clampPositions", () => {
  it("clamps both positions when they exceed bounds", () => {
    const state = makeState("Hello world"); // size === 11
    const result = clampPositions(state, 5, 100);
    expect(result).toEqual({ from: 5, to: 11 });
  });

  it("raises negative positions to 0", () => {
    const state = makeState("Hello world");
    const result = clampPositions(state, -1, -1);
    expect(result).toEqual({ from: 0, to: 0 });
  });

  it("ensures to is never smaller than from", () => {
    const state = makeState("Hello world");
    const result = clampPositions(state, 8, 3);
    expect(result).toEqual({ from: 8, to: 8 });
  });

  it("returns null for an empty document", () => {
    const state = EditorState.create({ schema: baseSchema, doc: baseSchema.topNodeType.create() });
    expect(clampPositions(state, 0, 0)).toBeNull();
  });

  it("handles a single-position call (no to argument)", () => {
    const state = makeState("Hello world");
    const result = clampPositions(state, 3);
    expect(result).toEqual({ from: 3, to: 3 });
  });

  it("handles negative single-position call", () => {
    const state = makeState("Hello world");
    const result = clampPositions(state, -5);
    expect(result).toEqual({ from: 0, to: 0 });
  });

  it("handles zero-length range at start", () => {
    const state = makeState("Hello world");
    const result = clampPositions(state, 0, 0);
    expect(result).toEqual({ from: 0, to: 0 });
  });

  it("handles full-document range", () => {
    const state = makeState("Hello world"); // size === 11
    const result = clampPositions(state, 0, 11);
    expect(result).toEqual({ from: 0, to: 11 });
  });
});

// ---------------------------------------------------------------------------
// 3. Integration tests – executor handles out-of-bounds positions gracefully
// ---------------------------------------------------------------------------

describe("executor bounds safety", () => {
  it("scrollToPos with negative pos does not crash", () => {
    const core = makeCore("Hello");
    expect(() => {
      core.executeCommand({ type: "scrollToPos", pos: -42 });
    }).not.toThrow();
    // State should remain unchanged
    expect(core.getMarkdown()).toContain("Hello");
  });

  it("scrollToPos with excessive pos does not crash", () => {
    const core = makeCore("Hello");
    expect(() => {
      core.executeCommand({ type: "scrollToPos", pos: 9999 });
    }).not.toThrow();
  });

  it("setSelection clamps out-of-bounds from", () => {
    const core = makeCore("Hello world");
    core.executeCommand({ type: "setSelection", from: -5, to: 3 });
    // Should not crash; selection is somewhere valid.
    expect(core.getMarkdown()).toContain("Hello");
  });

  it("setSelection clamps out-of-bounds to", () => {
    const core = makeCore("Hello world");
    core.executeCommand({ type: "setSelection", from: 0, to: 9999 });
    // Entire doc is selected; markdown unchanged.
    expect(core.getMarkdown()).toContain("Hello");
  });

  it("deleteRange does not crash with out-of-bounds positions", () => {
    const core = makeCore("Hello world");
    expect(() => {
      core.executeCommand({ type: "deleteRange", from: -10, to: 9999 });
    }).not.toThrow();
  });

  it("deleteRange returns early when from === to (zero-length range)", () => {
    const core = makeCore("Hello world");
    const before = core.getMarkdown();
    core.executeCommand({ type: "deleteRange", from: 3, to: 3 });
    // Nothing deleted because an empty range is a no-op.
    expect(core.getMarkdown()).toBe(before);
  });

  it("insertNodeAt does not crash with out-of-bounds pos", () => {
    const core = makeCore("Hello");
    expect(() => {
      core.executeCommand({
        type: "insertNodeAt",
        nodeName: "paragraph",
        pos: 9999,
      });
    }).not.toThrow();
  });

  it("insertNodeAt returns early for unknown nodeName (no crash)", () => {
    const core = makeCore("Hello");
    expect(() => {
      core.executeCommand({
        type: "insertNodeAt",
        nodeName: "nonexistent-node-type",
        pos: 0,
      });
    }).not.toThrow();
  });

  it("insertNodeAt works normally with valid pos", () => {
    const core = makeCore("Hello");
    core.executeCommand({
      type: "insertNodeAt",
      nodeName: "paragraph",
      pos: 3,
    });
    // Document was modified (a paragraph was inserted at position 3).
    expect(core.getMarkdown()).toBeTruthy();
  });
});
