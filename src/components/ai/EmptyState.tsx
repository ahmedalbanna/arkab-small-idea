import React from 'react';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onAction: (actionId: string) => void;
  onTemplate: (prompt: string) => void;
}

const TEMPLATES = [
  'Summarize the key points of my document',
  'Make this writing more concise',
  'Rewrite this in a formal tone',
  'Generate an outline for a research paper',
  'Explain this paragraph to a beginner',
  'Suggest a compelling title',
];

/**
 * Polished landing view shown when the conversation is empty: a hero prompt
 * box plus a set of quick-start templates.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ onTemplate }) => {
  return (
    <div className="flex flex-col items-center px-4 pt-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-minimal-accent/10 text-minimal-accent">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="text-base font-bold text-minimal-text">Your AI writing partner</h2>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-minimal-muted">
        Ask a question about your document, draft new sections, or refine what you’ve written — right here.
      </p>

      <div className="mt-6 grid w-full gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template}
            type="button"
            onClick={() => onTemplate(template)}
            className="rounded-xl border border-minimal-border bg-minimal-sidebar px-3 py-2.5 text-start text-xs font-medium text-minimal-text transition-colors hover:border-minimal-accent/40 hover:bg-minimal-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
          >
            {template}
          </button>
        ))}
      </div>
    </div>
  );
};
