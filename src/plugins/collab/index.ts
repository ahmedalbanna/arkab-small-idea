import * as Y from "yjs";
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from "y-prosemirror";
import { keymap } from "prosemirror-keymap";
import type { Plugin } from "prosemirror-state";
import { Awareness } from "y-protocols/awareness";
import type { InkPlugin, PluginContext } from "../types";
import {
  createConnectionManager,
  type ConnectionManagerHandle,
  type TransportMode,
} from "./connection";
import { CollabUsersList } from "./UserList";

export interface CollabConfig {
  docId: string;
  username?: string;
  color?: string;
  /** WebSocket server URL for remote collaboration.  Omit for local-only. */
  serverUrl?: string;
  /** Preferred transport mode. Defaults to 'websocket' when serverUrl is set. */
  transport?: TransportMode;
  /** Enable y-indexeddb persistence for offline support (default: true). */
  persist?: boolean;
  /** Optional avatar URL / data URI. */
  avatar?: string;
  /** Lifecycle callback: fired when connection is established. */
  onConnect?: () => void;
  /** Lifecycle callback: fired when connection is lost. */
  onDisconnect?: () => void;
  /** Lifecycle callback: fired when sync state changes. */
  onSync?: (synced: boolean) => void;
}

/** Editor-supplied collaboration options: the document config plus a toggle. */
export type CollabPluginOptions = CollabConfig & { enabled: boolean };

/**
 * Build a Collaboration plugin instance bound to a single document.
 *
 * When a `serverUrl` is provided the plugin will connect to the remote
 * collaboration server via WebSocket.  Without a server URL it falls back to
 * BroadcastChannel only (local multi-tab editing).
 *
 * Persistence (y-indexeddb) is enabled by default, providing offline resilience
 * and automatic state restoration on page reload.
 *
 * ## Lifecycle
 * - `onConnect`: called after WebSocket connection established
 * - `onDisconnect`: called when WebSocket connection lost
 * - `onSync`: called when Yjs sync state changes (true = fully synced)
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
    version: "3.0.0",
    essential: true,

    init(ctx: PluginContext) {
      ydoc = new Y.Doc();
      type = ydoc.getXmlFragment("prosemirror");

      // Local awareness for remote cursors/presence.
      awareness = new Awareness(ydoc);
      const userColor = config.color || "#" + Math.floor(Math.random() * 16777215).toString(16);
      awareness.setLocalStateField("user", {
        name: config.username || "Anonymous Writer",
        color: userColor,
        avatar: config.avatar || null,
      });

      // ---- Transport with persistence ----
      if (config.serverUrl) {
        // Remote collaboration via WebSocket + local BroadcastChannel + persistence
        connManager = createConnectionManager({
          doc: ydoc,
          awareness,
          serverUrl: config.serverUrl,
          roomName: config.docId,
          username: config.username,
          color: userColor,
          avatar: config.avatar,
          transport: config.transport,
          persist: config.persist !== false,
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

      // Wire lifecycle callbacks from config into the collab store
      if (config.onConnect || config.onDisconnect || config.onSync) {
        const { useCollabStore } = require("./collabStore");
        const store = useCollabStore.getState();
        if (config.onConnect) store.setOnConnect(config.onConnect);
        if (config.onDisconnect) store.setOnDisconnect(config.onDisconnect);
        if (config.onSync) store.setOnSync(config.onSync);
      }

      // Register the CollabStatus UI component (includes status dot + user avatars)
      ctx.registerHost(CollabUsersList);

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
