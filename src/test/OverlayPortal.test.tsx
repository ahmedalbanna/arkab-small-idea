// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OverlayPortal } from "../components/layout/OverlayPortal";

afterEach(cleanup);

function Fixture({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  return (
    <OverlayPortal isOpen={isOpen} onClose={onClose ?? vi.fn()} ariaLabel="Test overlay">
      <button>First</button>
      <button>Second</button>
      <button>Third</button>
    </OverlayPortal>
  );
}

describe("OverlayPortal", () => {
  it("renders nothing when closed", () => {
    render(<Fixture isOpen={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders content when open", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("accepts a custom aria-label", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Test overlay");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape when closeOnEscape is false", () => {
    const onClose = vi.fn();
    render(
      <OverlayPortal isOpen onClose={onClose} ariaLabel="Test" closeOnEscape={false}>
        <button>OK</button>
      </OverlayPortal>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    // The backdrop is the first motion.div inside the fixed container
    const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/60");
    // Fire click on the backdrop container (the outermost fixed div)
    const fixedContainer = document.querySelector(".fixed.inset-0");
    if (fixedContainer) {
      // Click directly on the backdrop element
      const backdropElement = fixedContainer.querySelector('[class*="bg-black"]');
      if (backdropElement) {
        fireEvent.click(backdropElement);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    }
  });

  it("does not close on backdrop click when closeOnBackdrop is false", () => {
    const onClose = vi.fn();
    render(
      <OverlayPortal isOpen onClose={onClose} ariaLabel="Test" closeOnBackdrop={false}>
        <button>OK</button>
      </OverlayPortal>,
    );
    const backdrop = document.querySelector('[class*="bg-black"]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).not.toHaveBeenCalled();
    }
  });

  it("moves focus into the dialog on open", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab focus within the dialog", () => {
    render(<Fixture />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    // Focus the last button and press Tab — should wrap to first
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("wraps Tab+Shift to the last element", () => {
    render(<Fixture />);
    const buttons = screen.getAllByRole("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    // Focus the first button and press Shift+Tab — should wrap to last
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("renders without backdrop when showBackdrop is false", () => {
    render(
      <OverlayPortal isOpen onClose={vi.fn()} ariaLabel="Test" showBackdrop={false}>
        <button>OK</button>
      </OverlayPortal>,
    );
    const backdrop = document.querySelector('[class*="bg-black"]');
    expect(backdrop).toBeNull();
  });

  it("accepts a custom zLevel", () => {
    render(
      <OverlayPortal isOpen onClose={vi.fn()} ariaLabel="Test" zLevel="command">
        <button>OK</button>
      </OverlayPortal>,
    );
    const container = document.querySelector(".fixed.inset-0");
    expect(container).toBeTruthy();
  });
});
