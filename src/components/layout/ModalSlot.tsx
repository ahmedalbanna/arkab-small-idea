import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { OverlayPortal, type OverlayPortalProps } from "./OverlayPortal";

export interface ModalSlotProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user requests closing. */
  onClose: () => void;
  /** Modal body content. */
  children: ReactNode;
  /** Optional title shown in the modal header. */
  title?: ReactNode;
  /** Maximum width of the modal (defaults to "480px"). */
  maxWidth?: string;
  /** Additional class names for the modal content wrapper. */
  className?: string;
  /** Override the z-index layer (defaults to "modal"). */
  zLevel?: OverlayPortalProps["zLevel"];
  /** Hide the close button (defaults to false). */
  hideCloseButton?: boolean;
}

/**
 * Unified modal wrapper built on `<OverlayPortal>`.
 *
 * Provides a centered dialog with title, close button, focus trap, Escape
 * handling, and proper ARIA attributes (`role="dialog"`, `aria-modal`,
 * `aria-labelledby`).
 *
 * Intended to replace the manual modal/overlay implementations in
 * `ImportModal`, `ShortcutsHelp`, etc.
 */
export function ModalSlot({
  isOpen,
  onClose,
  children,
  title,
  maxWidth = "480px",
  className,
  zLevel = "modal",
  hideCloseButton = false,
}: ModalSlotProps) {
  const titleId = useId();

  return (
    <OverlayPortal
      isOpen={isOpen}
      onClose={onClose}
      zLevel={zLevel}
      ariaLabelledby={title ? titleId : undefined}
      className={cn("w-full flex flex-col max-h-[90vh] rounded-2xl p-6", className)}
      style={{ maxWidth }}
    >
      {/* Header */}
      {(title || !hideCloseButton) && (
        <div className="flex items-center justify-between mb-4 shrink-0">
          {title && (
            <div
              id={titleId}
              className="text-sm font-bold text-minimal-text uppercase tracking-wider"
            >
              {title}
            </div>
          )}
          {!hideCloseButton && (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 hover:bg-minimal-sidebar rounded-lg text-minimal-muted hover:text-minimal-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pe-2 -me-2">{children}</div>
    </OverlayPortal>
  );
}
