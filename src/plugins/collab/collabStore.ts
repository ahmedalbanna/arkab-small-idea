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
}

export interface CollabState {
  /** Current connection status. */
  status: CollabStatus;
  /** Active transport layer. */
  transport: CollabTransport;
  /** Connected remote users (removes self). */
  connectedUsers: ConnectedUser[];
  /** WebSocket server URL, or null for BroadcastChannel only. */
  serverUrl: string | null;
  /** The current room / document name. */
  roomName: string | null;

  // Actions
  setStatus: (status: CollabStatus) => void;
  setConnectedUsers: (users: ConnectedUser[]) => void;
  setTransport: (transport: CollabTransport) => void;
  setServerUrl: (url: string | null) => void;
  setRoomName: (name: string | null) => void;
  reset: () => void;
}

const initialState = {
  status: "disconnected" as CollabStatus,
  transport: "broadcast" as CollabTransport,
  connectedUsers: [] as ConnectedUser[],
  serverUrl: null as string | null,
  roomName: null as string | null,
};

export const useCollabStore = create<CollabState>()((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setConnectedUsers: (connectedUsers) => set({ connectedUsers }),
  setTransport: (transport) => set({ transport }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  setRoomName: (roomName) => set({ roomName }),
  reset: () => set(initialState),
}));
