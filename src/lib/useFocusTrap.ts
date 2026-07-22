import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  /** The element to trap focus within. When null/undefined, the trap is inactive. */
  containerRef: RefObject<HTMLElement | null>;
  /** Called when the user presses Escape. */
  onEscape?: () => void;
  /** Whether the trap is active (default: true when containerRef exists). */
  enabled?: boolean;
}

/**
 * Traps Tab / Shift+Tab focus within a container and calls `onEscape` when
 * the Escape key is pressed.  Restores focus to the previously focused element
 * when the trap is deactivated.
 */
export function useFocusTrap({ containerRef, onEscape, enabled = true }: UseFocusTrapOptions) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Capture previously focused element when trap activates
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
  }, [enabled, containerRef]);

  // Focus trap + Escape listener
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    // Focus first focusable element in the container
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;

      const currentFocusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (currentFocusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus to previously focused element
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [enabled, containerRef, onEscape]);
}
