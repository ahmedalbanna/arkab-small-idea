import { TextSelection, type EditorState } from "prosemirror-state";
import type { EditorCommandAction, EditorCommandExecutor, EditorCommandResult } from "./commandBus";
import type { CoreEditor } from "../CoreEditor";
import { clampPosition, clampPositions } from "./validateAction";
import { insertText, insertImage, insertGallery } from "../operations/text";
import {
  setMarkdown,
  appendMarkdown,
  replaceSelectionWithMarkdown,
  replaceRangeWithMarkdown,
  streamMarkdown,
} from "../operations/markdown";
import { applyFormat } from "../operations/format";
import {
  getSelectedText,
  getDoc,
  getTextWithPositions,
  getHeadings,
  getCursorContext, getSelectedMarkdown,
  getSectionMarkdown
} from "../operations/query";
import { getHtml } from "../operations/html";
import { applyUndo, applyRedo } from "../operations/history";

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
 * read the live state and return a value without mutating it.
 *
 * Undo/redo use ProseMirror's native history (`prosemirror-history` plugin),
 * which tracks every transaction applied via `core.apply`. Both the keyboard
 * shortcut (`Mod-z` → PM keymap) and the command-palette "Undo" (`bus.dispatch`
 * → executor) reach the same history queue, eliminating the dual-undo problem.
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
          const tr = applyFormat(state, action.format, core.schema, core.io, action.attrs);
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

        case "replaceRangeWithMarkdown": {
          const { tr, inverse } = replaceRangeWithMarkdown(
            state,
            action.from,
            action.to,
            action.markdown,
            core.io,
          );
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
          const p = clampPosition(state, action.pos);
          if (p === null) return {};
          const tr = state.tr.setSelection(TextSelection.create(state.doc, p));
          core.apply(tr);
          return {};
        }

        case "streamMarkdown": {
          if (action.isNew || !core.streamRange) {
            // When an explicit `from` is provided (P0.3 fix), use it instead
            // of the live selection to eliminate the first-chunk drift between
            // the hook and executor.
            const from =
              action.from ??
              (action.isNew ? state.selection.from : undefined) ??
              state.selection.from;
            core.streamRange = { from, to: state.selection.to };
          }
          const parsed = core.io.parse(action.content);
          const { tr, inverse } = streamMarkdown(state, action.content, core.io, core.streamRange);
          // Advance the streaming cursor so the next chunk accumulates.
          // Use the same parser (`core.io`) that the executor uses (not the
          // hook's `parseMarkdownDoc`) so both sides agree on the end position.
          core.streamRange = {
            from: core.streamRange.from,
            to: core.streamRange.from + parsed.content.size,
          };
          core.apply(tr);
          return { inverse };
        }

        // --- Undo / Redo via PM native history ---
        case "undo": {
          const tr = applyUndo(core.getState());
          if (tr) core.apply(tr);
          return {};
        }

        case "redo": {
          const tr = applyRedo(core.getState());
          if (tr) core.apply(tr);
          return {};
        }

        // --- Selection & Range ---
        case "setSelection": {
          const state = core.getState();
          const pos = clampPositions(state, action.from, action.to);
          if (!pos) return {};
          const tr = state.tr.setSelection(TextSelection.create(state.doc, pos.from, pos.to));
          core.apply(tr);
          return {};
        }

        case "deleteRange": {
          const state = core.getState();
          const pos = clampPositions(state, action.from, action.to);
          if (!pos || pos.from === pos.to) return {};
          const tr = state.tr.delete(pos.from, pos.to);
          core.apply(tr);
          return {};
        }

        case "insertNodeAt": {
          const { schema } = core;
          const nodeType = schema.nodes[action.nodeName];
          if (!nodeType) return {};
          const node = nodeType.create(action.attrs);
          const state = core.getState();
          const pos = clampPosition(state, action.pos ?? state.selection.from);
          if (pos === null) return {};
          const tr = state.tr.insert(pos, node);
          core.apply(tr);
          return {};
        }

        // --- Queries ---
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

        case "getCursorPos":
        case "getSelectedMarkdown":
          return { value: getSelectedMarkdown(state) };
        case "getSectionMarkdown":
          return { value: getSectionMarkdown(state, action.pos) };

        default:
          return {};
      }
    },
  };
}
