import { useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Z_CLASS, type ZLayer } from "../../lib/zIndex";
import { useFocusTrap } from "../../lib/useFocusTrap";
import { SPRING } from "../../lib/themeTokens";

export interface PanelSlotProps {
  /** Whether the panel is open. */
  isOpen: boolean;
  /** Called when the user requests closing. */
  onClose: () => void;
  /** Panel content. */
  children: ReactNode;
  /**
   * Which side the panel slides from.
   * `"start"` = left in LTR, right in RTL.
   * `"end"`  = right in LTR, left in RTL.
   * Defaults to `"end"`.
   */
  side?: "start" | "end";
  /** Panel width (CSS value, e.g. "420px", "100%"). Defaults to "420px". */
  width?: string;
  /** Z-index layer. Defaults to `"panel"`. */
  zLevel?: ZLayer;
  /** Optional title shown in the panel header. */
  title?: string;
  /** Additional class names for the panel container. */
  className?: string;
  /** Whether to show the close button in the header. Defaults to true. */
  showCloseButton?: boolean;
  /** Whether to show the backdrop. Defaults to true. */
  showBackdrop?: boolean;
}

/**
 * A slide-in side panel with backdrop, focus trap, and Escape-to-close.
 *
 * Supports logical `side` prop (`"start"` / `"end"`) that respects the
 * document direction (LTR / RTL).  Uses `motion/react` spring animations
 * for smooth entrance and exit.
 *
 * This is the building block for the AI assistant, Search,
 * Search, Table of Contents, and other side panels.
 */
export function PanelSlot({
  isOpen,
  onClose,
  children,
  side = "end",
  width = "420px",
  zLevel = "panel",
  title,
  className,
  showCloseButton = true,
  showBackdrop = true,
}: PanelSlotProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: panelRef,
    onEscape: onClose,
    enabled: isOpen,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Slide direction: end-side panels slide from the end, start-side from start
  const slideFrom = side === "end" ? "100%" : "-100%";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          {showBackdrop && (
            <motion.div
              key="panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleBackdropClick}
              className={cn(
                "fixed inset-0 bg-black/30 backdrop-blur-sm",
                Z_CLASS[zLevel],
              )}
            />
          )}

          {/* Panel */}
          <motion.div
            ref={panelRef}
            key="panel-content"
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Panel"}
            tabIndex={-1}
            initial={{ x: slideFrom }}
            animate={{ x: 0 }}
            exit={{ x: slideFrom }}
            transition={SPRING.panel}
            className={cn(
              "fixed top-0 bottom-0 flex flex-col bg-minimal-bg border-minimal-border shadow-2xl",
              "outline-none overflow-hidden",
              // Side-specific positioning
              side === "end"
                ? "end-0 border-s"
                : "start-0 border-e",
              className,
            )}
            style={{ width }}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between shrink-0 px-5 py-4 border-b border-minimal-border bg-minimal-sidebar">
                {title ? (
                  <h3 className="text-sm font-bold text-minimal-text uppercase tracking-widest">
                    {title}
                  </h3>
                ) : (
                  <div />
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    aria-label="Close panel"
                    className="p-1.5 hover:bg-minimal-border rounded-lg text-minimal-muted hover:text-minimal-text transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
