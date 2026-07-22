import { TextSelection, type EditorState } from "prosemirror-state";
import type { EditorCommandAction, EditorCommandExecutor, EditorCommandResult } from "./commandBus";
import type { CoreEditor } from "../CoreEditor";
import { insertText, insertImage, insertGallery } from "../operations/text";
import {
  setMarkdown,
  appendMarkdown,
  replaceSelectionWithMarkdown,
  streamMarkdown,
} from "../operations/markdown";
import { applyFormat } from "../operations/format";
import {
  getSelectedText,
  getDoc,
  getTextWithPositions,
  getHeadings,
  getCursorContext,
} from "../operations/query";
import { getHtml } from "../operations/html";

/** Find the document position of the first occurrence of `text`. */
function findTextPosition(state: EditorState, text: string): number | null {
  const docText = state.doc.textContent;
  const idx = docText.indexOf(text);
  if (idx === -1) return null;

  let charCount = 0;
  let found: number | null = null;
  state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.isText) {
      const t = node.text || "";
      const at = charCount;
      if (at <= idx && idx < at + t.length) {
        found = pos + (idx - at);
        return false;
      }
      charCount += t.length;
    }
    return true;
  });
  return found;
}

/**
 * Build the headless command executor. It is the single place that turns an
 * `EditorCommandAction` into a concrete mutation of the core's `EditorState`.
 *
 * Mutations are applied through `core.apply(tr)` so they flow through the
 * core's history + listener pipeline exactly like any other change. Queries
 * read the live state and return a value without mutating it. `inverse` values
 * (for markdown-replacement commands) are returned so the command bus can
 * record them; the core's own `undo`/`redo` use ProseMirror's native history,
 * which already tracks every transaction applied here.
 */
export function createHeadlessExecutor(core: CoreEditor): EditorCommandExecutor {
  return {
    run(action: EditorCommandAction): EditorCommandResult {
      const state = core.getState();

      switch (action.type) {
        case "focus":
          // Focus is a view concern; the headless core has nothing to do.
          return {};

        case "format": {
          const tr = applyFormat(state, action.format, core.schema, core.io);
          if (tr) core.apply(tr);
          return {};
        }

        case "insertText": {
          core.apply(insertText(state, action.before, action.after).tr);
          return {};
        }

        case "insertImage": {
          core.apply(insertImage(state, core.schema, action.src, action.alt, action.title).tr);
          return {};
        }

        case "insertGallery": {
          core.apply(insertGallery(state, core.schema, action.srcs).tr);
          return {};
        }

        case "appendMarkdown": {
          const { tr, inverse } = appendMarkdown(state, action.markdown, core.io);
          core.apply(tr);
          return { inverse };
        }

        case "replaceSelectionWithMarkdown": {
          const { tr, inverse } = replaceSelectionWithMarkdown(state, action.markdown, core.io);
          core.apply(tr);
          return { inverse };
        }

        case "setMarkdown": {
          const { tr, inverse } = setMarkdown(state, action.content, core.io);
          core.apply(tr);
          return { inverse };
        }

        case "setTTSHighlight": {
          // Persist the highlight range as transaction meta; the view scrolls.
          core.apply(state.tr.setMeta("ttsHighlight", action.range));
          return {};
        }

        case "scrollToText": {
          const pos = findTextPosition(state, action.text);
          if (pos !== null) {
            const tr = state.tr.setSelection(
              TextSelection.create(state.doc, pos, pos + action.text.length),
            );
            core.apply(tr);
          }
          return {};
        }

        case "scrollToPos": {
          const max = state.doc.content.size;
          const p = Math.min(action.pos, max);
          const tr = state.tr.setSelection(TextSelection.create(state.doc, p));
          core.apply(tr);
          return {};
        }

        case "streamMarkdown": {
          if (action.isNew || !core.streamRange) {
            const sel = state.selection;
            core.streamRange = { from: sel.from, to: sel.to };
          }
          const parsed = core.io.parse(action.content);
          const { tr, inverse } = streamMarkdown(state, action.content, core.io, core.streamRange);
          // Advance the streaming cursor so the next chunk accumulates.
          core.streamRange = {
            from: core.streamRange.from,
            to: core.streamRange.from + parsed.content.size,
          };
          core.apply(tr);
          return { inverse };
        }

        case "getSelectedText":
          return { value: getSelectedText(state) };

        case "getHtml":
          return { value: getHtml(state, core.schema) };

        case "getDoc":
          return { value: getDoc(state) };

        case "getTextWithPositions":
          return { value: getTextWithPositions(state) };

        case "getHeadings":
          return { value: getHeadings(state) };

        case "getCursorContext":
          return { value: getCursorContext(state) };

        default:
          return {};
      }
    },
  };
}
