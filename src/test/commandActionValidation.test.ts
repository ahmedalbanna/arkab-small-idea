/**
 * Tests for runtime validation of `EditorCommandAction` via Zod schema.
 *
 * Two layers of testing:
 * 1. Schema-level: each `EditorCommandAction` variant is accepted / rejected
 *    correctly by `EditorCommandActionSchema`.
 * 2. Bus-level: `EditorCommandBus.dispatch` and `.query` log warnings on
 *    invalid actions and (in strict mode) skip them entirely.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EditorCommandActionSchema, formatZodIssues } from "../core/commands/actionSchema";
import { EditorCommandBus } from "../core/commands/commandBus";
import { createMockExecutor } from "./helpers/commandTestUtils";
import type { MockExecutor } from "./helpers/commandTestUtils";

// ---------------------------------------------------------------------------
// 1. Schema-level validation
// ---------------------------------------------------------------------------

describe("EditorCommandActionSchema", () => {
  // ── Actions ──

  it("accepts { type: 'focus' }", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "focus" }).success).toBe(true);
  });

  it("accepts { type: 'format', format }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "format",
        format: "bold",
      }).success,
    ).toBe(true);
  });

  it("rejects { type: 'format' } with empty format", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "format", format: "" }).success).toBe(false);
  });

  it("rejects { type: 'format' } with unknown format name", () => {
    expect(
      EditorCommandActionSchema.safeParse({ type: "format", format: "flyToTheMoon" }).success,
    ).toBe(false);
    expect(
      EditorCommandActionSchema.safeParse({ type: "format", format: "EVIL_FORMAT" }).success,
    ).toBe(false);
  });

  it("rejects { type: 'format' } with missing format", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "format" }).success).toBe(false);
  });

  it("accepts { type: 'format', format, attrs }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "format",
        format: "link",
        attrs: { href: "https://example.com" },
      }).success,
    ).toBe(true);
  });

  it("accepts { type: 'insertText', before }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "insertText",
        before: "Hello",
      }).success,
    ).toBe(true);
  });

  it("accepts { type: 'insertText', before, after }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "insertText",
        before: "(",
        after: ")",
      }).success,
    ).toBe(true);
  });

  it("rejects { type: 'insertText' } with missing before", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "insertText" }).success).toBe(false);
  });

  it("accepts { type: 'insertImage', src }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "insertImage",
        src: "image.png",
      }).success,
    ).toBe(true);
  });

  it("rejects { type: 'insertImage' } with empty src", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "insertImage",
        src: "",
      }).success,
    ).toBe(false);
  });

  it("accepts { type: 'insertGallery', srcs }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "insertGallery",
        srcs: ["a.png", "b.png"],
      }).success,
    ).toBe(true);
  });

  it("rejects { type: 'insertGallery' } with empty srcs", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "insertGallery",
        srcs: [],
      }).success,
    ).toBe(false);
  });

  it("accepts { type: 'undo' }", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "undo" }).success).toBe(true);
  });

  it("accepts { type: 'redo' }", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "redo" }).success).toBe(true);
  });

  it("accepts { type: 'setSelection', from, to }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "setSelection",
        from: 0,
        to: 5,
      }).success,
    ).toBe(true);
  });

  it("rejects { type: 'setSelection' } with negative from", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "setSelection",
        from: -1,
        to: 5,
      }).success,
    ).toBe(false);
  });

  it("accepts { type: 'setTTSHighlight', range: null }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "setTTSHighlight",
        range: null,
      }).success,
    ).toBe(true);
  });

  it("accepts { type: 'setTTSHighlight', range: { from, to } }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "setTTSHighlight",
        range: { from: 0, to: 10 },
      }).success,
    ).toBe(true);
  });

  it("accepts { type: 'insertNodeAt', nodeName }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "insertNodeAt",
        nodeName: "scribble",
      }).success,
    ).toBe(true);
  });

  it("rejects { type: 'insertNodeAt' } with empty nodeName", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "insertNodeAt",
        nodeName: "",
      }).success,
    ).toBe(false);
  });

  it("accepts { type: 'scrollToPos', pos: 0 }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "scrollToPos",
        pos: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects { type: 'scrollToPos', pos: -1 }", () => {
    expect(
      EditorCommandActionSchema.safeParse({
        type: "scrollToPos",
        pos: -1,
      }).success,
    ).toBe(false);
  });

  // ── Queries ──

  it("accepts query actions", () => {
    for (const type of [
      "getSelectedText",
      "getHtml",
      "getDoc",
      "getTextWithPositions",
      "getHeadings",
      "getCursorContext",
    ] as const) {
      expect(EditorCommandActionSchema.safeParse({ type }).success).toBe(true);
    }
  });

  // ── Catch-all ──

  it("rejects unknown action types", () => {
    expect(EditorCommandActionSchema.safeParse({ type: "flyToTheMoon" }).success).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(EditorCommandActionSchema.safeParse(null).success).toBe(false);
    expect(EditorCommandActionSchema.safeParse(undefined).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. formatZodIssues
// ---------------------------------------------------------------------------

describe("formatZodIssues", () => {
  it("formats path and message", () => {
    const result = formatZodIssues([
      { path: ["format"], message: "Required" },
      { path: ["range", "from"], message: "Expected number, got string" },
    ]);
    expect(result).toEqual([
      { path: "format", message: "Required" },
      { path: "range.from", message: "Expected number, got string" },
    ]);
  });

  it("handles symbol path segments", () => {
    const result = formatZodIssues([{ path: [Symbol("test")], message: "Custom error" }]);
    expect(result[0].path).toBe("Symbol(test)");
  });
});

// ---------------------------------------------------------------------------
// 3. Bus-level validation behaviour
// ---------------------------------------------------------------------------

describe("EditorCommandBus dispatch validation", () => {
  let bus: EditorCommandBus;
  let exec: MockExecutor;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    bus = new EditorCommandBus();
    exec = createMockExecutor();
    bus.setExecutor(exec);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("dispatches a valid action to the executor (no warning)", () => {
    bus.dispatch({ type: "focus" });
    expect(exec.run).toHaveBeenCalledWith({ type: "focus" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs a warning for an invalid action but still dispatches it", () => {
    // Invalid: missing `src` on insertImage
    const action = { type: "insertImage" } as any;
    bus.dispatch(action);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("[commandBus] Invalid action");
    // By default (non-strict) the action still reaches the executor.
    expect(exec.run).toHaveBeenCalledWith(action);
  });

  it("skips an invalid action in strict mode", () => {
    const action = { type: "insertImage" } as any;
    bus.dispatch(action, { strict: true });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    // In strict mode the executor is NOT called.
    expect(exec.run).not.toHaveBeenCalled();
  });

  it("logs a warning for an invalid query", () => {
    // Unknown type is never a member of the discriminated union.
    const invalid = { type: "unknown-type" } as any;
    bus.query(invalid);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("[commandBus] Invalid query");
  });

  it("does not warn for valid queries", () => {
    bus.query({ type: "getHeadings" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("is a no-op without an executor (no crash)", () => {
    const emptyBus = new EditorCommandBus();
    expect(() => {
      emptyBus.dispatch({ type: "focus" } as any);
    }).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
