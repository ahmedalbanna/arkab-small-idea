import type { EditorState } from "prosemirror-state";
import { DOMSerializer, type Schema } from "prosemirror-model";

/**
 * HTML serialization. This is the only operation in the core that requires a
 * DOM environment, because it builds a real DOM fragment to produce an HTML
 * string. It depends solely on `prosemirror-model` (not `prosemirror-view`),
 * so importing this module never pulls the editor view into a headless context
 * — only *calling* `getHtml` needs `document` to exist.
 */

/**
 * Serialize the document to an HTML string.
 *
 * @requires A DOM environment (`document`). In non-DOM contexts this throws a
 *   clear error rather than silently producing empty output.
 */
export function getHtml(state: EditorState, schema: Schema): string {
  if (typeof document === "undefined") {
    throw new Error("getHtml requires a DOM environment (document is undefined).");
  }
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
    state.doc.content,
  );
  const container = document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
}
