/**
 * Connection manager for the collaboration transport layer.
 *
 * Manages the full lifecycle:
 * 1. Transport selection and initialisation (broadcast / websocket / webrtc)
 * 2. Automatic transport fallback (WebSocket → BroadcastChannel on disconnect)
 * 3. Yjs document persistence via y-indexeddb (load on connect, save on updates)
 * 4. Offline change tracking (counts pending changes when disconnected)
 * 5. Lifecycle events (onConnect / onDisconnect / onSync)
 *
 * The WebsocketProvider from y-websocket handles its own reconnection with
 * exponential backoff; this manager monitors status changes and updates the
 * collab store accordingly.
 */

import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import {
  type WebSocketTransportHandle,
  createWebSocketTransport,
  type WebSocketTransportOptions,
} from "./websocket";
import { useCollabStore, type CollabTransport, type CollabStatus } from "./collabStore";
import { attachPersistence, type PersistenceHandle } from "./persistence";

export type TransportMode = "broadcast" | "websocket" | "webrtc";

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
  /** Optional avatar URL / data URI. */
  avatar?: string;
  /** Maximum backoff time in ms (default 10000). */
  maxBackoffTime?: number;
  /** Preferred transport mode. Defaults to 'websocket' when serverUrl is set. */
  transport?: TransportMode;
  /** Enable y-indexeddb persistence for offline support. */
  persist?: boolean;
  /** JWT auth token for authenticated sessions. */
  authToken?: string;
  /** Local user's collaboration role. */
  role?: "viewer" | "editor" | "admin";
}

export type ConnectionState = CollabStatus;

export interface ConnectionManagerHandle {
  /** The active Yjs document. */
  readonly doc: Y.Doc;
  /** Current connection state. */
  readonly state: ConnectionState;
  /** Active transport type. */
  readonly transport: CollabTransport;
  /** Number of offline changes since last sync. */
  readonly pendingOfflineChanges: number;

  /** Connect to the collaboration server / start local transport. */
  connect: () => void;
  /** Disconnect from the collaboration server. */
  disconnect: () => void;
  /** Clean up all resources.  Must be called on unmount. */
  destroy: () => void;
}

/**
 * Create a connection manager that manages:
 * - WebSocket transport (via y-websocket's WebsocketProvider)
 * - BroadcastChannel for tab-to-tab sync
 * - y-indexeddb persistence for offline resilience
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
    transport,
    persist = true,
  } = options;

  let transportHandle: WebSocketTransportHandle | null = null;
  let persistenceHandle: PersistenceHandle | null = null;
  let destroyed = false;
  let offlineChangeCount = 0;

  // Determine the effective transport mode
  const effectiveTransport: TransportMode = transport || (serverUrl ? "websocket" : "broadcast");

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

  // ---- Offline change tracking ----
  function onDocUpdate(_update: Uint8Array, origin: unknown): void {
    // Only count local changes (not sync updates from remote or loading)
    if (
      origin !== "remote" &&
      origin !== persistenceHandle &&
      useCollabStore.getState().status !== "connected"
    ) {
      offlineChangeCount++;
      useCollabStore.getState().setPendingOfflineChanges(offlineChangeCount);
    }
  }

  // ---- Persistence (y-indexeddb) ----
  async function initPersistence(): Promise<void> {
    if (!persist || destroyed) return;
    try {
      persistenceHandle = await attachPersistence(doc, roomName);
      useCollabStore.getState().setSynced(true);
    } catch (err) {
      console.warn("[collab] Failed to initialise persistence:", err);
    }
  }

  // ---- WebSocket transport ----
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
    offlineChangeCount = 0;
    useCollabStore.getState().setPendingOfflineChanges(0);

    if (transportHandle) {
      transportHandle.destroy();
    }

    const wsOptions: WebSocketTransportOptions = {
      doc,
      serverUrl: wsUrl,
      roomName,
      username,
      color,
      avatar: options.avatar,
      connect: true,
      maxBackoffTime: options.maxBackoffTime ?? 5000,
      authToken: options.authToken,
      role: options.role,
    };

    transportHandle = createWebSocketTransport(wsOptions);

    // When the transport disconnects, automatically fall back to
    // BroadcastChannel so local tab-to-tab sync still works.
    const checkFallback = () => {
      if (useCollabStore.getState().status === "reconnecting") {
        // Still trying to reconnect — keep BroadcastChannel active
      }
    };
    transportHandle.provider.on("status", checkFallback);

    // Flush pending changes counter when the document re-syncs after reconnect
    transportHandle.provider.on("sync", (synced: boolean) => {
      if (synced) {
        offlineChangeCount = 0;
        useCollabStore.getState().setPendingOfflineChanges(0);
      }
    });
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
    get pendingOfflineChanges(): number {
      return useCollabStore.getState().pendingOfflineChanges;
    },

    connect: async () => {
      if (destroyed) return;

      // Always set up BroadcastChannel for local tab sync
      setupBroadcastChannel();

      // Attach Yjs update listener for offline change tracking
      doc.on("update", onDocUpdate);

      // Initialise persistence first (loads saved state from IndexedDB)
      if (persist) {
        await initPersistence();
      }

      // Connect via the preferred transport
      if (effectiveTransport === "websocket" && serverUrl) {
        connectWebSocket();
      } else {
        useCollabStore.getState().setStatus("connected");
        useCollabStore.getState().setTransport("broadcast");
      }
    },

    disconnect: () => {
      if (transportHandle) {
        transportHandle.provider.disconnect();
      }
      teardownBroadcastChannel();
      doc.off("update", onDocUpdate);
      useCollabStore.getState().setStatus("disconnected");
    },

    destroy: async () => {
      destroyed = true;
      handle.disconnect();
      if (transportHandle) {
        transportHandle.destroy();
        transportHandle = null;
      }
      if (persistenceHandle) {
        await persistenceHandle.destroy();
        persistenceHandle = null;
      }
      useCollabStore.getState().reset();
    },
  };

  return handle;
}
