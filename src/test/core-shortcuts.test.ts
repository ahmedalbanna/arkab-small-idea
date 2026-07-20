// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  getRegisteredShortcuts,
  resolveShortcut,
  DEFAULT_SHORTCUTS,
} from "@core/shortcuts/shortcuts";
import type { EditorCommandAction } from "@core/commands/commandBus";
import type { Shortcut } from "@core/types";
import type { KeyEventLike } from "@core/shortcuts/shortcuts";

const catalog: EditorCommandAction[] = [
  { type: "format", format: "bold" },
  { type: "format", format: "italic" },
  { type: "format", format: "underline" },
  { type: "format", format: "bullet" },
  { type: "insertImage", src: "x" }, // registered but has no default binding
];

describe("getRegisteredShortcuts", () => {
  it("returns only shortcuts for commands that are registered and have defaults", () => {
    const shortcuts = getRegisteredShortcuts(catalog);
    const has = (type: string, format?: string) =>
      shortcuts.some(
        (s) =>
          s.command.type === type &&
          (format === undefined ||
            (s.command.type === "format" && s.command.format === format)),
      );
    expect(has("format", "bold")).toBe(true);
    expect(has("format", "italic")).toBe(true);
    expect(has("format", "bullet")).toBe(true);
    // insertImage is registered but has no default shortcut
    expect(shortcuts.some((s) => s.command.type === "insertImage")).toBe(false);
  });

  it("produces stable ids and carries label/category", () => {
    const shortcuts = getRegisteredShortcuts(catalog);
    const bold = shortcuts.find(
      (s) => s.command.type === "format" && s.command.format === "bold",
    )!;
    expect(bold.id).toBe("shortcut:format:bold");
    expect(bold.label).toBe("Bold");
    expect(bold.category).toBe("format");
    expect(typeof bold.combo).toBe("string");
  });
});

function event(partial: Partial<KeyEventLike> & { key: string }): KeyEventLike {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...partial,
  };
}

describe("resolveShortcut", () => {
  const shortcuts: Shortcut[] = [
    { id: "b", label: "Bold", combo: "Mod-B", command: { type: "format", format: "bold" } },
    { id: "u", label: "Underline", combo: "Mod-U", command: { type: "format", format: "underline" } },
    { id: "bl", label: "Bullet list", combo: "Mod-Shift-8", command: { type: "format", format: "bullet" } },
  ];

  it("matches Ctrl on non-mac platforms", () => {
    const action = resolveShortcut(event({ key: "b", ctrlKey: true }), shortcuts);
    expect(action).not.toBeNull();
    expect(action!.type).toBe("format");
    expect((action as { format: string }).format).toBe("bold");
  });

  it("matches Cmd on mac platforms (Mod)", () => {
    const action = resolveShortcut(event({ key: "b", metaKey: true }), shortcuts);
    expect(action!.type).toBe("format");
    expect((action as { format: string }).format).toBe("bold");
  });

  it("distinguishes shift variants", () => {
    const plainB = resolveShortcut(event({ key: "b", ctrlKey: true }), shortcuts);
    expect((plainB as { format: string }).format).toBe("bold");
    const shift8 = resolveShortcut(
      event({ key: "8", ctrlKey: true, shiftKey: true }),
      shortcuts,
    );
    expect((shift8 as { format: string }).format).toBe("bullet");
  });

  it("returns null when no combo matches", () => {
    const action = resolveShortcut(event({ key: "x", ctrlKey: true }), shortcuts);
    expect(action).toBeNull();
    // wrong modifier set
    const action2 = resolveShortcut(
      event({ key: "b", ctrlKey: true, shiftKey: true }),
      shortcuts,
    );
    expect(action2).toBeNull();
  });

  it("is case-insensitive for single character keys", () => {
    const action = resolveShortcut(event({ key: "B", ctrlKey: true }), shortcuts);
    expect((action as { format: string }).format).toBe("bold");
  });

  it("exposes a sensible default set", () => {
    expect(Object.keys(DEFAULT_SHORTCUTS).length).toBeGreaterThan(5);
  });
});
