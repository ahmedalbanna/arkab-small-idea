// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "../components/editor/CommandPalette";
import type { EditorCommand } from "../plugins/types";

afterEach(cleanup);

function makeCommands(): EditorCommand[] {
  return [
    { id: "bold", label: "Bold", key: "Mod-b", run: vi.fn() },
    { id: "italic", label: "Italic", run: vi.fn() },
    { id: "h1", label: "Heading 1", run: vi.fn() },
  ];
}

describe("CommandPalette", () => {
  it("renders every command when the query is empty", () => {
    render(
      <CommandPalette
        commands={makeCommands()}
        onRun={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Bold")).toBeTruthy();
    expect(screen.getByText("Italic")).toBeTruthy();
    expect(screen.getByText("Heading 1")).toBeTruthy();
  });

  it("filters commands by substring (label/id/key)", () => {
    render(
      <CommandPalette
        commands={makeCommands()}
        onRun={() => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText("Search commands…");
    fireEvent.change(input, { target: { value: "ita" } });
    expect(screen.queryByText("Bold")).toBeNull();
    expect(screen.getByText("Italic")).toBeTruthy();
  });

  it("runs the highlighted command on Enter and closes on Escape", () => {
    const onRun = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette commands={makeCommands()} onRun={onRun} onClose={onClose} />,
    );
    const input = screen.getByPlaceholderText("Search commands…");
    // Move highlight down to index 1 (Italic), then Enter.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0][0].id).toBe("italic");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("runs a command when its row is clicked", () => {
    const onRun = vi.fn();
    render(
      <CommandPalette commands={makeCommands()} onRun={onRun} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText("Heading 1"));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0][0].id).toBe("h1");
  });

  it("shows an empty state when nothing matches", () => {
    render(
      <CommandPalette
        commands={makeCommands()}
        onRun={() => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText("Search commands…");
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("No commands found")).toBeTruthy();
  });
});
