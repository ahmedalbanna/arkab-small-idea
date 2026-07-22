import type { EditorState } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import type { OpResult } from "./types";

/**
 * Text-insertion operations. All are pure: they take an `EditorState`, return a
 * `Transaction`, and never touch the DOM or a live view. None declares an
 * `inverse` — insertions are undone through ProseMirror's native history.
 */

/** Insert `before` (and optionally `after`) at the current selection. */
export function insertText(state: EditorState, before: string, after = ""): OpResult {
  const { from, to } = state.selection;
  let tr = state.tr.insertText(before, from);
  tr = tr.insertText(after, to + before.length);
  return { tr };
}

/** Insert an inline image node at the current selection. */
export function insertImage(
  state: EditorState,
  schema: Schema,
  src: string,
  alt = "",
  title = "",
): OpResult {
  const { from } = state.selection;
  const node = schema.nodes.image.create({ src, alt, title });
  return { tr: state.tr.insert(from, node) };
}

/** Insert a gallery node (grid of images) at the current selection. */
export function insertGallery(state: EditorState, schema: Schema, srcs: string[]): OpResult {
  const { from } = state.selection;
  const imageNodes = srcs.map((src) => schema.nodes.image.create({ src }));
  const galleryNode = schema.nodes.gallery.create({ layout: "grid" }, imageNodes);
  return { tr: state.tr.insert(from, galleryNode) };
}
