/**
 * Custom cursor and selection builders for y-prosemirror's yCursorPlugin,
 * plus ProseMirror plugins for typing detection and section tracking.
 *
 * ---
 * Phase 5.3: Typing indicator, section tracking, enhanced cursor widget.
 */

import type { Awareness } from "y-protocols/awareness";
import { Plugin } from "prosemirror-state";
import type { DecorationAttrs } from "prosemirror-view";

// ---------------------------------------------------------------------------
// Cursor widget builder (returns HTMLElement for yCursorPlugin's cursorBuilder)
// Selection builder (returns DecorationAttrs)
// ---------------------------------------------------------------------------

/**
 * Build a cursor DOM element showing the user's name + colour.
 * yCursorPlugin expects cursorBuilder to return an HTMLElement.
 */
export function buildCursorWidget(state: { user: { name?: string; color?: string } }): HTMLElement {
  const user = state.user || {};
  const name = user.name || "?";
  const color = user.color || "#666";

  const wrapper = document.createElement("span");
  wrapper.className = "collab-cursor";
  wrapper.style.cssText = `
    position: relative;
    display: inline-flex;
    align-items: center;
    pointer-events: none;
  `;

  const caret = document.createElement("span");
  caret.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 2px;
    height: 1.2em;
    background-color: ${color};
  `;

  const label = document.createElement("span");
  label.textContent = name;
  label.style.cssText = `
    position: absolute;
    left: 2px;
    top: -1.4em;
    font-size: 11px;
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1;
    padding: 1px 4px;
    border-radius: 3px 3px 3px 0;
    background-color: ${color};
    color: #fff;
    white-space: nowrap;
    pointer-events: none;
  `;

  wrapper.appendChild(caret);
  wrapper.appendChild(label);
  return wrapper;
}

/**
 * Build selection highlight decoration attrs for a remote user's selection range.
 * yCursorPlugin expects selectionBuilder to return DecorationAttrs.
 */
export function buildSelectionWidget(state: {
  user: { name?: string; color?: string };
}): DecorationAttrs {
  const user = state.user || {};
  const color = user.color || "#666";
  return {
    style: `background-color: ${color}33;`,
    class: "collab-selection",
  };
}

// ---------------------------------------------------------------------------
// Typing detection
// ---------------------------------------------------------------------------

/**
 * Set up typing detection on the editor DOM element.
 *
 * On keydown sets `typing: true` in awareness; clears after `idleTimeout` ms.
 */
export function setupTypingDetection(
  editorDom: HTMLElement,
  awareness: Awareness,
  idleTimeout = 3000,
): () => void {
  let typingTimer: ReturnType<typeof setTimeout> | null = null;

  const setTyping = (isTyping: boolean) => {
    awareness.setLocalStateField("typing", isTyping);
  };

  const onKeyDown = () => {
    setTyping(true);
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      setTyping(false);
      typingTimer = null;
    }, idleTimeout);
  };

  const onBlur = () => {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = null;
    setTyping(false);
  };

  editorDom.addEventListener("keydown", onKeyDown);
  editorDom.addEventListener("blur", onBlur);

  return () => {
    editorDom.removeEventListener("keydown", onKeyDown);
    editorDom.removeEventListener("blur", onBlur);
    if (typingTimer) clearTimeout(typingTimer);
  };
}

// ---------------------------------------------------------------------------
// Section tracking
// ---------------------------------------------------------------------------

/**
 * Determine the nearest heading text above a position in a ProseMirror doc.
 */
function getSectionAtPosition(doc: any, pos: number): string | null {
  try {
    let section: string | null = null;
    doc.nodesBetween(0, pos, (node: any) => {
      if (node.type?.name === "heading" && node.attrs?.level && node.textContent) {
        section = node.textContent.slice(0, 60);
      }
    });
    return section;
  } catch {
    return null;
  }
}

/**
 * ProseMirror plugin that publishes the current section (heading) the cursor
 * is in to the Awareness instance on every selection/state change.
 *
 * Register this plugin alongside the other collab plugins in the collab init.
 */
export function createSectionTrackingPlugin(awareness: Awareness): Plugin {
  return new Plugin({
    view: () => ({
      update: (view) => {
        try {
          const pos = view.state.selection.from;
          const section = getSectionAtPosition(view.state.doc, pos);
          awareness.setLocalStateField("currentSection", section);
        } catch {
          // ignore
        }
      },
    }),
  });
}
