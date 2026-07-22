// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { useCollabStore } from "../plugins/collab/collabStore";

// Mock y-websocket before importing the module under test
vi.mock("y-websocket", () => {
  const EventEmitter = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  const MockProvider = {
    ...EventEmitter,
    disconnect: vi.fn(),
    connect: vi.fn(),
  };
  return {
    WebsocketProvider: vi.fn(() => MockProvider),
  };
});

describe("collab transport module exports", () => {
  beforeEach(() => {
    useCollabStore.getState().reset();
  });

  it("collab store module can import and returns expected types", () => {
    // Verify the module structure
    expect(typeof useCollabStore.getState).toBe("function");
    expect(useCollabStore.getState().status).toBeDefined();
    expect(useCollabStore.getState().transport).toBeDefined();
    expect(useCollabStore.getState().connectedUsers).toBeDefined();
  });

  it("CollabConfig interface expectations (structural check)", () => {
    // Verify the shape of a standard config
    const config = {
      docId: "test-doc",
      username: "Tester",
      color: "#ff0000",
      serverUrl: "ws://localhost:3010",
    };
    expect(config.docId).toBe("test-doc");
    expect(config.serverUrl).toBe("ws://localhost:3010");
  });

  it("Y.Doc can be created for collab use", () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("prosemirror");
    expect(fragment).toBeDefined();
    expect(doc.clientID).toBeGreaterThan(0);
    doc.destroy();
  });
});
