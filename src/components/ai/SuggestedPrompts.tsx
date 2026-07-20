import React from 'react';

interface SuggestedPromptsProps {
  suggestions: string[];
  onSuggest: (prompt: string) => void;
}

/**
 * Follow-up prompt chips shown beneath the assistant's latest response.
 */
export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ suggestions, onSuggest }) => {
  if (suggestions.length === 0) return null;
  return (
    <div className="ms-9 mt-2 flex flex-wrap gap-1.5">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSuggest(s)}
          className="rounded-full border border-minimal-border bg-minimal-sidebar px-2.5 py-1 text-[10px] font-medium text-minimal-muted transition-colors hover:border-minimal-accent/40 hover:text-minimal-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
        >
          {s}
        </button>
      ))}
    </div>
  );
};
