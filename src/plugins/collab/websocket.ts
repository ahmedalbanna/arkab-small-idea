/**
 * WebSocket transport adapter wrapping y-websocket's WebsocketProvider.
 *
 * Creates a WebsocketProvider connected to the collaboration server and
 * wires its events into the local collab store so React components can
 * react to connection state and remote user presence.
 *
 * The awareness state is extended with optional avatar, cursor position
 * metadata, and selection range information so remote peers can render
 * richer presence indicators.
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
  /** Optional avatar URL / data URI. */
  avatar?: string;
  /** Whether to connect immediately (default true). */
  connect?: boolean;
  /** Maximum backoff time in ms (default 5000). */
  maxBackoffTime?: number;
}

export interface WebSocketTransportHandle {
  provider: WebsocketProvider;
  awareness: Awareness;
  destroy: () => void;
}

/**
 * Create a y-websocket WebsocketProvider and bind it to the local collab
 * store for status / awareness tracking.
 *
 * The awareness state is enriched with:
 *   user: { name, color, avatar? }
 *   cursor: { pos?, selection? }  (set externally by the editor)
 *
 * Caller is responsible for calling `destroy()` during cleanup.
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
    avatar,
    connect = true,
    maxBackoffTime = 5000,
  } = options;

  // y-websocket appends "/<roomName>" to the base URL automatically
  const baseUrl = serverUrl.replace(/\/+$/, "");

  const awareness = options.awareness ?? new Awareness(doc);

  // Enrich local awareness state with user metadata + cursor placeholder
  awareness.setLocalStateField("user", { name: username, color, avatar: avatar || null });

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
        collabStore.onConnect?.();
        break;
      case "connecting":
        mapped = "connecting";
        break;
      case "disconnected":
        mapped = collabStore.status === "connected" ? "reconnecting" : "disconnected";
        if (mapped === "disconnected") collabStore.onDisconnect?.();
        break;
      default:
        mapped = "disconnected";
    }
    collabStore.setStatus(mapped);
  };

  // Track sync state
  provider.on("sync", (synced: boolean) => {
    const collabStore = useCollabStore.getState();
    collabStore.setSynced(synced);
    collabStore.onSync?.(synced);
  });

  // Track awareness changes → update connectedUsers
  const onAwarenessChange = (_change: unknown, _conn: unknown) => {
    const states = awareness.getStates();
    const localId = doc.clientID;
    const users: ConnectedUser[] = [];

    for (const [clientId, state] of states) {
      if (clientId === localId) continue;
      const entry = state as Record<string, unknown> | undefined;
      const user = entry?.user as { name?: string; color?: string; avatar?: string } | undefined;
      if (user) {
        users.push({
          name: user.name || "Unknown",
          color: user.color || "#666",
          clientId,
          avatar: user.avatar,
        });
      }
    }

    useCollabStore.getState().setConnectedUsers(users);
  };

  provider.on("status", onStatus);
  awareness.on("update", onAwarenessChange);

  return {
    provider,
    awareness,
    destroy: () => {
      provider.off("status", onStatus);
      provider.off("sync", () => {});
      awareness.off("update", onAwarenessChange);
      provider.disconnect();
      useCollabStore.getState().reset();
    },
  };
}
