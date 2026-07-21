// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PanelSlot } from "../components/layout/PanelSlot";

afterEach(cleanup);

function Fixture({
  isOpen = true,
  onClose,
  side,
}: { isOpen?: boolean; onClose?: () => void; side?: "start" | "end" }) {
  return (
    <PanelSlot
      isOpen={isOpen}
      onClose={onClose ?? vi.fn()}
      side={side}
      title="Test Panel"
    >
      <button>Action 1</button>
      <button>Action 2</button>
      <p>Panel content</p>
    </PanelSlot>
  );
}

describe("PanelSlot", () => {
  it("renders nothing when closed", () => {
    render(<Fixture isOpen={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders content when open", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Panel content")).toBeTruthy();
  });

  it("renders the title", () => {
    render(<Fixture />);
    expect(screen.getByText("Test Panel")).toBeTruthy();
  });

  it("renders a close button with aria-label", () => {
    render(<Fixture />);
    expect(screen.getByLabelText("Close panel")).toBeTruthy();
  });

  it("does not render the close button when showCloseButton is false", () => {
    render(
      <PanelSlot isOpen onClose={vi.fn()} title="Test" showCloseButton={false}>
        <p>Content</p>
      </PanelSlot>,
    );
    expect(screen.queryByLabelText("Close panel")).toBeNull();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    const backdrop = document.querySelector('[class*="bg-black"]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it("moves focus into the panel on open", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab focus within the panel", () => {
    render(<Fixture />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("supports side='start'", () => {
    const { container } = render(<Fixture side="start" />);
    const panel = screen.getByRole("dialog");
    // Should have start-0 (logical left/start positioning)
    expect(panel.className).toContain("start-0");
    expect(panel.className).toContain("border-e");
  });

  it("defaults to side='end'", () => {
    render(<Fixture />);
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("end-0");
    expect(panel.className).toContain("border-s");
  });

  it("renders without backdrop when showBackdrop is false", () => {
    render(
      <PanelSlot isOpen onClose={vi.fn()} title="Test" showBackdrop={false}>
        <p>Content</p>
      </PanelSlot>,
    );
    const backdrop = document.querySelector('[class*="bg-black"]');
    expect(backdrop).toBeNull();
  });

  it("accepts custom width", () => {
    render(
      <PanelSlot isOpen onClose={vi.fn()} title="Test" width="600px">
        <p>Content</p>
      </PanelSlot>,
    );
    const panel = screen.getByRole("dialog");
    expect(panel.style.width).toBe("600px");
  });
});
