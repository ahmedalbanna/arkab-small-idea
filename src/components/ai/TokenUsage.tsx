/**
 * TokenUsage — Token usage dashboard component.
 *
 * Shows running token totals per action type, recent request history,
 * and per-action budget limits. Subscribes to the TokenTracker singleton
 * so it stays in sync across sessions.
 */

import { useEffect, useState } from "react";
import { tokenTracker, type TokenUsageState } from "../../services/tokenMonitor";

export function TokenUsage() {
  const [state, setState] = useState<TokenUsageState>(() => tokenTracker.getState());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const unsub = tokenTracker.subscribe((s) => setState(s));
    return unsub;
  }, []);

  const actionTypes = Object.keys(state.totals);
  const totalTokens = actionTypes.reduce(
    (sum, a) =>
      sum + (state.totals[a]?.promptTokens || 0) + (state.totals[a]?.completionTokens || 0),
    0,
  );

  return (
    <div className="text-xs text-muted-foreground space-y-2">
      {/* Summary header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left hover:text-foreground transition-colors"
      >
        <span className="text-[10px] font-medium uppercase tracking-wider">Token Usage</span>
        <span className="ml-auto text-[10px]">{totalTokens} total</span>
      </button>

      {expanded && (
        <div className="pl-1 space-y-2 border-l-2 border-muted">
          {/* Per-action totals */}
          {actionTypes.length === 0 && (
            <p className="text-[10px] text-muted-foreground/60 italic">No usage recorded yet.</p>
          )}

          {actionTypes.map((action) => {
            const totals = state.totals[action];
            const budget = state.budgets[action];
            if (!totals) return null;

            const promptPct = budget?.maxPromptTokens
              ? Math.round((totals.promptTokens / budget.maxPromptTokens) * 100)
              : 0;
            const compPct = budget?.maxCompletionTokens
              ? Math.round((totals.completionTokens / budget.maxCompletionTokens) * 100)
              : 0;

            return (
              <div key={action} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium capitalize">{action}</span>
                  <span className="text-[9px] text-muted-foreground/60">
                    {totals.promptTokens + totals.completionTokens} tokens
                  </span>
                </div>

                {/* Prompt token bar */}
                {budget?.maxPromptTokens ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500/60 transition-all"
                        style={{ width: `${Math.min(promptPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground/60 w-16 text-right shrink-0">
                      {totals.promptTokens}/{budget.maxPromptTokens} prompt
                    </span>
                  </div>
                ) : null}

                {/* Completion token bar */}
                {budget?.maxCompletionTokens ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500/60 transition-all"
                        style={{ width: `${Math.min(compPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground/60 w-16 text-right shrink-0">
                      {totals.completionTokens}/{budget.maxCompletionTokens} completion
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Recent history */}
          {state.history.length > 0 && (
            <div className="pt-1">
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Recent
              </span>
              <div className="mt-0.5 space-y-0.5">
                {state.history
                  .slice(-10)
                  .reverse()
                  .map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[9px] text-muted-foreground/60"
                    >
                      <span>
                        {entry.action} <span className="text-[8px]">{entry.provider}</span>
                      </span>
                      <span>{entry.promptTokens + entry.completionTokens}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
