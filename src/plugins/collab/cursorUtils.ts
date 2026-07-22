/**
 * Custom cursor and selection builders for y-prosemirror's yCursorPlugin.
 *
 * These render richer cursor widgets that display the user's name alongside
 * the cursor caret, and highlight selection ranges with the user's colour.
 */

/**
 * Build a cursor element that shows the user's name + colour.
 *
 * Usage with yCursorPlugin:
 *   yCursorPlugin(awareness, { cursorBuilder: buildCursorWidget })
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

  // Cursor caret (vertical bar)
  const caret = document.createElement("span");
  caret.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 2px;
    height: 1.2em;
    background-color: ${color};
  `;

  // Name label
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
 * Build a selection highlight element for a remote user's selection range.
 */
export function buildSelectionWidget(state: {
  user: { name?: string; color?: string };
}): HTMLElement {
  const user = state.user || {};
  const color = user.color || "#666";

  const el = document.createElement("span");
  el.className = "collab-selection";
  el.style.cssText = `
    background-color: ${color}33;  /* 20% opacity */
    pointer-events: none;
  `;
  return el;
}
