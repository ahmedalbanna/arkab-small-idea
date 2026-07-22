// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildCursorWidget, buildSelectionWidget } from "../plugins/collab/cursorUtils";

describe("collab cursor utils", () => {
  it("buildCursorWidget returns a DOM element with caret and label", () => {
    const el = buildCursorWidget({ user: { name: "Alice", color: "#ff0000" } });
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.className).toBe("collab-cursor");

    const label = el.querySelector("span:last-child");
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe("Alice");
  });

  it("buildCursorWidget falls back to ? when name is missing", () => {
    const el = buildCursorWidget({ user: { color: "#00ff00" } });
    const label = el.querySelector("span:last-child");
    expect(label?.textContent).toBe("?");
  });

  it("buildCursorWidget uses default color when not provided", () => {
    const el = buildCursorWidget({ user: { name: "Bob" } });
    const caret = el.querySelector("span:first-child") as HTMLElement;
    expect(caret.style.backgroundColor).toBe("rgb(102, 102, 102)"); // #666 parsed
  });

  it("buildSelectionWidget returns a styled DecorationAttrs", () => {
    const attrs = buildSelectionWidget({ user: { name: "Carol", color: "#0000ff" } });
    expect(attrs.class).toBe("collab-selection");
    expect(attrs.style).toContain("#0000ff");
  });
});
