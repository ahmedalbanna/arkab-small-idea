import * as Y from "yjs";
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from "y-prosemirror";
import { keymap } from "prosemirror-keymap";
import { Plugin } from "prosemirror-state";
import { Awareness } from "y-protocols/awareness";
import type { InkPlugin, PluginContext } from "../types";

export interface CollabConfig {
  docId: string;
  username?: string;
  color?: string;
}

/** Editor-supplied collaboration options: the document config plus a toggle. */
export type CollabPluginOptions = CollabConfig & { enabled: boolean };

/**
 * Build a Collaboration plugin instance bound to a single document.
 *
 * Registering it through the plugin registry gives it the same `init`/`destroy`
 * lifecycle as every other feature: the Yjs document, awareness and
 * BroadcastChannel it allocates are torn down deterministically on editor
 * unmount (and when the plugin is disabled) instead of being created ad-hoc
 * inside the editor view. Previously the collab plugins were wired inline in
 * `useEditorView`, which had no managed cleanup path.
 *
 * The plugin is intentionally `essential` so it is not surfaced as a user
 * toggle in Settings — its enablement is driven by the editor's `collab` prop
 * (per-document), not the global disabled-plugins set.
 */
export function createCollabPlugin(config: CollabConfig): InkPlugin {
  let ydoc: Y.Doc | null = null;
  let type: Y.XmlFragment | null = null;
  let awareness: Awareness | null = null;
  let channel: BroadcastChannel | null = null;

  return {
    id: "collab",
    name: "Collaboration",
    version: "1.0.0",
    essential: true,

    init(ctx: PluginContext) {
      ydoc = new Y.Doc();
      type = ydoc.getXmlFragment("prosemirror");

      // Local awareness for remote cursors/presence.
      awareness = new Awareness(ydoc);
      awareness.setLocalStateField("user", {
        name: config.username || "Anonymous Writer",
        color:
          config.color ||
          "#" + Math.floor(Math.random() * 16777215).toString(16),
      });

      // Sync across tabs using BroadcastChannel (simple local collab).
      channel = new BroadcastChannel(`ink-quill-collab-${config.docId}`);
      ydoc.on("update", (update: Uint8Array) => {
        channel?.postMessage(update);
      });
      channel.onmessage = (event: MessageEvent) => {
        if (event.data instanceof Uint8Array) {
          Y.applyUpdate(ydoc, event.data);
        }
      };

      const plugins: Plugin[] = [
        ySyncPlugin(type),
        yCursorPlugin(awareness),
        yUndoPlugin(),
        keymap({
          "Mod-z": undo,
          "Mod-y": redo,
          "Mod-Shift-z": redo,
        }),
      ];

      for (const plugin of plugins) {
        ctx.registerProsePlugin(plugin);
      }
    },

    destroy() {
      if (channel) {
        channel.onmessage = null;
        channel.close();
        channel = null;
      }
      if (awareness) {
        awareness.destroy();
        awareness = null;
      }
      if (ydoc) {
        ydoc.destroy();
        ydoc = null;
      }
      type = null;
    },
  };
}
