import { keymap } from "prosemirror-keymap";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import type { InkPlugin, PluginContext } from "../types";
import { AIHost } from "./AIHost";
import { runInlineAiAction } from "./inlineDraftBridge";
import { useAIUIStore } from "../../stores/aiUIStore";

/**
 * Selects the block containing the cursor (when the selection is collapsed) so
 * the AI popover acts on the whole block, then opens the popover.
 */
export function selectBlockAndOpenPopover(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { from, to } = state.selection;
  if (from === to) {
    const $from = state.selection.$from;
    const blockFrom = $from.start();
    const blockTo = $from.end();
    if (blockFrom !== blockTo && dispatch) {
      dispatch(
        state.tr.setSelection(
          TextSelection.create(state.doc, blockFrom, blockTo),
        ),
      );
    }
  }
  useAIUIStore.getState().setShowAiPopover(true);
  return true;
}

/**
 * Owns the AI assistant, search dialog, semantic folders, TTS, and shortcuts
 * UI — previously inline in `App.tsx`. The host runs the AI/search side-effects
 * and renders the panels; shared state/handlers live in `aiUIStore` and
 * `handlers.ts` so the editor tree can read them too.
 *
 * The AI keymap (formerly defined inline in `ProseMirrorEditor`) lives here so
 * that disabling this plugin automatically removes the shortcuts.
 */
export const aiPlugin: InkPlugin = {
  id: "ai",
  name: "AI Assistant & Search",
  version: "1.0.0",
  init(ctx: PluginContext) {
    ctx.registerHost(AIHost);

    ctx.registerProsePlugin(() =>
      keymap({
        "Mod-j": (state, dispatch) =>
          selectBlockAndOpenPopover(state, dispatch),
        "Mod-Shift-j": (state, dispatch) =>
          selectBlockAndOpenPopover(state, dispatch),
        "Mod-Shift-i": (state) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, " ");
          if (text.trim()) {
            runInlineAiAction("improve");
            return true;
          }
          return false;
        },
        "Mod-Shift-s": (state) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, " ");
          if (text.trim()) {
            runInlineAiAction("summarize");
            return true;
          }
          return false;
        },
        "Mod-Shift-g": (state) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, " ");
          if (text.trim()) {
            runInlineAiAction("fix-grammar");
            return true;
          }
          return false;
        },
      }),
    );
  },
};
