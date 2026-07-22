/**
 * Ink & Quill — Collaboration WebSocket Server
 *
 * Provides real-time Yjs document synchronisation and awareness broadcasting
 * over WebSocket. Each logical "room" maps to a unique document identified by
 * its URL path segment (e.g. ws://host/ws-collab/doc123 → room "doc123").
 *
 * Protocol (mirrors y-websocket / y-protocols):
 *   messageSync          = 0  – Yjs sync steps 1 & 2, document updates
 *   messageAwareness     = 1  – Cursor / presence updates
 *   messageAuth          = 2  – Authentication reply
 *   messageQueryAwareness = 3 – Request full awareness state
 *   messagePing          = 4  – Latency probe (client → server)
 *   messagePong          = 5  – Latency response (server → client)
 *
 * The server holds Yjs documents in memory per room.  Optional LevelDB
 * persistence can be plugged in through the config.
 *
 * ---
 * Phase 5 additions:
 * - messagePing / messagePong for latency measurement
 * - Token-based authentication via URL params
 * - Session management with collaborator roles
 * - Bandwidth tracking per client
 * - Health endpoint with per-room metrics
 */

import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { getCollabServerConfig, type CollabServerConfig } from "./collab-server.config";

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------
const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2;
const messageQueryAwareness = 3;
const messagePing = 4;
const messagePong = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CollabRole = "viewer" | "editor" | "admin";

export interface SessionInfo {
  /** Unique session identifier assigned on join. */
  id: string;
  /** Room this session belongs to. */
  roomName: string;
  /** User display name. */
  username: string;
  /** User role. */
  role: CollabRole;
  /** When the session was created. */
  joinedAt: number;
  /** Authenticated user ID (if auth is enabled). */
  userId?: string;
  /** Avatar URL. */
  avatar?: string;
}

interface RoomState {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<CollabClient>;
  /** Session metadata keyed by clientId. */
  sessions: Map<number, SessionInfo>;
  /** Timestamp of room creation. */
  createdAt: number;
}

interface CollabClient {
  ws: WebSocket;
  clientId: number | null;
  synced: boolean;
  roomName: string;
  pingTimer: ReturnType<typeof setInterval> | null;
  /** Session info for this client. */
  session: SessionInfo | null;
  /** Bytes received from this client. */
  bytesReceived: number;
  /** Last message timestamp. */
  lastActivity: number;
}

// ---------------------------------------------------------------------------
// Room manager
// ---------------------------------------------------------------------------

const startTime = Date.now();

class RoomManager {
  private rooms = new Map<string, RoomState>();

  getOrCreate(roomName: string): RoomState {
    let room = this.rooms.get(roomName);
    if (!room) {
      const doc = new Y.Doc();
      doc.gc = true;
      const awareness = new awarenessProtocol.Awareness(doc);
      awareness.setLocalState(null);

      room = { doc, awareness, clients: new Set(), sessions: new Map(), createdAt: Date.now() };
      this.rooms.set(roomName, room);

      awareness.on(
        "update",
        (
          { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
          _conn: unknown,
        ) => {
          const changed = added.concat(updated, removed);
          if (changed.length === 0) return;
          const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changed);
          for (const client of room!.clients) {
            if (client.ws.readyState === WebSocket.OPEN) {
              sendAwareness(client.ws, update);
            }
          }
        },
      );
    }
    return room;
  }

