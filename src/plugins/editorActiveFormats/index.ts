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
              const { $from } = state.selection;

              // For collapsed cursor: still show active marks at cursor
              // via storedMarks/$from.marks(), and show the parent block type.
              // The bubble menu may be hidden by editorMenus, but the format
              // indicators in the per-page toolbar still need to reflect
              // the state (fixes F1).
              const activeMarks = from === to ? state.storedMarks || $from.marks() : null;

              const hasMark = (markType: any) =>
                activeMarks
                  ? !!markType && markType.isInSet(activeMarks)
                  : from !== to && !!markType && state.doc.rangeHasMark(from, to, markType);

              const formats: Record<string, boolean> = {
                bold: hasMark(schema.marks.strong),
                italic: hasMark(schema.marks.em),
                underline: hasMark(schema.marks.underline),
                strike: hasMark(schema.marks.strike),
                code: hasMark(schema.marks.code),
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
