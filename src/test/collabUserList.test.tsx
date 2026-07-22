// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useCollabStore } from "../plugins/collab/collabStore";
import { CollabUsersList } from "../plugins/collab/UserList";

describe("CollabUsersList", () => {
  beforeEach(() => {
    useCollabStore.getState().reset();
  });

  it("renders nothing when disconnected", () => {
    const { container } = render(<CollabUsersList />);
    expect(container.textContent).toBe("");
  });

  it("renders status indicator when connected", () => {
    useCollabStore.getState().setStatus("connected");
    const { container } = render(<CollabUsersList />);
    expect(container.textContent).toContain("Connected");
  });

  it("renders user avatars when users are connected", () => {
    useCollabStore.getState().setStatus("connected");
    useCollabStore.getState().setConnectedUsers([
      { name: "Alice", color: "#ff0000", clientId: 1 },
      { name: "Bob", color: "#00ff00", clientId: 2 },
    ]);
    const { container } = render(<CollabUsersList />);
    expect(container.textContent).toContain("Connected");
    // Avatar initials
    expect(container.innerHTML).toContain("A");
    expect(container.innerHTML).toContain("B");
  });

  it("shows offline indicator when reconnecting with pending changes", () => {
    useCollabStore.getState().setStatus("connecting");
    useCollabStore.getState().setPendingOfflineChanges(3);
    const { container } = render(<CollabUsersList />);
    expect(container.textContent).toContain("pending");
  });

  it("hides offline indicator when connected with no pending changes", () => {
    useCollabStore.getState().setStatus("connected");
    useCollabStore.getState().setPendingOfflineChanges(0);
    const { container } = render(<CollabUsersList />);
    expect(container.textContent).not.toContain("pending");
  });
});
