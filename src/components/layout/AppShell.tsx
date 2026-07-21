import { type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { LayoutProvider } from "./LayoutContext";

interface AppShellProps {
  children: ReactNode;
  /** Document text direction (LTR / RTL). */
  dir?: "ltr" | "rtl";
  /**
   * Optional additional classes applied to the shell container.
   * Use sparingly — the shell owns the outer layout structure.
   */
  className?: string;
}

/**
 * Root layout shell for Ink & Quill.
 *
 * Owns the outer flex structure, the `LayoutProvider` context, and provides
 * named slot areas that the app and plugins render into.  In its initial
 * form (Phase 1) it simply wraps children with the layout context and the
 * base flex container.  Future phases add the `<OverlayPortal>`, `<BottomBar>`,
 * and `<PanelSlot>` integrations.
 *
 * Layout structure:
 * ```
 * +----------------------------------------------+
 * |        TopSlot    (optional, future)          |
 * +----------------------------------------------+
 * | LeftSlot |   ContentSlot   | RightSlot       |
 * | (panel)  |   (scrollable)  | (panel)         |
 * |          |                 |                 |
 * +----------------------------------------------+
 * |        BottomSlot (StatusBar / MobileToolbar) |
 * +----------------------------------------------+
 * ```
 */
export function AppShell({ children, dir, className }: AppShellProps) {
  return (
    <LayoutProvider>
      <div
        dir={dir}
        className={cn(
          "h-screen overflow-hidden bg-minimal-bg text-minimal-text font-sans flex flex-col selection:bg-minimal-accent/20 transition-colors duration-500",
          className,
        )}
      >
        {children}
      </div>
    </LayoutProvider>
  );
}
