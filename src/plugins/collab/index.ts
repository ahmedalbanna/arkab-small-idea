import * as Y from "yjs";
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from "y-prosemirror";
import { keymap } from "prosemirror-keymap";
import type { Plugin } from "prosemirror-state";
import { Awareness } from "y-protocols/awareness";
import type { InkPlugin, PluginContext } from "../types";
import { createConnectionManager, type ConnectionManagerHandle } from "./connection";
import { CollabStatusIndicator } from "./CollabStatus";

export interface CollabConfig {
  docId: string;
  username?: string;
  color?: string;
  /** WebSocket server URL for remote collaboration.  Omit for local-only. */
  serverUrl?: string;
}

/** Editor-supplied collaboration options: the document config plus a toggle. */
export type CollabPluginOptions = CollabConfig & { enabled: boolean };

/**
 * Build a Collaboration plugin instance bound to a single document.
 *
 * When a `serverUrl` is provided the plugin will connect to the remote
 * collaboration server and also set up a local BroadcastChannel for
 * same-browser tab-to-tab sync.  Without a server URL it falls back to
 * BroadcastChannel only (local multi-tab editing).
 */
export function createCollabPlugin(config: CollabConfig): InkPlugin {
  let ydoc: Y.Doc | null = null;
  let type: Y.XmlFragment | null = null;
  let awareness: Awareness | null = null;
  let channel: BroadcastChannel | null = null;
  let connManager: ConnectionManagerHandle | null = null;

  return {
    id: "collab",
    name: "Collaboration",
    version: "2.0.0",
    essential: true,

    init(ctx: PluginContext) {
      ydoc = new Y.Doc();
      type = ydoc.getXmlFragment("prosemirror");

      // Local awareness for remote cursors/presence.
      awareness = new Awareness(ydoc);
      awareness.setLocalStateField("user", {
        name: config.username || "Anonymous Writer",
        color: config.color || "#" + Math.floor(Math.random() * 16777215).toString(16),
      });

      // ---- Transport ----
      if (config.serverUrl) {
        // Remote collaboration via WebSocket + local BroadcastChannel
        connManager = createConnectionManager({
          doc: ydoc,
          awareness,
          serverUrl: config.serverUrl,
          roomName: config.docId,
          username: config.username,
          color: config.color,
        });
        connManager.connect();
      } else {
        // Local-only: sync across tabs using BroadcastChannel
        channel = new BroadcastChannel(`ink-quill-collab-${config.docId}`);
        ydoc.on("update", (update: Uint8Array) => {
          channel?.postMessage(update);
        });
        channel.onmessage = (event: MessageEvent) => {
          if (event.data instanceof Uint8Array) {
            Y.applyUpdate(ydoc, event.data);
          }
        };
      }

      // Register the CollabStatus UI component
      ctx.registerHost(CollabStatusIndicator);

      // ProseMirror collaboration plugins (works with both transports)
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
      if (connManager) {
        connManager.destroy();
        connManager = null;
      }
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
