import { keymap } from "prosemirror-keymap";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import type { InkPlugin, PluginContext } from "../types";
import type { AIAssistantAction } from "../../services/aiService";
import { AIHost } from "./AIHost";
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
 * Inline AI draft handler bridge. The streaming executor is implemented in the
 * `useAIStreaming` hook (coupled to the editor component's draft state) and is
 * published here via `setAiActionHandler`. The plugin's keymap invokes it
 * through `runAiAction`, so the AI capability is declared at the plugin level
 * (and removed when the plugin is disabled) while the implementation stays in
 * the hook. Backed by `aiUIStore` — there is deliberately no module-global
 * handler, matching the registry/context pattern used elsewhere.
 */
export function setAiActionHandler(
  handler: ((action: AIAssistantAction) => void) | null,
): void {
  useAIUIStore.getState().setAiActionHandler(handler);
}

export function runAiAction(action: AIAssistantAction): void {
  useAIUIStore.getState().aiActionHandler?.(action);
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

    // Slash-menu command — opens the AI drafting popover from "/".
    ctx.registerCommand({
      id: "ai-ask",
      label: "Ask AI",
      slash: true,
      run: () => {
        useAIUIStore.getState().setShowAiPopover(true);
        return true;
      },
    });

    // AI editing actions surfaced in the command palette. Each acts on the
    // current selection via the same handler the toolbar/keymap use.
    for (const [id, label, action] of [
      ["ai-improve", "AI: Improve Writing", "improve"],
      ["ai-fix-grammar", "AI: Fix Grammar", "fix-grammar"],
      ["ai-summarize", "AI: Summarize", "summarize"],
      ["ai-expand", "AI: Expand", "expand"],
      ["ai-rewrite", "AI: Rewrite Section", "rewrite"],
    ] as const) {
      ctx.registerCommand({
        id,
        label,
        run: () => {
          runAiAction(action);
          return true;
        },
      });
    }

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
            runAiAction("improve");
            return true;
          }
          return false;
        },
        "Mod-Shift-s": (state) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, " ");
          if (text.trim()) {
            runAiAction("summarize");
            return true;
          }
          return false;
        },
        "Mod-Shift-g": (state) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, " ");
          if (text.trim()) {
            runAiAction("fix-grammar");
            return true;
          }
          return false;
        },
      }),
    );
  },
};
