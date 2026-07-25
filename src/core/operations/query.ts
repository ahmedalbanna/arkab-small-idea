import type { EditorState } from "prosemirror-state";
import type { Node } from "prosemirror-model";
import { editorSerializer } from "../serialization/markdown";
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

export function getTextWithPositions(state: EditorState): { text: string; pos: number }[] {
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

/**
 * Return the selected range as markdown (preserving formatting), or the
 * entire current block if the selection is collapsed.
 * This is the markdown-aware replacement for `getSelectedText` which strips
 * all inline marks.
 */
export function getSelectedMarkdown(state: EditorState): string {
  const { from, to } = state.selection;
  if (from === to) return "";
  const sliced = state.doc.slice(from, to);
  // Wrap the fragment in a temporary doc node for serialization.
  const tempDoc = state.doc.type.create({}, sliced.content);
  return editorSerializer.serialize(tempDoc);
}

/**
 * Return the markdown for the heading-bounded section containing `pos`.
 * Walks up from `pos` to find the nearest heading boundary and returns the
 * markdown of all nodes between that heading and the next heading at the same
 * or higher level.
 *
 * When no heading is found, returns the entire document markdown.
 */
export function getSectionMarkdown(state: EditorState, pos?: number): string {
  const p = pos ?? state.selection.from;

  // Find the nearest heading above `pos`.
  let sectionStart = 0;
  let sectionEnd = state.doc.content.size;

  const allHeadings: { level: number; pos: number }[] = [];
  state.doc.descendants((node, nodePos) => {
    if (node.type.name === "heading") {
      allHeadings.push({ level: node.attrs.level, pos: nodePos });
    }
    return true;
  });

  // Find the heading that contains `p` (the one above `p`).
  let currentHeadingIdx = -1;
  for (let i = 0; i < allHeadings.length; i++) {
    if (allHeadings[i].pos <= p) {
      currentHeadingIdx = i;
    } else {
      break;
    }
  }

  if (currentHeadingIdx >= 0) {
    const h = allHeadings[currentHeadingIdx];
    sectionStart = h.pos;

    // Find the next heading at the same or higher level to determine the end.
    let nextPos = state.doc.content.size;
    for (let i = currentHeadingIdx + 1; i < allHeadings.length; i++) {
      if (allHeadings[i].level <= h.level) {
        nextPos = allHeadings[i].pos;
        break;
      }
    }
    sectionEnd = nextPos;
  }

  const sliced = state.doc.slice(sectionStart, sectionEnd);
  const tempDoc = state.doc.type.create({}, sliced.content);
  return editorSerializer.serialize(tempDoc);
}

/** Return the cursor position (collapsed selection) or `null` when a range is selected. */
export function getCursorPos(state: EditorState): number | null {
  const { from, to } = state.selection;
  return from === to ? from : null;
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

  const pathStr = headingPath.length > 0 ? `Path: ${headingPath.join(" > ")}` : "";
  return `${pathStr}\n\n${currentPara}`.trim();
}
