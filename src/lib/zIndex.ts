/**
 * Centralised z-index scale for Ink & Quill.
 *
 * Every component should use these constants (or their CSS variable
 * equivalents) instead of hardcoded z-index values.  This prevents layer
 * collisions and makes stacking order predictable.
 *
 * Usage (Tailwind):
 *   className="z-[var(--z-panel)]"
 *
 * Usage (inline style):
 *   style={{ zIndex: Z_LAYERS.panel }}
 *
 * Usage (Motion):
 *   initial={{ zIndex: Z_LAYERS.floating }}
 */

export const Z_LAYERS = {
  /** Base content layer — editor, page cards */
  base: 0,
  /** Elevated content — e.g. drag handles, selection overlays */
  above: 10,
  /** Sticky UI — StatusBar, MobileToolbar */
  sticky: 20,
  /** Floating UI — FloatingToolbar, TOC, popovers */
  floating: 40,
  /** Side panels — AI assistant, WorkspacePlacement, Search */
  panel: 60,
  /** Modal overlay backdrops */
  overlay: 100,
  /** Modal content */
  modal: 110,
  /** Editor menus — bubble, context, slash */
  editorMenu: 150,
  /** Command palette — highest layer */
  command: 200,
} as const satisfies Record<string, number>;

export type ZLayer = keyof typeof Z_LAYERS;

/** CSS custom property name for each layer, e.g. `--z-floating`. */
export const Z_CSS_VAR = Object.fromEntries(
  Object.entries(Z_LAYERS).map(([key]) => [key, `var(--z-${key})` as const]),
) as Record<ZLayer, string>;

/**
 * Tailwind-compatible class names for each z-index layer.
 * E.g. `z-[var(--z-panel)]`
 */
export const Z_CLASS: Record<ZLayer, string> = Object.fromEntries(
  Object.entries(Z_LAYERS).map(([key]) => [key, `z-[var(--z-${key})]`]),
) as Record<ZLayer, string>;
