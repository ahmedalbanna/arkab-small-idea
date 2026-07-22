import React from "react";
import { cn } from "../../../lib/utils";

interface FormatButtonProps {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  active?: boolean;
  className?: string;
}

/**
 * Single formatting action inside the editor bubble/side menus.
 * Centralizes the repeated button markup and exposes an accessible
 * `aria-label` + `aria-pressed` state.
 */
export const FormatButton: React.FC<FormatButtonProps> = ({
  onClick,
  title,
  icon,
  active = false,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={cn(
      "p-1.5 hover:bg-minimal-sidebar rounded text-minimal-text transition-colors",
      active && "bg-minimal-accent/20 text-minimal-accent",
      className,
    )}
  >
    {icon}
  </button>
);
