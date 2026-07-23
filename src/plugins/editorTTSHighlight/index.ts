import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { InkPlugin, PluginContext } from "../types";

/**
 * Renders a transient highlight decoration when a "ttsHighlight" metadata
 * transaction is dispatched (typically by the TTS feature to show which
 * words are being read aloud).
 *
 * This plugin is pure ProseMirror — it has no store dependencies and is
 * driven entirely by transaction metadata.
 */
export const editorTTSHighlightPlugin: InkPlugin = {
  id: "editorTTSHighlight",
  name: "TTS Highlight",
  version: "1.0.0",
  essential: true,
  init(ctx: PluginContext) {
    ctx.registerProsePlugin(
      new Plugin({
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, set, _oldState, _newState) {
            const range = tr.getMeta("ttsHighlight");
            if (range === undefined) {
              return set.map(tr.mapping, tr.doc);
            }

            if (!range) return DecorationSet.empty;

            const from = Math.max(0, Math.min(range.from, tr.doc.content.size));
            const to = Math.max(from, Math.min(range.to, tr.doc.content.size));

            if (from === to) return DecorationSet.empty;

            const deco = Decoration.inline(from, to, { class: "tts-highlight" });
            return DecorationSet.create(tr.doc, [deco]);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    );
  },
};
