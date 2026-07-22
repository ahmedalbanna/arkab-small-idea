import type { EditorState } from "prosemirror-state";
import type { OpResult } from "./types";
import type { MarkdownIO } from "../serialization/markdown";
import { serializeDoc } from "../serialization/markdown";

/**
 * Markdown (de)serialization operations. Each mutating op records an `inverse`
 * of type `setMarkdown` capturing the document *before* the change, so the
 * command bus can undo it as a single markdown replacement.
 */

/** Replace the whole document with parsed markdown. */
export function setMarkdown(state: EditorState, markdown: string, io: MarkdownIO): OpResult {
  const before = serializeDoc(state.doc);
  const tr = state.tr.replaceWith(0, state.doc.content.size, io.parse(markdown).content);
  return { tr, inverse: { type: "setMarkdown", content: before } };
}

/** Append parsed markdown to the end of the document. */
export function appendMarkdown(state: EditorState, markdown: string, io: MarkdownIO): OpResult {
  const before = serializeDoc(state.doc);
  const parsed = io.parse(markdown);
  const tr = state.tr.insert(state.doc.content.size, parsed.content);
  return { tr, inverse: { type: "setMarkdown", content: before } };
}

/** Replace the current selection with parsed markdown. */
export function replaceSelectionWithMarkdown(
  state: EditorState,
  markdown: string,
  io: MarkdownIO,
): OpResult {
  const before = serializeDoc(state.doc);
  const { from, to } = state.selection;
  const parsed = io.parse(markdown);
  const tr = state.tr.replaceWith(from, to, parsed.content);
  return { tr, inverse: { type: "setMarkdown", content: before } };
}

/**
 * Stream parsed markdown into the document.
 *
 * @param range Optional explicit range `{ from, to }` to replace. When omitted
 *   (the common case), the current selection is replaced. The headless
 *   `CoreEditor` (Phase 2) owns the streaming cursor and passes this range so
 *   successive chunks accumulate.
 */
export function streamMarkdown(
  state: EditorState,
  content: string,
  io: MarkdownIO,
  range?: { from: number; to: number },
): OpResult {
  const before = serializeDoc(state.doc);
  const { from, to } = range ?? state.selection;
  const parsed = io.parse(content);
  const tr = state.tr.replaceWith(from, to, parsed.content);
  return { tr, inverse: { type: "setMarkdown", content: before } };
}
