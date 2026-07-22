import React from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "../../lib/utils";
import { AI_ACTIONS } from "../../constants";

interface QuickActionsProps {
  onAction: (actionId: string) => void;
}

/**
 * Grid of one-tap document actions plus a brainstorming entry. Shown beneath
 * the composer while the conversation is empty.
 */
export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
  return (
    <div className="px-3 pb-2 pt-1">
      <div className="grid grid-cols-2 gap-1.5">
        {AI_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id)}
              className="group flex items-center gap-2 rounded-xl border border-minimal-border bg-minimal-sidebar px-2.5 py-2 text-start transition-all hover:-translate-y-0.5 hover:border-minimal-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-minimal-bg",
                  action.color,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-minimal-text">
                  {action.label}
                </span>
                <span className="block truncate text-[10px] text-minimal-muted">
                  {action.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onAction("brainstorm")}
        className="mt-1.5 flex w-full items-center gap-2 rounded-xl border border-minimal-accent/30 bg-minimal-accent/5 px-2.5 py-2 text-start transition-colors hover:bg-minimal-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-minimal-accent/15 text-minimal-accent">
          <Lightbulb className="h-3.5 w-3.5" />
        </span>
        <span>
          <span className="block text-xs font-semibold text-minimal-text">Brainstorm</span>
          <span className="block text-[10px] text-minimal-muted">
            Generate creative idea prompts
          </span>
        </span>
      </button>
    </div>
  );
};