  removeClient(client: CollabClient): void {
    const room = this.rooms.get(client.roomName);
    if (!room) return;

    room.clients.delete(client);
    if (client.clientId !== null) {
      room.sessions.delete(client.clientId);
      awarenessProtocol.removeAwarenessStates(room.awareness, [client.clientId], "disconnect");
    }

    if (room.clients.size === 0) {
      setTimeout(() => {
        if (room.clients.size === 0) {
          room.awareness.destroy();
          room.doc.destroy();
          this.rooms.delete(client.roomName);
        }
      }, 5000);
    }
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  get clientCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.clients.size;
    }
    return total;
  }

  /** Return a detailed health summary. */
  getHealth(): Record<string, unknown> {
    const rooms = Array.from(this.rooms.entries()).map(([name, room]) => ({
      name,
      clients: room.clients.size,
      sessions: Array.from(room.sessions.values()).map((s) => ({
        id: s.id,
        username: s.username,
        role: s.role,
        joinedAt: s.joinedAt,
      })),
      createdAt: room.createdAt,
    }));
    return {
      rooms: this.roomCount,
      clients: this.clientCount,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      roomDetails: rooms,
    };
  }

  /** Validate and parse an auth token. Returns session data or null. */
  authenticate(
    token: string,
    _roomName: string,
  ): { username: string; role: CollabRole; userId?: string; avatar?: string } | null {
    // Simple token validation: a token is "user:<username>:<role>:<secret>"
    // In production, use JWT verification.
    if (!token.startsWith("user:")) return null;
    const parts = token.split(":");
    if (parts.length < 4) return null;
    const secret = process.env.COLLAB_SECRET || "ink-quill-dev-secret";
    if (parts[3] !== secret) return null;
    const role = parts[2] as CollabRole;
    if (!["viewer", "editor", "admin"].includes(role)) return null;
    return { username: parts[1], role, userId: parts[1] };
  }

  /** Generate an invite link for a room. */
  generateInvite(roomName: string, role: CollabRole = "editor"): string {
    const secret = process.env.COLLAB_SECRET || "ink-quill-dev-secret";
    // Token format: user:<username>:<role>:<secret> (username is "invited" for invites)
    const token = `user:invited:${role}:${secret}`;
    const baseUrl = process.env.COLLAB_URL || `http://localhost:${getCollabServerConfig().port}`;
    return `${baseUrl}/join/${roomName}?token=${encodeURIComponent(token)}`;
  }
}

// ---------------------------------------------------------------------------
// Message encoding helpers
// ---------------------------------------------------------------------------

function sendSyncStep1(ws: WebSocket, doc: Y.Doc): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));
}

function sendAwareness(ws: WebSocket, awarenessUpdate: Uint8Array): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(encoder, awarenessUpdate);
  ws.send(encoding.toUint8Array(encoder));
}

/** Send a pong response echoing the ping payload. */
function sendPong(ws: WebSocket, pingPayload: Uint8Array): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messagePong);
  encoding.writeVarUint8Array(encoder, pingPayload);
  ws.send(encoding.toUint8Array(encoder));
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

function handleMessage(data: Uint8Array, client: CollabClient, room: RoomState): void {
  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);

  client.lastActivity = Date.now();

  switch (messageType) {
    case messageSync: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, room.doc, client);
      if (syncMessageType === syncProtocol.messageYjsSyncStep2 && !client.synced) {
        client.synced = true;
        client.clientId = room.doc.clientID;
        // Assign session when sync completes
        if (client.session) {
          room.sessions.set(client.clientId, client.session);
        }
      }
      if (encoding.length(encoder) > 1) {
        client.ws.send(encoding.toUint8Array(encoder));
      }
      break;
    }

    case messageAwareness: {
      awarenessProtocol.applyAwarenessUpdate(
        room.awareness,
        decoding.readVarUint8Array(decoder),
        client,
      );
      break;
    }

    case messageQueryAwareness: {
      const states = Array.from(room.awareness.getStates().keys());
      if (states.length > 0) {
        const update = awarenessProtocol.encodeAwarenessUpdate(room.awareness, states);
        sendAwareness(client.ws, update);
      }
      break;
    }

    case messagePing: {
      // Echo the ping payload back as pong for client-side RTT measurement
      const payload = decoding.readVarUint8Array(decoder);
      sendPong(client.ws, payload);
      break;
    }

    case messageAuth: {
      // Auth is handled during connection setup (URL params) or via this message
      // For now, accept the auth message and reply with success
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAuth);
      encoding.writeUint8(encoder, 1); // success
      client.ws.send(encoding.toUint8Array(encoder));
      break;
    }

    default:
      console.warn(`[collab] Unknown message type: ${messageType}`);
  }
}

// ---------------------------------------------------------------------------
// Client setup with auth support
// ---------------------------------------------------------------------------

