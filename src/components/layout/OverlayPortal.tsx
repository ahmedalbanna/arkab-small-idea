import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Z_CLASS, type ZLayer } from "../../lib/zIndex";
import { useFocusTrap } from "../../lib/useFocusTrap";
import { VARIANTS, SPRING } from "../../lib/themeTokens";

export interface OverlayPortalProps {
  /** Whether the overlay is visible. */
  isOpen: boolean;
  /** Called when the user requests closing (Escape / backdrop click). */
  onClose: () => void;
  /** Content rendered inside the overlay. */
  children: ReactNode;
  /** Z-index layer from the project scale. Defaults to `"overlay"`. */
  zLevel?: ZLayer;
  /** ARIA label for the dialog container. */
  ariaLabel?: string;
  /** ID of an element that labels this dialog (for `aria-labelledby`). */
  ariaLabelledby?: string;
  /** Show backdrop behind the content (default: true). */
  showBackdrop?: boolean;
  /** Close when the backdrop is clicked (default: true). */
  closeOnBackdrop?: boolean;
  /** Close when Escape is pressed (default: true). */
  closeOnEscape?: boolean;
  /** Enable focus trap (default: true). */
  focusTrap?: boolean;
  /** Additional class names for the content wrapper. */
  className?: string;
  /** Additional inline styles for the content wrapper. */
  style?: CSSProperties;
}

/**
 * Base overlay primitive — handles backdrop, z-index, Escape, focus trap, and
 * ARIA attributes.  Used by `<ModalSlot>` and as a building block for other
 * overlay patterns.
 *
 * Renders a `role="dialog"` container.  The backdrop uses `--z-overlay` and
 * the content uses the layer specified via `zLevel`.
 */
export function OverlayPortal({
  isOpen,
  onClose,
  children,
  zLevel = "overlay",
  ariaLabel,
  ariaLabelledby,
  showBackdrop = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  focusTrap = true,
  className,
  style,
}: OverlayPortalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: contentRef,
    onEscape: closeOnEscape ? onClose : undefined,
    enabled: focusTrap && isOpen,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === backdropRef.current) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            "fixed inset-0 flex items-center justify-center",
            Z_CLASS[zLevel],
          )}
        >
          {/* Backdrop */}
          {showBackdrop && (
            <motion.div
              ref={backdropRef}
              key="overlay-backdrop"
              onClick={handleBackdropClick}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              {...VARIANTS.fadeIn}
              transition={{ duration: 0.2 }}
            />
          )}

          {/* Content */}
          <motion.div
            ref={contentRef}
            key="overlay-content"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            tabIndex={-1}
            className={cn(
              "relative outline-none",
              "bg-minimal-bg border border-minimal-border shadow-2xl",
              className,
            )}
            style={style}
            {...VARIANTS.scaleIn}
            transition={SPRING.modal}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
