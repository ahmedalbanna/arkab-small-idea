import { Plugin } from "prosemirror-state";
import type { InkPlugin, PluginContext } from "../types";

/**
 * Tracks the active formatting marks/block-types at the current selection
 * and writes them into aiUIStore so the bubble menu toolbar can highlight
 * the correct buttons (bold, italic, heading level, alignment, etc.).
 *
 * This was extracted from the bubble menu plugin in the monolithic
 * `editorUIPlugin` so that format tracking and menu positioning can be
 * toggled independently.
 */
export const editorActiveFormatsPlugin: InkPlugin = {
  id: "editorActiveFormats",
  name: "Active Formats",
  version: "1.0.0",
  essential: true,
  init(ctx: PluginContext) {
    const { schema, stores } = ctx;
    const editorId = ctx.editor.editorId ?? "";

    ctx.registerProsePlugin(
      new Plugin({
        view() {
          return {
            update(view) {
              const { state } = view;
              const { from, to } = state.selection;

              // When the selection is collapsed, clear formats (bubble menu
              // will be hidden by editorMenus).
              if (from === to) {
                stores.aiUI.getState().setActiveFormats(editorId, {});
                return;
              }

              const { $from } = state.selection;

              const formats: Record<string, boolean> = {
                bold:
                  state.doc.rangeHasMark(from, to, schema.marks.strong) ||
                  (from === to &&
                    !!schema.marks.strong.isInSet(state.storedMarks || $from.marks())),
                italic:
                  state.doc.rangeHasMark(from, to, schema.marks.em) ||
                  (from === to && !!schema.marks.em.isInSet(state.storedMarks || $from.marks())),
                underline:
                  state.doc.rangeHasMark(from, to, schema.marks.underline) ||
                  (from === to &&
                    !!schema.marks.underline.isInSet(state.storedMarks || $from.marks())),
                strike:
                  state.doc.rangeHasMark(from, to, schema.marks.strike) ||
                  (from === to &&
                    !!schema.marks.strike.isInSet(state.storedMarks || $from.marks())),
                code:
                  state.doc.rangeHasMark(from, to, schema.marks.code) ||
                  (from === to && !!schema.marks.code.isInSet(state.storedMarks || $from.marks())),
                h1: $from.parent.type.name === "heading" && $from.parent.attrs.level === 1,
                h2: $from.parent.type.name === "heading" && $from.parent.attrs.level === 2,
                h3: $from.parent.type.name === "heading" && $from.parent.attrs.level === 3,
                alignLeft: $from.parent.attrs.align === "left" || !$from.parent.attrs.align,
                alignCenter: $from.parent.attrs.align === "center",
                alignRight: $from.parent.attrs.align === "right",
                alignJustify: $from.parent.attrs.align === "justify",
                blockquote: ((): boolean => {
                  for (let d = $from.depth; d > 0; d--) {
                    if ($from.node(d).type.name === "blockquote") return true;
                  }
                  return false;
                })(),
                bullet: ((): boolean => {
                  for (let d = $from.depth; d > 0; d--) {
                    if ($from.node(d).type.name === "bullet_list") return true;
                  }
                  return false;
                })(),
              };
              stores.aiUI.getState().setActiveFormats(editorId, formats);
            },
          };
        },
      }),
    );
  },
};
