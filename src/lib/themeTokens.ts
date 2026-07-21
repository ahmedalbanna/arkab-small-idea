/**
 * Centralised design tokens for Ink & Quill.
 *
 * These provide a single source of truth for spacing, border-radius, shadow,
 * transition, and icon-size values used across the layout.  Components should
 * reference these tokens instead of hardcoding arbitrary values.
 */

/** Border-radius scale */
export const RADIUS = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.25rem",
  "3xl": "1.5rem",
  full: "9999px",
} as const;

/** Box-shadow scale */
export const SHADOW = {
  sm: "0 1px 2px rgba(0,0,0,0.05)",
  md: "0 4px 6px rgba(0,0,0,0.07)",
  lg: "0 10px 25px rgba(0,0,0,0.1)",
  xl: "0 20px 50px rgba(0,0,0,0.15)",
} as const;

/** Transition durations */
export const TRANSITION = {
  fast: "150ms ease",
  normal: "300ms ease",
  slow: "500ms ease",
} as const;

/** Icon sizes used across toolbar/action buttons */
export const ICON_SIZE = {
  sm: 14,
  md: 18,
  lg: 22,
} as const;

/** Panel / sidebar widths */
export const PANEL_WIDTH = {
  sm: 320,
  md: 420,
  lg: 600,
} as const;

/** Motion (spring) presets for consistent animations */
export const SPRING = {
  /** Quick pop-in for toggles, badges */
  fast: { type: "spring" as const, stiffness: 300, damping: 30 },
  /** Standard panel slide-in/out */
  panel: { type: "spring" as const, stiffness: 200, damping: 25 },
  /** Hero / modal entry */
  modal: { type: "spring" as const, stiffness: 250, damping: 30 },
  /** Subtle hover lift */
  hover: { type: "spring" as const, stiffness: 400, damping: 20 },
} as const;

/** Motion animation variants for common transitions */
export const VARIANTS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideInEnd: {
    initial: { x: 420, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 420, opacity: 0 },
  },
  slideInStart: {
    initial: { x: -420, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -420, opacity: 0 },
  },
  slideUp: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
  },
  scaleIn: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
  },
} as const;