function parseAuthToken(url: string): string | null {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(url.slice(queryIndex));
  return params.get("token");
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function setupClient(
  ws: WebSocket,
  roomName: string,
  manager: RoomManager,
  config: CollabServerConfig,
  reqUrl?: string,
): CollabClient {
  // Try to authenticate via URL token
  let session: SessionInfo | null = null;
  if (reqUrl) {
    const token = parseAuthToken(reqUrl);
    if (token) {
      const auth = manager.authenticate(token, roomName);
      if (auth) {
        session = {
          id: generateSessionId(),
          roomName,
          username: auth.username,
          role: auth.role,
          joinedAt: Date.now(),
          userId: auth.userId,
          avatar: auth.avatar,
        };
      }
    }
  }

  // Default session for unauthenticated users (editor role)
  if (!session) {
    session = {
      id: generateSessionId(),
      roomName,
      username: `User-${Math.random().toString(36).substring(2, 6)}`,
      role: "editor",
      joinedAt: Date.now(),
    };
  }

  const client: CollabClient = {
    ws,
    clientId: null,
    synced: false,
    roomName,
    pingTimer: null,
    session,
    bytesReceived: 0,
    lastActivity: Date.now(),
  };

  const room = manager.getOrCreate(roomName);
  room.clients.add(client);

  // Send the initial sync step 1
  sendSyncStep1(ws, room.doc);

  // Forward Yjs document updates
  const updateHandler = (update: Uint8Array, origin: unknown) => {
    if (origin !== client) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoding.toUint8Array(encoder));
      }
    }
  };
  room.doc.on("update", updateHandler);

  // Incoming binary messages
  ws.on("message", (data: Buffer) => {
    client.bytesReceived += data.byteLength;
    if (data.byteLength > config.maxMessageSize) {
      console.warn(`[collab] Message too large (${data.byteLength} bytes), dropping`);
      return;
    }
    handleMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), client, room);
  });

  // Close handler
  ws.on("close", () => {
    room.doc.off("update", updateHandler);
    if (client.pingTimer) clearInterval(client.pingTimer);
    manager.removeClient(client);
  });

  // Error handler
  ws.on("error", (err) => {
    console.error(`[collab] WebSocket error for client in room "${roomName}":`, err.message);
    ws.close();
  });

  // Periodic ping to keep alive
  const pingTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingTimer);
    }
  }, config.pingInterval);
  client.pingTimer = pingTimer;

  return client;
}

// ---------------------------------------------------------------------------
// Server creation
// ---------------------------------------------------------------------------

export interface CollabServerHandle {
  wss: WebSocketServer;
  httpServer: http.Server;
  manager: RoomManager;
  close: () => Promise<void>;
}

/**
 * Create and start the collaboration WebSocket server.
 */
export function createCollabServer(
  httpServer: http.Server,
  config?: Partial<CollabServerConfig>,
): CollabServerHandle {
  const resolvedConfig = { ...getCollabServerConfig(), ...config };
  const manager = new RoomManager();

  const wss = new WebSocketServer({
    server: httpServer,
    path: resolvedConfig.path,
    maxPayload: resolvedConfig.maxMessageSize,
  });

  wss.on("connection", (ws: WebSocket, req) => {
    const url = req.url || "/";
    const basePath = resolvedConfig.path;
    const roomName = url.slice(basePath.length).replace(/^\/+/, "").split("?")[0] || "default";

    console.log(`[collab] Client connected to room "${roomName}"`);
    setupClient(ws, roomName, manager, resolvedConfig, req.url);
  });

  wss.on("error", (err: Error) => {
    console.error("[collab] WebSocket server error:", err.message);
  });

  const handle: CollabServerHandle = {
    wss,
    httpServer,
    manager,
    close: async () => {
      return new Promise((resolve) => {
        for (const ws of wss.clients) {
          ws.close(1001, "Server shutting down");
        }
        wss.close(() => resolve());
      });
    },
  };

  return handle;
}

/** Create a standalone collab server on its own port. */
export function createStandaloneCollabServer(
  config?: Partial<CollabServerConfig>,
): CollabServerHandle {
  const resolvedConfig = { ...getCollabServerConfig(), ...config };
  const httpServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "collab" }));
  });
  const handle = createCollabServer(httpServer, resolvedConfig);

  httpServer.listen(resolvedConfig.port, () => {
    console.log(
      `[collab] Standalone server listening on ws://0.0.0.0:${resolvedConfig.port}${resolvedConfig.path}`,
    );
  });

  return handle;
}
