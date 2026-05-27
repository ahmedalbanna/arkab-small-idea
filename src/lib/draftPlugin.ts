import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const draftHighlightKey = new PluginKey("draftHighlight");

export const draftHighlightPlugin = new Plugin({
  key: draftHighlightKey,
  state: {
    init() {
      return DecorationSet.empty;
    },
    apply(tr, set) {
      let nextSet = set.map(tr.mapping, tr.doc);

      const draftMeta = tr.getMeta(draftHighlightKey);
      if (draftMeta !== undefined) {
        if (draftMeta === null) {
          nextSet = DecorationSet.empty;
        } else {
          const { from, to, isGenerating } = draftMeta;
          const deco = Decoration.inline(from, to, {
            class: isGenerating ? "ai-draft-generating" : "ai-draft-highlight",
          });
          nextSet = DecorationSet.create(tr.doc, [deco]);
        }
      }
      return nextSet;
    },
  },
  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});
