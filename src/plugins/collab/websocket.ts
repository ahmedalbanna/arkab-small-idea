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
 *
 * ---
 * Step 5.1: Latency probing, bandwidth tracking, connection quality.
 * Step 5.2: Auth token passing, role support.
 * Step 5.3: Typing indicator, section tracking in awareness.
 */

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import {
  useCollabStore,
  type CollabStatus,
  type ConnectedUser,
  type ConnectionQuality,
  type CollabRole,
} from "./collabStore";

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
  /** JWT auth token for authenticated sessions. */
  authToken?: string;
  /** Local user's role. */
  role?: CollabRole;
}

export interface WebSocketTransportHandle {
  provider: WebsocketProvider;
  awareness: Awareness;
  destroy: () => void;
}

// ---- Custom protocol message types (mirrors server) ----
const messagePing = 4;
const messagePong = 5;

/**
 * Derive a quality rating from latency in ms.
 */
function latencyToQuality(latency: number): ConnectionQuality {
  if (latency < 50) return "excellent";
  if (latency < 150) return "good";
  if (latency < 300) return "fair";
  return "poor";
}

/**
 * Create a y-websocket WebsocketProvider and bind it to the local collab
 * store for status / awareness / quality tracking.
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
    authToken,
    role,
  } = options;

  // y-websocket appends "/<roomName>" to the base URL automatically
  const baseUrl = serverUrl.replace(/\/+$/, "");

  const awareness = options.awareness ?? new Awareness(doc);

  // Enrich local awareness with user metadata + role
  awareness.setLocalStateField("user", {
    name: username,
    color,
    avatar: avatar || null,
    role: role || null,
  });

  const store = useCollabStore.getState();
  store.setServerUrl(serverUrl);
  store.setRoomName(roomName);
  store.setTransport("websocket");
  if (authToken) store.setAuthToken(authToken);
  if (role) store.setLocalRole(role);

  const provider = new WebsocketProvider(baseUrl, roomName, doc, {
    connect,
    awareness,
    maxBackoffTime,
    // Pass auth token as URL param (server reads it from the connection URL)
    params: authToken ? { token: authToken } : undefined,
  });

  // ---- Latency probing (Step 5.1) ----

  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let pendingPingTimestamp: number | null = null;

  /**
   * Access the raw WebSocket from the provider to send custom binary messages.
   * Falls back gracefully if unavailable.
   */
  function sendBinaryMessage(type: number, payload?: Uint8Array): void {
    try {
      const ws = (provider as any).ws as WebSocket | null;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // Build message: [type, ...payload]
      const len = payload ? payload.length + 1 : 1;
      const buf = new Uint8Array(len);
      buf[0] = type;
      if (payload) buf.set(payload, 1);
      ws.send(buf);
    } catch {
      // WS not available
    }
  }

  function sendPing(): void {
    if (provider.shouldConnect && provider.synced) {
      const ts = performance.now();
      pendingPingTimestamp = ts;
      // Encode timestamp as 8-byte big-endian
      const tsBuf = new Uint8Array(8);
      new DataView(tsBuf.buffer).setFloat64(0, ts, false);
      sendBinaryMessage(messagePing, tsBuf);
    }
  }

  function handlePong(data: Uint8Array): void {
    if (data.length < 8) return;
    const sentTs = new DataView(data.buffer, data.byteOffset, 8).getFloat64(0, false);
    if (pendingPingTimestamp !== null && Math.abs(sentTs - pendingPingTimestamp) < 100) {
      const rtt = performance.now() - sentTs;
      const collabStore = useCollabStore.getState();
      collabStore.setLatency(Math.round(rtt));
      collabStore.setConnectionQuality(latencyToQuality(rtt));
      collabStore.setLastPing(Date.now());
      pendingPingTimestamp = null;
    }
  }

  // ---- Bandwidth tracking (Step 5.1) ----

  let bytesReceived = 0;
  let bandwidthSampleInterval: ReturnType<typeof setInterval> | null = null;

  function sampleBandwidth(): void {
    const collabStore = useCollabStore.getState();
    collabStore.setBandwidth(bytesReceived);
    bytesReceived = 0;
  }

  // ---- Wire provider events into the store ----

  const onStatus = (event: { status: string }) => {
    const collabStore = useCollabStore.getState();
    let mapped: CollabStatus;
    switch (event.status) {
      case "connected":
        mapped = "connected";
        collabStore.onConnect?.();
        // Start latency probing
        if (!pingInterval) {
          pingInterval = setInterval(sendPing, 5000);
        }
        if (!bandwidthSampleInterval) {
          bandwidthSampleInterval = setInterval(sampleBandwidth, 1000);
        }
        break;
      case "connecting":
        mapped = "connecting";
        break;
      case "disconnected":
        mapped = collabStore.status === "connected" ? "reconnecting" : "disconnected";
        if (mapped === "disconnected") collabStore.onDisconnect?.();
        // Stop probing
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (bandwidthSampleInterval) {
          clearInterval(bandwidthSampleInterval);
          bandwidthSampleInterval = null;
        }
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
      const user = entry?.user as
        { name?: string; color?: string; avatar?: string; role?: string } | undefined;
      if (user) {
        users.push({
          name: user.name || "Unknown",
          color: user.color || "#666",
          clientId,
          avatar: user.avatar,
          role: (user.role as CollabRole) || "editor",
          isTyping: !!entry?.typing,
          currentSection: (entry?.currentSection as string) || undefined,
          lastActive: Date.now(),
        });
      }
    }

    useCollabStore.getState().setConnectedUsers(users);
  };

  provider.on("status", onStatus);
  awareness.on("update", onAwarenessChange);

  // Intercept incoming raw messages for custom types (ping/pong)
  const origReceive = (provider as any).receiveMessage;
  if (origReceive) {
    (provider as any).receiveMessage = function (event: MessageEvent) {
      const data = event.data;
      if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        const buf = new Uint8Array(data);
        if (buf.length > 0) {
          const type = buf[0];
          if (type === messagePong) {
            handlePong(buf.slice(1));
            return; // Consumed
          }
        }
      }
      // Fall through to default handler
      origReceive.call(this, event);
    };
  }

  // Track bytes received for bandwidth estimation
  const origWsOpen = (provider as any)._wsOpen;
  if (origWsOpen) {
    (provider as any)._wsOpen = function () {
      const ws = (provider as any).ws;
      if (ws) {
        const origOnMessage = ws.onmessage;
        ws.onmessage = (event: MessageEvent) => {
          if (event.data && typeof event.data.byteLength === "number") {
            bytesReceived += event.data.byteLength;
          }
          if (origOnMessage) origOnMessage.call(ws, event);
        };
      }
      if (origWsOpen) origWsOpen.call(this);
    };
  }

  return {
    provider,
    awareness,
    destroy: () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (bandwidthSampleInterval) {
        clearInterval(bandwidthSampleInterval);
        bandwidthSampleInterval = null;
      }
      provider.off("status", onStatus);
      provider.off("sync", () => {});
      awareness.off("update", onAwarenessChange);
      provider.disconnect();
      useCollabStore.getState().reset();
    },
  };
}
