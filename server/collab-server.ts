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
 *   messageAuth          = 2  – Authentication reply (unused by default)
 *   messageQueryAwareness = 3  – Request full awareness state
 *
 * The server holds Yjs documents in memory per room.  Optional LevelDB
 * persistence can be plugged in through the config.
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
// Protocol constants (mirror y-websocket / y-protocols)
// ---------------------------------------------------------------------------
const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2;
const messageQueryAwareness = 3;

// ---------------------------------------------------------------------------
// Per-room state
// ---------------------------------------------------------------------------
interface RoomState {
  /** Shared Yjs document for this room. */
  doc: Y.Doc;
  /** Awareness instance attached to the room's doc. */
  awareness: awarenessProtocol.Awareness;
  /** Connected clients for this room. */
  clients: Set<CollabClient>;
}

interface CollabClient {
  ws: WebSocket;
  /** Yjs clientID assigned by the Y.Doc (set after sync step 1). */
  clientId: number | null;
  /** Whether the client has completed initial sync. */
  synced: boolean;
  /** The room this client belongs to. */
  roomName: string;
  /** Ping interval handle for this client. */
  pingTimer: ReturnType<typeof setInterval> | null;
}

// ---------------------------------------------------------------------------
// Room manager — holds all active Yjs documents in memory
// ---------------------------------------------------------------------------
const startTime = Date.now();

class RoomManager {
  private rooms = new Map<string, RoomState>();

  /** Get or create a room. */
  getOrCreate(roomName: string): RoomState {
    let room = this.rooms.get(roomName);
    if (!room) {
      const doc = new Y.Doc();
      doc.gc = true;
      const awareness = new awarenessProtocol.Awareness(doc);
      awareness.setLocalState(null);

      room = { doc, awareness, clients: new Set() };
      this.rooms.set(roomName, room);

      // Broadcast awareness updates to all clients in the room
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

  /** Remove a client from a room and clean up if the room becomes empty. */
  removeClient(client: CollabClient): void {
    const room = this.rooms.get(client.roomName);
    if (!room) return;

    room.clients.delete(client);
    // Remove the client from awareness so others stop seeing their cursor
    if (client.clientId !== null) {
      awarenessProtocol.removeAwarenessStates(room.awareness, [client.clientId], "disconnect");
    }

    if (room.clients.size === 0) {
      // Schedule cleanup — gives a brief window for reconnection
      setTimeout(() => {
        if (room.clients.size === 0) {
          room.awareness.destroy();
          room.doc.destroy();
          this.rooms.delete(client.roomName);
        }
      }, 5000);
    }
  }

  /** Number of active rooms. */
  get roomCount(): number {
    return this.rooms.size;
  }

  /** Total connected clients across all rooms. */
  get clientCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.clients.size;
    }
    return total;
  }

  /** Return a health summary object. */
  getHealth(): Record<string, unknown> {
    return {
      rooms: this.roomCount,
      clients: this.clientCount,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
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

// ---------------------------------------------------------------------------
// Message handler for incoming WebSocket binary frames
// ---------------------------------------------------------------------------

function handleMessage(data: Uint8Array, client: CollabClient, room: RoomState): void {
  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case messageSync: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, room.doc, client);
      if (syncMessageType === syncProtocol.messageYjsSyncStep2 && !client.synced) {
        client.synced = true;
        client.clientId = room.doc.clientID;
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

    case messageAuth:
      // Auth is a reply to a permission-denied message — unused here
      break;

    default:
      console.warn(`[collab] Unknown message type: ${messageType}`);
  }
}

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

function setupClient(
  ws: WebSocket,
  roomName: string,
  manager: RoomManager,
  config: CollabServerConfig,
): CollabClient {
  const client: CollabClient = {
    ws,
    clientId: null,
    synced: false,
    roomName,
    pingTimer: null,
  };

  const room = manager.getOrCreate(roomName);
  room.clients.add(client);

  // Send the initial sync step 1 to the newly joined client
  sendSyncStep1(ws, room.doc);

  // Forward Yjs document updates from other clients to this client
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

  // Handle incoming binary messages
  ws.on("message", (data: Buffer) => {
    if (data.byteLength > config.maxMessageSize) {
      console.warn(`[collab] Message too large (${data.byteLength} bytes), dropping`);
      return;
    }
    handleMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), client, room);
  });

  // Handle close
  ws.on("close", () => {
    room.doc.off("update", updateHandler);
    if (client.pingTimer) clearInterval(client.pingTimer);
    manager.removeClient(client);
  });

  // Handle errors
  ws.on("error", (err) => {
    console.error(`[collab] WebSocket error for client in room "${roomName}":`, err.message);
    ws.close();
  });

  // Set up periodic ping to keep the connection alive
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
 *
 * Attaches to an existing HTTP server so it can share a port with Express.
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
    // Extract room name from the URL path after the base path
    // e.g. ws://host/ws-collab/doc123 → room = "doc123"
    const url = req.url || "/";
    const basePath = resolvedConfig.path;
    const roomName = url.slice(basePath.length).replace(/^\/+/, "").split("?")[0] || "default";

    console.log(`[collab] Client connected to room "${roomName}"`);
    setupClient(ws, roomName, manager, resolvedConfig);
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

/** Create a standalone collab server on its own port (useful for testing or separate deployment). */
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
