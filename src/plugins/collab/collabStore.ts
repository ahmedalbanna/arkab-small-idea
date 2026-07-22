/**
 * Zustand store for collaboration connection state.
 *
 * Tracks the status of the WebSocket transport, the list of connected
 * users (from awareness), and the current room / server URL so any
 * component in the tree can react to changes.
 */

import { create } from "zustand";

export type CollabStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type CollabTransport = "broadcast" | "websocket" | "webrtc";

/** Role assigned to a collaborator. */
export type CollabRole = "viewer" | "editor" | "admin";

/** Connection quality rating based on latency. */
export type ConnectionQuality = "excellent" | "good" | "fair" | "poor";

export interface LatencySample {
  /** Round-trip time in ms. */
  rtt: number;
  /** When the sample was taken. */
  timestamp: number;
}

export interface ConnectedUser {
  name: string;
  color: string;
  clientId: number;
  /** Optional avatar URL (data URI or URL). */
  avatar?: string;
  /** User role in the current session. */
  role?: CollabRole;
  /** Whether the user is currently typing. */
  isTyping?: boolean;
  /** The heading / section the user's cursor is in. */
  currentSection?: string;
  /** Last activity timestamp. */
  lastActive?: number;
}

/** Metadata about the local user published through awareness. */
export interface LocalUserMeta {
  name: string;
  color: string;
  avatar?: string;
  role?: CollabRole;
}

export interface CollabState {
  /** Current connection status. */
  status: CollabStatus;
  /** Active transport layer. */
  transport: CollabTransport;
  /** Connected remote users (excludes self). */
  connectedUsers: ConnectedUser[];
  /** WebSocket server URL, or null for BroadcastChannel only. */
  serverUrl: string | null;
  /** The current room / document name. */
  roomName: string | null;
  /** Number of offline changes buffered since last sync. */
  pendingOfflineChanges: number;
  /** Whether the initial sync has completed. */
  synced: boolean;

  // ---- Quality metrics (Step 5.1) ----
  /** Latest round-trip latency in milliseconds. */
  latency: number;
  /** Connection quality rating derived from latency. */
  connectionQuality: ConnectionQuality;
  /** Bytes received per second (approx). */
  bandwidth: number;
  /** Timestamp of the last successful ping. */
  lastPing: number | null;

  // ---- Session info (Step 5.2) ----
  /** Collaboration session ID (set by server on join). */
  sessionId: string | null;
  /** JWT or auth token for authenticated sessions. */
  authToken: string | null;
  /** Local user's role in the session. */
  localRole: CollabRole | null;

  // Lifecycle callbacks (set by the connection manager / plugin)
  onConnect: (() => void) | null;
  onDisconnect: (() => void) | null;
  onSync: ((synced: boolean) => void) | null;

  // Actions
  setStatus: (status: CollabStatus) => void;
  setConnectedUsers: (users: ConnectedUser[]) => void;
  setTransport: (transport: CollabTransport) => void;
  setServerUrl: (url: string | null) => void;
  setRoomName: (name: string | null) => void;
  setPendingOfflineChanges: (count: number) => void;
  setSynced: (synced: boolean) => void;
  setLatency: (latency: number) => void;
  setConnectionQuality: (quality: ConnectionQuality) => void;
  setBandwidth: (bandwidth: number) => void;
  setLastPing: (ts: number | null) => void;
  setSessionId: (id: string | null) => void;
  setAuthToken: (token: string | null) => void;
  setLocalRole: (role: CollabRole | null) => void;
  setOnConnect: (cb: (() => void) | null) => void;
  setOnDisconnect: (cb: (() => void) | null) => void;
  setOnSync: (cb: ((synced: boolean) => void) | null) => void;
  reset: () => void;
}

const initialState = {
  status: "disconnected" as CollabStatus,
  transport: "broadcast" as CollabTransport,
  connectedUsers: [] as ConnectedUser[],
  serverUrl: null as string | null,
  roomName: null as string | null,
  pendingOfflineChanges: 0,
  synced: false,
  latency: 0,
  connectionQuality: "excellent" as ConnectionQuality,
  bandwidth: 0,
  lastPing: null as number | null,
  sessionId: null as string | null,
  authToken: null as string | null,
  localRole: null as CollabRole | null,
  onConnect: null as (() => void) | null,
  onDisconnect: null as (() => void) | null,
  onSync: null as ((synced: boolean) => void) | null,
};

export const useCollabStore = create<CollabState>()((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setConnectedUsers: (connectedUsers) => set({ connectedUsers }),
  setTransport: (transport) => set({ transport }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  setRoomName: (roomName) => set({ roomName }),
  setPendingOfflineChanges: (pendingOfflineChanges) => set({ pendingOfflineChanges }),
  setSynced: (synced) => set({ synced }),
  setLatency: (latency) => set({ latency }),
  setConnectionQuality: (connectionQuality) => set({ connectionQuality }),
  setBandwidth: (bandwidth) => set({ bandwidth }),
  setLastPing: (lastPing) => set({ lastPing }),
  setSessionId: (sessionId) => set({ sessionId }),
  setAuthToken: (authToken) => set({ authToken }),
  setLocalRole: (localRole) => set({ localRole }),
  setOnConnect: (onConnect) => set({ onConnect }),
  setOnDisconnect: (onDisconnect) => set({ onDisconnect }),
  setOnSync: (onSync) => set({ onSync }),
  reset: () => set(initialState),
}));
