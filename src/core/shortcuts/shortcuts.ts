import type { EditorCommandAction } from "../commands/commandBus";
import type { Shortcut } from "../types";

/** A DOM-free view of a keyboard event, sufficient for shortcut matching. */
export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface ShortcutDef {
  combo: string;
  label: string;
  category?: string;
  action: EditorCommandAction;
}

/**
 * Default keyboard combinations for the editor's well-known commands.
 * `Mod` resolves to Cmd on macOS and Ctrl elsewhere — matching the
 * ProseMirror keymap convention. The set is intentionally small: only
 * commands that benefit from a global binding.
 */
export const DEFAULT_SHORTCUTS: Record<string, ShortcutDef> = {
  bold: { combo: "Mod-B", label: "Bold", category: "format", action: { type: "format", format: "bold" } },
  italic: { combo: "Mod-I", label: "Italic", category: "format", action: { type: "format", format: "italic" } },
  underline: { combo: "Mod-U", label: "Underline", category: "format", action: { type: "format", format: "underline" } },
  strike: { combo: "Alt-Shift-5", label: "Strikethrough", category: "format", action: { type: "format", format: "strike" } },
  code: { combo: "Mod-E", label: "Inline code", category: "format", action: { type: "format", format: "code" } },
  bulletList: { combo: "Mod-Shift-8", label: "Bullet list", category: "list", action: { type: "format", format: "bullet" } },
  orderedList: { combo: "Mod-Shift-7", label: "Ordered list", category: "list", action: { type: "format", format: "numbered" } },
  blockquote: { combo: "Mod-Shift-.", label: "Blockquote", category: "block", action: { type: "format", format: "quote" } },
};

function actionEquals(a: EditorCommandAction, b: EditorCommandAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "format" && b.type === "format") return a.format === b.format;
  return true;
}

/**
 * Build the shortcut catalog for the commands that are actually registered,
 * so the UI only advertises bindings for capabilities the editor exposes.
 */
export function getRegisteredShortcuts(commands: EditorCommandAction[]): Shortcut[] {
  const result: Shortcut[] = [];
  for (const def of Object.values(DEFAULT_SHORTCUTS)) {
    if (!commands.some((c) => actionEquals(c, def.action))) continue;
    const suffix = def.action.type === "format" ? `:${def.action.format}` : "";
    result.push({
      id: `shortcut:${def.action.type}${suffix}`,
      label: def.label,
      combo: def.combo,
      command: def.action,
      category: def.category,
    });
  }
  return result;
}

interface ParsedCombo {
  key: string;
  /** Primary modifier flavor: `Mod` (Ctrl or Meta), explicit, or none. */
  mod: "mod" | "ctrl" | "meta" | null;
  shift: boolean;
  alt: boolean;
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.split("-").map((p) => p.trim()).filter(Boolean);
  const rawKey = parts[parts.length - 1] ?? "";
  const key = rawKey.length === 1 ? rawKey.toUpperCase() : rawKey;
  let mod: ParsedCombo["mod"] = null;
  let shift = false;
  let alt = false;
  for (let i = 0; i < parts.length - 1; i++) {
    const m = parts[i].toLowerCase();
    if (m === "mod") {
      mod = "mod";
    } else if (m === "ctrl" || m === "control") {
      mod = "ctrl";
    } else if (m === "cmd" || m === "command" || m === "meta") {
      mod = "meta";
    } else if (m === "shift") {
      shift = true;
    } else if (m === "alt" || m === "option") {
      alt = true;
    }
  }
  return { key, mod, shift, alt };
}

/**
 * Given a keyboard event, return the command action whose binding matches,
 * or `null` if no shortcut applies. Pure — receives a `KeyEventLike` so the
 * core never depends on the DOM `KeyboardEvent` type.
 */
export function resolveShortcut(
  event: KeyEventLike,
  shortcuts: Shortcut[],
): EditorCommandAction | null {
  const eventKey = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  for (const s of shortcuts) {
    const pc = parseCombo(s.combo);
    let modOk = true;
    if (pc.mod === "mod") {
      modOk = event.ctrlKey || event.metaKey;
    } else if (pc.mod === "ctrl") {
      modOk = event.ctrlKey && !event.metaKey;
    } else if (pc.mod === "meta") {
      modOk = event.metaKey && !event.ctrlKey;
    } else {
      modOk = !event.ctrlKey && !event.metaKey;
    }
    if (eventKey === pc.key && modOk && event.shiftKey === pc.shift && event.altKey === pc.alt) {
      return s.command;
    }
  }
  return null;
}
