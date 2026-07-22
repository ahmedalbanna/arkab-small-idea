import React, { useId, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Z_CLASS } from "../../lib/zIndex";
import { VARIANTS, SPRING } from "../../lib/themeTokens";
import { useFocusTrap } from "../../lib/useFocusTrap";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hideCloseButton?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  className,
  hideCloseButton,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap({
    containerRef: panelRef,
    onEscape: onClose,
    enabled: isOpen,
  });

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={cn("fixed inset-0 flex items-center justify-center px-4", Z_CLASS.modal)}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleOverlayClick}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            {...VARIANTS.scaleIn}
            transition={SPRING.modal}
            className={cn(
              "relative w-full max-w-md bg-minimal-bg border border-minimal-border rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] outline-none",
              className,
            )}
          >
            {(title || !hideCloseButton) && (
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div
                  id={titleId}
                  className="text-sm font-bold text-minimal-text uppercase tracking-wider"
                >
                  {title}
                </div>
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
            <div className="flex-1 overflow-y-auto custom-scrollbar pe-2 -me-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
