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

export interface ConnectedUser {
  name: string;
  color: string;
  clientId: number;
  /** Optional avatar URL (data URI or URL). */
  avatar?: string;
}

/** Metadata about the local user published through awareness. */
export interface LocalUserMeta {
  name: string;
  color: string;
  avatar?: string;
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
  setOnConnect: (onConnect) => set({ onConnect }),
  setOnDisconnect: (onDisconnect) => set({ onDisconnect }),
  setOnSync: (onSync) => set({ onSync }),
  reset: () => set(initialState),
}));
