// @vitest-environment node
import { describe, expect, it } from "vitest";
import { useCollabStore } from "../plugins/collab/collabStore";

describe("collabStore", () => {
  it("starts in disconnected state", () => {
    const state = useCollabStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.transport).toBe("broadcast");
    expect(state.connectedUsers).toEqual([]);
    expect(state.serverUrl).toBeNull();
    expect(state.roomName).toBeNull();
    expect(state.pendingOfflineChanges).toBe(0);
    expect(state.synced).toBe(false);
  });

  it("updates status", () => {
    useCollabStore.getState().setStatus("connected");
    expect(useCollabStore.getState().status).toBe("connected");
  });

  it("updates transport type", () => {
    useCollabStore.getState().setTransport("websocket");
    expect(useCollabStore.getState().transport).toBe("websocket");
  });

  it("tracks connected users", () => {
    const user = { name: "Alice", color: "#ff0000", clientId: 1 };
    useCollabStore.getState().setConnectedUsers([user]);
    expect(useCollabStore.getState().connectedUsers).toHaveLength(1);
    expect(useCollabStore.getState().connectedUsers[0].name).toBe("Alice");
  });

  it("tracks server URL and room name", () => {
    useCollabStore.getState().setServerUrl("ws://localhost:3010");
    useCollabStore.getState().setRoomName("my-doc");
    expect(useCollabStore.getState().serverUrl).toBe("ws://localhost:3010");
    expect(useCollabStore.getState().roomName).toBe("my-doc");
  });

  it("tracks pending offline changes", () => {
    useCollabStore.getState().setPendingOfflineChanges(5);
    expect(useCollabStore.getState().pendingOfflineChanges).toBe(5);
  });

  it("tracks sync state", () => {
    useCollabStore.getState().setSynced(true);
    expect(useCollabStore.getState().synced).toBe(true);
  });

  it("manages lifecycle callbacks", () => {
    const onConnect = () => {};
    const onDisconnect = () => {};
    const onSync = (_s: boolean) => {};
    useCollabStore.getState().setOnConnect(onConnect);
    useCollabStore.getState().setOnDisconnect(onDisconnect);
    useCollabStore.getState().setOnSync(onSync);
    expect(useCollabStore.getState().onConnect).toBe(onConnect);
    expect(useCollabStore.getState().onDisconnect).toBe(onDisconnect);
    expect(useCollabStore.getState().onSync).toBe(onSync);
  });

  it("reset restores initial state", () => {
    useCollabStore.getState().setStatus("connected");
    useCollabStore.getState().setTransport("websocket");
    useCollabStore.getState().setConnectedUsers([{ name: "Bob", color: "#00ff00", clientId: 2 }]);
    useCollabStore.getState().setPendingOfflineChanges(3);
    useCollabStore.getState().setSynced(true);
    useCollabStore.getState().reset();

    const state = useCollabStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.transport).toBe("broadcast");
    expect(state.connectedUsers).toEqual([]);
    expect(state.serverUrl).toBeNull();
    expect(state.roomName).toBeNull();
    expect(state.pendingOfflineChanges).toBe(0);
    expect(state.synced).toBe(false);
    expect(state.onConnect).toBeNull();
    expect(state.onDisconnect).toBeNull();
    expect(state.onSync).toBeNull();
  });
});
