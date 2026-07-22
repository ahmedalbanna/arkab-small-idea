/**
 * Connection manager for the collaboration transport layer.
 *
 * Wraps the WebSocket transport and BroadcastChannel with a unified
 * connect / disconnect / destroy lifecycle, and syncs state into the
 * collab store so React components can react to changes.
 */

import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import {
  type WebSocketTransportHandle,
  createWebSocketTransport,
  type WebSocketTransportOptions,
} from "./websocket";
import { useCollabStore, type CollabTransport, type CollabStatus } from "./collabStore";

export interface ConnectionManagerOptions {
  /** Yjs document to sync. */
  doc: Y.Doc;
  /** Awareness instance (optional — created from doc if omitted). */
  awareness?: Awareness;
  /** WebSocket server URL.  Set to null/empty to use only BroadcastChannel. */
  serverUrl?: string;
  /** Room / document name. */
  roomName: string;
  /** Local user display name. */
  username?: string;
  /** Local user cursor colour. */
  color?: string;
  /** Maximum backoff time in ms (default 10000). */
  maxBackoffTime?: number;
}

export type ConnectionState = CollabStatus;

export interface ConnectionManagerHandle {
  /** The active Yjs document. */
  readonly doc: Y.Doc;
  /** Current connection state. */
  readonly state: ConnectionState;
  /** Active transport type. */
  readonly transport: CollabTransport;

  /** Connect to the collaboration server (and start BroadcastChannel for local tabs). */
  connect: () => void;
  /** Disconnect from the collaboration server. */
  disconnect: () => void;
  /** Clean up all resources.  Must be called on unmount. */
  destroy: () => void;
}

/**
 * Create a connection manager that manages the WebSocket transport (via
 * y-websocket's WebsocketProvider — which handles its own reconnection
 * with exponential backoff) and a local BroadcastChannel for tab-to-tab
 * sync.
 */
export function createConnectionManager(
  options: ConnectionManagerOptions,
): ConnectionManagerHandle {
  const {
    doc,
    roomName,
    username = "Anonymous",
    color = "#" +
      Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0"),
    serverUrl,
  } = options;

  let transportHandle: WebSocketTransportHandle | null = null;
  let destroyed = false;

  // ---- Local broadcast channel for tab-to-tab sync ----
  let broadcastChannel: BroadcastChannel | null = null;

  function setupBroadcastChannel(): void {
    if (destroyed) return;
    broadcastChannel = new BroadcastChannel(`ink-quill-collab-${roomName}`);
    broadcastChannel.onmessage = (event: MessageEvent) => {
      if (event.data instanceof Uint8Array) {
        Y.applyUpdate(doc, event.data);
      }
    };
    doc.on("update", (update: Uint8Array, _origin: unknown) => {
      if (broadcastChannel) {
        broadcastChannel.postMessage(update);
      }
    });
  }

  function teardownBroadcastChannel(): void {
    if (broadcastChannel) {
      broadcastChannel.onmessage = null;
      broadcastChannel.close();
      broadcastChannel = null;
    }
  }

  function connectWebSocket(): void {
    if (destroyed) return;

    const wsUrl = serverUrl || "";
    if (!wsUrl) {
      useCollabStore.getState().setStatus("connected");
      useCollabStore.getState().setTransport("broadcast");
      return;
    }

    useCollabStore.getState().setStatus("connecting");
    useCollabStore.getState().setTransport("websocket");

    if (transportHandle) {
      transportHandle.destroy();
    }

    const wsOptions: WebSocketTransportOptions = {
      doc,
      serverUrl: wsUrl,
      roomName,
      username,
      color,
      connect: true,
    };

    transportHandle = createWebSocketTransport(wsOptions);
  }

  // ---- Handle API ----

  const handle: ConnectionManagerHandle = {
    doc,
    get state(): ConnectionState {
      return useCollabStore.getState().status;
    },
    get transport(): CollabTransport {
      return useCollabStore.getState().transport;
    },

    connect: () => {
      if (destroyed) return;
      setupBroadcastChannel();
      connectWebSocket();
    },

    disconnect: () => {
      if (transportHandle) {
        transportHandle.provider.disconnect();
      }
      teardownBroadcastChannel();
      useCollabStore.getState().setStatus("disconnected");
    },

    destroy: () => {
      destroyed = true;
      handle.disconnect();
      if (transportHandle) {
        transportHandle.destroy();
        transportHandle = null;
      }
      useCollabStore.getState().reset();
    },
  };

  return handle;
}
