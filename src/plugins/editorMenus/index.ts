import { Plugin } from "prosemirror-state";
import type { InkPlugin, PluginContext } from "../types";

/**
 * Manages hover side menu, right-click context menu, and selection bubble
 * menu by translating ProseMirror view events into aiUIStore state that
 * the React menu components read.
 *
 * Extracted from the monolithic `editorUIPlugin` (Sprint 3) so each menu
 * concern is its own plugin that can be disabled independently.
 */
export const editorMenusPlugin: InkPlugin = {
  id: "editorMenus",
  name: "Editor Menus",
  version: "1.0.0",
  essential: true,
  init(ctx: PluginContext) {
    const { stores } = ctx;
    // Scope multiple editors so they don't share menu state.
    const editorId = ctx.editor.editorId ?? "";
    let sideMenuHideTimeout: ReturnType<typeof setTimeout> | null = null;

    // ── Hover side menu ────────────────────────────────────────────────
    ctx.registerProsePlugin(
      new Plugin({
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const aiUI = stores.aiUI.getState();
              // Don't show side menu while the bubble menu is visible.
              if (aiUI.bubbleMenu.show || !stores.ui.getState().showQuickCommands) return false;

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
                stores.aiUI.getState().setSideMenu((prev) => ({ ...prev, show: false }));
              }, 400);
              return false;
            },
          },
        },
      }),
    );

    // ── Right-click context menu ───────────────────────────────────────
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
              stores.aiUI.getState().setContextMenu({
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

    // ── Selection bubble menu (position + visibility only) ──────────────
    // Active formats are tracked by the separate `editorActiveFormats` plugin.
    ctx.registerProsePlugin(
      new Plugin({
        view() {
          return {
            update(view) {
              const { state } = view;
              const { from, to } = state.selection;

              if (from === to) {
                stores.aiUI.getState().setBubbleMenu((prev) => ({ ...prev, show: false }));
                return;
              }

              const start = view.coordsAtPos(from);
              const end = view.coordsAtPos(to);
              const left = (start.left + end.left) / 2;

              const editorRect = view.dom.parentElement?.getBoundingClientRect();
              if (editorRect) {
                stores.aiUI.getState().setBubbleMenu({
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
  },
};
