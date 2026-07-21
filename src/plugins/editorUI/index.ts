import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Type } from "lucide-react";
import type { InkPlugin, PluginContext } from "../types";
import { useAIUIStore } from "../../stores/aiUIStore";
import { useUIStore } from "../../stores/uiStore";

/**
 * Editor "shell" ProseMirror plugins that are coupled to the editor DOM but not
 * to any specific feature: hover side menu, context menu, selection bubble
 * menu, TTS highlight, and typewriter scrolling. They dispatch their UI state
 * into `aiUIStore` (and read the quick-commands toggle from `uiStore`) so the
 * React menu components render it without the editor knowing about React.
 * Previously these were defined inline inside `ProseMirrorEditor`.
 */
export const editorUIPlugin: InkPlugin = {
  id: "editorUI",
  name: "Editor UI",
  version: "1.0.0",
  essential: true,
  init(ctx: PluginContext) {
    const schema = ctx.schema;
    // Scope this editor's menu UI so multiple editors on screen don't share a
    // single global menu (selecting text / typing `/` / right-click in one
    // must not pop menus in the others).
    const editorId = ctx.editor.editorId ?? "";
    let sideMenuHideTimeout: ReturnType<typeof setTimeout> | null = null;

    // Toolbar items — editor-shell toggles surfaced in the app toolbar.
    ctx.registerToolbarItem({
      id: "typewriter",
      icon: Type,
      label: "Typewriter Scrolling",
      group: "editor",
      onClick: () => {
        const s = useAIUIStore.getState();
        s.setIsTypewriter(!s.isTypewriter);
      },
      isActive: () => useAIUIStore.getState().isTypewriter,
    });

    // Hover side menu — shows a "+" gutter button for the block under the cursor.
    ctx.registerProsePlugin(
      new Plugin({
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const aiUI = useAIUIStore.getState();
              if (aiUI.bubbleMenu.show || !useUIStore.getState().showQuickCommands)
                return false;

              if (sideMenuHideTimeout) clearTimeout(sideMenuHideTimeout);

              const pos = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              if (pos && pos.pos >= 0) {
                const $pos = view.state.doc.resolve(pos.pos);
                if ($pos.depth >= 1) {
                  const blockNode = $pos.node(1);
                  const blockPos = $pos.before(1);

                  if (blockNode) {
                    const coords = view.coordsAtPos(blockPos);
                    const editorRect = view.dom.getBoundingClientRect();
                    if (editorRect) {
                      aiUI.setSideMenu({
                        y: coords.top - editorRect.top,
                        show: true,
                        pos: blockPos,
                        nodeName: blockNode.type.name,
                        editorId,
                      });
                    }
                  }
                } else {
                  aiUI.setSideMenu((prev) => ({ ...prev, show: false }));
                }
              }
              return false;
            },
            mouseleave() {
              if (sideMenuHideTimeout) clearTimeout(sideMenuHideTimeout);
              sideMenuHideTimeout = setTimeout(() => {
                useAIUIStore
                  .getState()
                  .setSideMenu((prev) => ({ ...prev, show: false }));
              }, 400);
              return false;
            },
          },
        },
      }),
    );

    // Right-click context menu.
    ctx.registerProsePlugin(
      new Plugin({
        props: {
          handleDOMEvents: {
            contextmenu(view, event) {
              event.preventDefault();
              const pos = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              const editorRect = view.dom.parentElement?.getBoundingClientRect();
              useAIUIStore.getState().setContextMenu({
                x: event.clientX - (editorRect?.left || 0),
                y: event.clientY - (editorRect?.top || 0),
                show: true,
                pos: pos ? pos.pos : view.state.selection.from,
                editorId,
              });
              return true;
            },
          },
        },
      }),
    );

    // Selection bubble menu — tracks the current selection and active formats.
    ctx.registerProsePlugin(
      new Plugin({
        view() {
          return {
            update(view) {
              const { state } = view;
              const { from, to } = state.selection;

              if (from === to) {
                useAIUIStore
                  .getState()
                  .setBubbleMenu((prev) => ({ ...prev, show: false }));
                useAIUIStore.getState().setShowAiPopover(false);
                return;
              }

              const start = view.coordsAtPos(from);
              const end = view.coordsAtPos(to);
              const left = (start.left + end.left) / 2;

              const editorRect = view.dom.parentElement?.getBoundingClientRect();
              if (editorRect) {
                const { from, $from, to, empty } = state.selection;

                const formats: Record<string, boolean> = {
                  bold:
                    state.doc.rangeHasMark(from, to, schema.marks.strong) ||
                    (empty &&
                      !!schema.marks.strong.isInSet(
                        state.storedMarks || $from.marks(),
                      )),
                  italic:
                    state.doc.rangeHasMark(from, to, schema.marks.em) ||
                    (empty &&
                      !!schema.marks.em.isInSet(
                        state.storedMarks || $from.marks(),
                      )),
                  underline:
                    state.doc.rangeHasMark(from, to, schema.marks.underline) ||
                    (empty &&
                      !!schema.marks.underline.isInSet(
                        state.storedMarks || $from.marks(),
                      )),
                  strike:
                    state.doc.rangeHasMark(from, to, schema.marks.strike) ||
                    (empty &&
                      !!schema.marks.strike.isInSet(
                        state.storedMarks || $from.marks(),
                      )),
                  code:
                    state.doc.rangeHasMark(from, to, schema.marks.code) ||
                    (empty &&
                      !!schema.marks.code.isInSet(
                        state.storedMarks || $from.marks(),
                      )),
                  h1:
                    $from.parent.type.name === "heading" &&
                    $from.parent.attrs.level === 1,
                  h2:
                    $from.parent.type.name === "heading" &&
                    $from.parent.attrs.level === 2,
                  h3:
                    $from.parent.type.name === "heading" &&
                    $from.parent.attrs.level === 3,
                  alignLeft:
                    $from.parent.attrs.align === "left" ||
                    !$from.parent.attrs.align,
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
                useAIUIStore.getState().setActiveFormats(formats);

                useAIUIStore.getState().setBubbleMenu({
                  x: left - editorRect.left,
                  y: start.top - editorRect.top - 45,
                  show: true,
                  editorId,
                });
              }
            },
          };
        },
      }),
    );

    // TTS highlight — renders a transient highlight decoration.
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

    // Typewriter scrolling — keeps the cursor vertically centered.
    ctx.registerProsePlugin(
      new Plugin({
        view() {
          return {
            update(view) {
              if (!useAIUIStore.getState().isTypewriter) return;
              const { state } = view;
              const { selection } = state;
              if (!selection.empty) return;

              // Avoid scrolling for the first few lines of a new document.
              if (selection.from < 50) return;

              const coords = view.coordsAtPos(selection.from);
              const editorRect = view.dom.getBoundingClientRect();
              if (!editorRect) return;

              const viewportHeight = window.innerHeight;
              const targetY = viewportHeight / 2;
              const currentY = coords.top;

              const diff = currentY - targetY;

              // Only scroll if we are below the target point.
              if (diff > 0 && Math.abs(diff) > 20) {
                const scrollContainer = view.dom.parentElement;
                if (scrollContainer) {
                  scrollContainer.scrollBy({ top: diff, behavior: "smooth" });
                }
              }
            },
          };
        },
      }),
    );
  },
};
