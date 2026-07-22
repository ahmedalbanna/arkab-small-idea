/**
 * WebSocket transport adapter wrapping y-websocket's WebsocketProvider.
 *
 * Creates a WebsocketProvider connected to the collaboration server and
 * wires its events into the local collab store so React components can
 * react to connection state and remote user presence.
 */

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import { useCollabStore, type CollabStatus, type ConnectedUser } from "./collabStore";

export interface WebSocketTransportOptions {
  /** Yjs document to sync. */
  doc: Y.Doc;
  /** Awareness instance (defaults to one created from `doc`). */
  awareness?: Awareness;
  /** WebSocket server URL (e.g. "ws://localhost:3010"). */
  serverUrl: string;
  /** Room / document name. */
  roomName: string;
  /** Local user display name. */
  username?: string;
  /** Local user cursor colour. */
  color?: string;
  /** Whether to connect immediately (default true). */
  connect?: boolean;
  /** Maximum backoff time in ms (default 5000). */
  maxBackoffTime?: number;
  /** BroadcastChannel room name for local tab sync.  Set to empty to disable. */
  bcChannel?: string;
}

export interface WebSocketTransportHandle {
  provider: WebsocketProvider;
  destroy: () => void;
}

/**
 * Create a y-websocket WebsocketProvider and bind it to the local collab
 * store for status / awareness tracking.
 *
 * Caller is responsible for calling `destroy()` during cleanup to disconnect
 * the provider and remove event listeners.
 */
export function createWebSocketTransport(
  options: WebSocketTransportOptions,
): WebSocketTransportHandle {
  const {
    doc,
    serverUrl,
    roomName,
    username = "Anonymous",
    color = "#" +
      Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0"),
    connect = true,
    maxBackoffTime = 5000,
  } = options;

  // y-websocket appends "/<roomName>" to the base URL automatically
  const baseUrl = serverUrl.replace(/\/+$/, "");

  const awareness = options.awareness ?? new Awareness(doc);
  awareness.setLocalStateField("user", { name: username, color });

  const store = useCollabStore.getState();
  store.setServerUrl(serverUrl);
  store.setRoomName(roomName);
  store.setTransport("websocket");

  const provider = new WebsocketProvider(baseUrl, roomName, doc, {
    connect,
    awareness,
    maxBackoffTime,
  });

  // ---- Wire provider events into the store ----

  const onStatus = (event: { status: string }) => {
    const collabStore = useCollabStore.getState();
    let mapped: CollabStatus;
    switch (event.status) {
      case "connected":
        mapped = "connected";
        break;
      case "connecting":
        mapped = "connecting";
        break;
      case "disconnected":
        // If it was previously connected, treat as reconnecting
        mapped = collabStore.status === "connected" ? "reconnecting" : "disconnected";
        break;
      default:
        mapped = "disconnected";
    }
    collabStore.setStatus(mapped);
  };

  const onAwarenessChange = (_change: unknown, _conn: unknown) => {
    const states = awareness.getStates();
    const localId = doc.clientID;
    const users: ConnectedUser[] = [];

    for (const [clientId, state] of states) {
      if (clientId === localId) continue; // exclude self
      const user = (state as Record<string, unknown>)?.user as
        { name?: string; color?: string } | undefined;
      if (user) {
        users.push({
          name: user.name || "Unknown",
          color: user.color || "#666",
          clientId,
        });
      }
    }

    useCollabStore.getState().setConnectedUsers(users);
  };

  provider.on("status", onStatus);
  awareness.on("update", onAwarenessChange);

  return {
    provider,
    destroy: () => {
      provider.off("status", onStatus);
      awareness.off("update", onAwarenessChange);
      provider.disconnect();
      useCollabStore.getState().reset();
    },
  };
}
