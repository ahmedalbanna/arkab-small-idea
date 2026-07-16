import { Plugin } from "prosemirror-state";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { tableEditing } from "prosemirror-tables";
import { buildInputRules, buildKeymap } from "../../components/prose-setup";
import type { InkPlugin, PluginContext } from "../types";

/**
 * Link preview / click handling (task checkboxes, priority badges). This is a
 * pure ProseMirror plugin (no React coupling) so it lives here with the other
 * base editor plugins rather than in `ProseMirrorEditor`.
 */
const linkPreviewPlugin = new Plugin({
  props: {
    handleDOMEvents: {
      mouseover(view, event) {
        const pos = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (pos) {
          const linkMark = view.state.doc
            .resolve(pos.pos)
            .marks()
            .find((m) => m.type.name === "link");
          if (linkMark) {
            const el = event.target as HTMLElement;
            el.title = `Preview: ${linkMark.attrs.href}`;
          }
        }
        return false;
      },
      click(view, event) {
        const target = event.target as HTMLElement;

        // Toggle checkbox logic
        if (target.classList.contains("task-checkbox")) {
          const isChecked = target.getAttribute("data-checked") === "true";
          const pos = view.posAtDOM(target, 0);
          if (pos !== null) {
            const newText = isChecked ? "[ ]" : "[x]";
            view.dispatch(view.state.tr.insertText(newText, pos, pos + 3));
            return true;
          }
        }

        // Cycle priority logic
        if (target.classList.contains("task-priority")) {
          const current = target.getAttribute("data-priority");
          const priorities = ["H", "M", "L"];
          const currentIndex = priorities.indexOf(current || "");
          const nextIndex = (currentIndex + 1) % (priorities.length + 1); // +1 for "none"

          const pos = view.posAtDOM(target, 0);
          if (pos !== null) {
            if (nextIndex === priorities.length) {
              // Remove priority badge
              view.dispatch(
                view.state.tr.delete(pos, pos + 3).scrollIntoView(),
              );
            } else {
              const next = priorities[nextIndex];
              const newTag = `(${next})`;
              view.dispatch(
                view.state.tr.insertText(newTag, pos, pos + 3).scrollIntoView(),
              );
            }
            return true;
          }
        }
        return false;
      },
    },
  },
});

/**
 * Core editor plugin: the generic ProseMirror plugins every editor instance
 * needs (history, keymaps, input rules, gap/drop cursors, tables, link
 * preview). These used to be defined inline inside `ProseMirrorEditor`; they
 * now live here and are surfaced through `PluginContext.editorPlugins`.
 */
export const corePlugin: InkPlugin = {
  id: "core",
  name: "Core Editor",
  version: "1.0.0",
  essential: true,
  init(ctx: PluginContext) {
    const schema = ctx.schema;

    ctx.registerProsePlugin(() => history());
    ctx.registerProsePlugin(() =>
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-Shift-z": redo,
      }),
    );
    ctx.registerProsePlugin(() => keymap(buildKeymap(schema)));
    ctx.registerProsePlugin(() => keymap(baseKeymap));
    ctx.registerProsePlugin(() => buildInputRules(schema));
    ctx.registerProsePlugin(() => dropCursor());
    ctx.registerProsePlugin(() => gapCursor());
    ctx.registerProsePlugin(() => linkPreviewPlugin);
    ctx.registerProsePlugin(() => tableEditing());
  },
};
