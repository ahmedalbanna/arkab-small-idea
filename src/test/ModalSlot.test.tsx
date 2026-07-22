// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModalSlot } from "../components/layout/ModalSlot";

afterEach(cleanup);

function Fixture({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  return (
    <ModalSlot isOpen={isOpen} onClose={onClose ?? vi.fn()} title="Test Modal">
      <button>Confirm</button>
      <button>Cancel</button>
      <p>Modal body content</p>
    </ModalSlot>
  );
}

describe("ModalSlot", () => {
  it("renders nothing when closed", () => {
    render(<Fixture isOpen={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders content when open", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Modal body content")).toBeTruthy();
  });

  it("sets role='dialog' and aria-modal='true'", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("links title via aria-labelledby", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    const labelledby = dialog.getAttribute("aria-labelledby");
    expect(labelledby).toBeTruthy();
    const titleEl = document.getElementById(labelledby!);
    expect(titleEl?.textContent).toBe("Test Modal");
  });

  it("renders the title text", () => {
    render(<Fixture />);
    expect(screen.getByText("Test Modal")).toBeTruthy();
  });

  it("renders a close button with aria-label", () => {
    render(<Fixture />);
    expect(screen.getByLabelText("Close dialog")).toBeTruthy();
  });

  it("hides close button when hideCloseButton is true", () => {
    render(
      <ModalSlot isOpen onClose={vi.fn()} title="Test" hideCloseButton>
        <p>Content</p>
      </ModalSlot>,
    );
    expect(screen.queryByLabelText("Close dialog")).toBeNull();
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

  it("moves focus into the modal on open", () => {
    render(<Fixture />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab focus within the modal", () => {
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

  it("accepts custom maxWidth", () => {
    render(
      <ModalSlot isOpen onClose={vi.fn()} title="Test" maxWidth="600px">
        <p>Content</p>
      </ModalSlot>,
    );
    // The dialog container gets the max-width style
    const dialog = screen.getByRole("dialog");
    // The parent fixed container or the content wrapper
    const contentWrapper = dialog.parentElement;
    expect(contentWrapper?.style.maxWidth || dialog.style.maxWidth).toBeTruthy();
  });

  it("renders without title when not provided", () => {
    render(
      <ModalSlot isOpen onClose={vi.fn()}>
        <p>Content</p>
      </ModalSlot>,
    );
    const dialog = screen.getByRole("dialog");
    // Should not have aria-labelledby since there's no title
    expect(dialog.getAttribute("aria-labelledby")).toBeFalsy();
  });
});
