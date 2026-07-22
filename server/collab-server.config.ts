import dotenv from "dotenv";
dotenv.config();

export interface CollabServerConfig {
  /** Port for the WebSocket collab server. Defaults to the API-only port + 1. */
  port: number;
  /** Path for the WebSocket endpoint (e.g. /ws-collab). */
  path: string;
  /** Maximum incoming message size in bytes. */
  maxMessageSize: number;
  /** Ping interval in ms to keep connections alive and detect drops. */
  pingInterval: number;
  /** Ping timeout in ms — if no pong arrives within this window, disconnect. */
  pingTimeout: number;
  /** Whether to enable LevelDB persistence of document state. */
  persistence: boolean;
  /** Directory for LevelDB persistence data (only used when persistence is true). */
  persistenceDir: string;
}

export function getCollabServerConfig(): CollabServerConfig {
  return {
    port: parseInt(process.env.COLLAB_WS_PORT || "3010", 10),
    path: process.env.COLLAB_WS_PATH || "/ws-collab",
    maxMessageSize: parseInt(process.env.COLLAB_MAX_MESSAGE_SIZE || "10000000", 10),
    pingInterval: parseInt(process.env.COLLAB_PING_INTERVAL || "30000", 10),
    pingTimeout: parseInt(process.env.COLLAB_PING_TIMEOUT || "10000", 10),
    persistence: process.env.COLLAB_PERSISTENCE === "true",
    persistenceDir: process.env.COLLAB_PERSISTENCE_DIR || "./collab-data",
  };
}
