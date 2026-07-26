import { keymap } from "prosemirror-keymap";
import { TextSelection } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import type { InkPlugin, PluginContext } from "../types";
import type { CommandAPI } from "../pluginAPI";
import type { AIAssistantAction, ActionScope } from "../../services/aiService";
import { AIHost } from "./AIHost";
import { setHandlerStores } from "./handlers";
import { setEditorAccessStores } from "../editorAccess";
import { runAction, setHandler } from "./aiHandlerRegistry";

/**
 * Selects the block containing the cursor (when the selection is collapsed) so
 * AI actions act on the whole block.
 */
export function selectBlock(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { from, to } = state.selection;
  if (from === to) {
    const $from = state.selection.$from;
    const blockFrom = $from.start();
    const blockTo = $from.end();
    if (blockFrom !== blockTo && dispatch) {
      dispatch(state.tr.setSelection(TextSelection.create(state.doc, blockFrom, blockTo)));
    }
  }
  return true;
}

/**
 * Inline AI draft handler bridge. The streaming executor is implemented in the
 * `useAIStreaming` hook (coupled to the editor component's draft state) and is
 * published here via `setAiActionHandler`. The plugin's keymap invokes it
 * through `runAiAction`, so the AI capability is declared at the plugin level
 * (and removed when the plugin is disabled) while the implementation stays in
 * the hook.
 *
 * The handler is stored in a simple module-level registry (`aiHandlerRegistry`)
 * rather than in a Zustand store, so this plugin has no direct store coupling.
 *
 * @deprecated Use `setHandler` from `./aiHandlerRegistry` directly.
 */
export function setAiActionHandler(
  editorId: string,
  handler:
    | ((action: AIAssistantAction, customInstruction?: string, scope?: ActionScope) => void)
    | null,
): void {
  setHandler(editorId, handler as any);
}

/**
 * Run an AI action by looking up the registered handler for the given editor.
 * The caller MUST provide an `editorId` — it is no longer resolved from the
 * editor store to keep this module store-agnostic.
 *
 * @deprecated Use `runAction` from `./aiHandlerRegistry` directly.
 */
export function runAiAction(
  action: AIAssistantAction,
  customInstruction?: string,
  editorId?: string,
  scope?: ActionScope,
): boolean {
  return runAction(action, customInstruction, editorId, scope as any);
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
  essential: false,
  dependencies: ["core"],
  init(ctx: PluginContext) {
    // Inject store access so handlers/editorAccess don't import stores directly
    setHandlerStores(ctx.stores);
    setEditorAccessStores(ctx.stores);

    // NOTE: RAG service UI callbacks (setIndexing, setIndexedCounts) are now
    // managed by the `rag` plugin during its init, not here. The AI plugin
    // only handles AI chat, search, TTS, and shortcuts UI.

    ctx.registerHost(AIHost);

    // AI editing actions surfaced in the command palette. Each emits a UI intent
    // instead of calling runAiAction directly, keeping the plugin store-agnostic.
    // Keymap handlers (below) still use runAiAction() since they are ProseMirror
    // callbacks without access to CommandAPI.
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
        run: (api: CommandAPI) => {
          // Read editorId at dispatch time rather than at init time to stay
          // correct across editor rebuilds (HMR / page switches).
          api.emitIntent({
            type: "runAIAction",
            actionId: action,
            editorId: ctx.editor.editorId,
          });
          return true;
        },
      });
    }

    ctx.registerProsePlugin(() =>
      keymap({
        "Mod-j": (state, dispatch) => selectBlock(state, dispatch),
        "Mod-Shift-j": (state, dispatch) => selectBlock(state, dispatch),
        "Mod-Shift-i": (state) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, " ");
          if (text.trim()) {
            // Read editorId at dispatch time — not captured at init — so the
            // keymap stays correct even if the editor was rebuilt (HMR).
            return runAiAction("improve", undefined, ctx.editor.editorId, "sel");
          }
          return false;
        },
        "Mod-Shift-s": (state) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, " ");
          if (text.trim()) {
            return runAiAction("summarize", undefined, ctx.editor.editorId, "sel");
          }
          return false;
        },
        "Mod-Shift-g": (state) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, " ");
          if (text.trim()) {
            return runAiAction("fix-grammar", undefined, ctx.editor.editorId, "sel");
          }
          return false;
        },
      }),
    );
  },
};
