import type { EditorState } from "prosemirror-state";
import type { Node } from "prosemirror-model";
import { slugify } from "../util/slugify";

/**
 * Read-only queries over an `EditorState`. All are pure (no mutation, no DOM)
 * except `getHtml`, which intentionally requires a DOM environment to serialize
 * a document fragment to an HTML string. `getHtml` is kept in the core because
 * it only depends on `prosemirror-model` (not `prosemirror-view`); callers in
 * non-DOM environments simply avoid it.
 */

export function getSelectedText(state: EditorState): string {
  const { from, to } = state.selection;
  return state.doc.textBetween(from, to, " ");
}

export function getDoc(state: EditorState): Node {
  return state.doc;
}

export function getTextWithPositions(
  state: EditorState,
): { text: string; pos: number }[] {
  const result: { text: string; pos: number }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.isText) {
      result.push({ text: node.text || "", pos });
    }
    return true;
  });
  return result;
}

export function getHeadings(
  state: EditorState,
): { text: string; level: number; pos: number; id: string }[] {
  const headings: {
    text: string;
    level: number;
    pos: number;
    id: string;
  }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({
        text: node.textContent,
        level: node.attrs.level,
        pos,
        id: node.attrs.id || slugify(node.textContent),
      });
    }
    return true;
  });
  return headings;
}

/** Build the surrounding heading path + current block text for AI context. */
export function getCursorContext(state: EditorState): string {
  const { $from } = state.selection;
  const depth = $from.depth;

  const start = depth > 0 ? $from.start(depth) : 0;
  const end = depth > 0 ? $from.end(depth) : state.doc.content.size;
  const currentPara = state.doc.textBetween(start, end, " ");

  const headingPath: string[] = [];
  let pos = $from.pos;
  while (pos > 0) {
    const $pos = state.doc.resolve(pos);
    const node = $pos.parent;
    if (node && node.type.name === "heading") {
      headingPath.unshift(node.textContent);
    }

    if ($pos.depth > 0) {
      pos = $pos.before();
    } else {
      break;
    }

    if (pos === 0) break;
  }

  const pathStr =
    headingPath.length > 0 ? `Path: ${headingPath.join(" > ")}` : "";
  return `${pathStr}\n\n${currentPara}`.trim();
}
