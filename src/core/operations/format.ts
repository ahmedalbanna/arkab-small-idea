import type { EditorState, Transaction } from "prosemirror-state";
import { Slice } from "prosemirror-model";
import { toggleMark, setBlockType, wrapIn } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import type { Schema } from "prosemirror-model";
import type { MarkdownIO } from "../serialization/markdown";

/**
 * Formatting operations, extracted from `useFormatting` and made pure: they
 * operate on an `EditorState` and return a `Transaction` (or `null` when nothing
 * changed) without touching the DOM or a live view. Focus is deliberately not
 * performed here — that is a view concern handled by the caller.
 */

/** Run a ProseMirror command, capturing and returning the transaction it dispatches. */
function runCommand(
  cmd: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean,
  state: EditorState,
): Transaction | null {
  let tr: Transaction | null = null;
  const handled = cmd(state, (t) => {
    tr = t;
  });
  return handled ? tr : null;
}

const wrapInBlock =
  (type: any) => (state: EditorState, dispatch?: (tr: Transaction) => void) =>
    wrapIn(type)(state, dispatch);

/**
 * Apply a formatting action identified by `format` (the same strings the
 * toolbar/slash menu use: "bold", "italic", "h1"…"h3", "paragraph", "bullet",
 * "numbered", "quote", "alignLeft/Center/Right/Justify", "tableify").
 *
 * Returns the transaction to apply, or `null` if the action did not change the
 * document (no-op).
 */
export function applyFormat(
  state: EditorState,
  format: string,
  schema: Schema,
  io: MarkdownIO,
): Transaction | null {
  const setAlign = (alignment: string): Transaction | null => {
    const { from, to } = state.selection;
    let tr = state.tr;
    let changed = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (
        node.type.name === "paragraph" ||
        node.type.name === "heading"
      ) {
        tr.setNodeMarkup(pos, null, { ...node.attrs, align: alignment });
        changed = true;
      }
    });
    return changed ? tr : null;
  };

  switch (format) {
    case "bold":
      return runCommand(toggleMark(schema.marks.strong), state);
    case "italic":
      return runCommand(toggleMark(schema.marks.em), state);
    case "underline":
      return runCommand(toggleMark(schema.marks.underline), state);
    case "strike":
      return runCommand(toggleMark(schema.marks.strike), state);
    case "code":
      return runCommand(toggleMark(schema.marks.code), state);
    case "h1":
      return runCommand(setBlockType(schema.nodes.heading, { level: 1 }), state);
    case "h2":
      return runCommand(setBlockType(schema.nodes.heading, { level: 2 }), state);
    case "h3":
      return runCommand(setBlockType(schema.nodes.heading, { level: 3 }), state);
    case "quote":
      return runCommand(wrapInBlock(schema.nodes.blockquote), state);
    case "paragraph":
      return runCommand(setBlockType(schema.nodes.paragraph), state);
    case "numbered":
      return runCommand(wrapInList(schema.nodes.ordered_list), state);
    case "alignLeft":
      return setAlign("left");
    case "alignCenter":
      return setAlign("center");
    case "alignRight":
      return setAlign("right");
    case "alignJustify":
      return setAlign("justify");
    case "bullet":
      return runCommand(wrapInList(schema.nodes.bullet_list), state);
    case "tableify": {
      const { from, to } = state.selection;
      const selectedText = state.doc.textBetween(from, to, "\n");
      if (!selectedText.trim()) return null;
      const lines = selectedText
        .split("\n")
        .filter((l) => l.trim().length > 0);
      if (lines.length === 0) return null;

      const delimiters = ["|", "\t", ","];
      let bestDelimiter = delimiters[0];
      let maxCols = 0;
      for (const delim of delimiters) {
        const cols = lines[0].split(delim).length;
        if (cols > maxCols) {
          maxCols = cols;
          bestDelimiter = delim;
        }
      }

      const processLine = (line: string) => {
        let cols = line.split(bestDelimiter);
        if (bestDelimiter === "|") {
          cols = cols.filter((c, i) => {
            if ((i === 0 || i === cols.length - 1) && c.trim() === "")
              return false;
            return true;
          });
        }
        return cols.map((c) => c.trim());
      };

      const tableData = lines.map(processLine);
      const colCount = Math.max(...tableData.map((r) => r.length));

      let markdownTable = "";
      const header = [...tableData[0]];
      while (header.length < colCount) header.push(`Header ${header.length + 1}`);
      markdownTable += "| " + header.join(" | ") + " |\n";
      markdownTable += "| " + Array(colCount).fill("---").join(" | ") + " |\n";
      for (let i = 1; i < tableData.length; i++) {
        const row = [...tableData[i]];
        while (row.length < colCount) row.push("");
        markdownTable += "| " + row.join(" | ") + " |\n";
      }

      const slice = io.parse(markdownTable);
      return state.tr.replaceSelection(new Slice(slice.content, 0, 0));
    }
    default:
      return null;
  }
}
