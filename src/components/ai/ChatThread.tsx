import React from "react";
import type { ChatMessage } from "../../services/aiService";
import type { ApplyMethod } from "./MessageBubble";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import { SuggestedPrompts } from "./SuggestedPrompts";

interface ChatThreadProps {
  chatHistory: ChatMessage[];
  isGenerating: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  suggestions: string[];
  onAction: (actionId: string) => void;
  onTemplate: (prompt: string) => void;
  onApply: (result: string, method: ApplyMethod) => void;
  onDismiss: (index: number) => void;
  onRevise: (text: string) => void;
  onRetry: () => void;
  onSuggest: (prompt: string) => void;
}

/**
 * Scrollable conversation surface: renders the empty state, the message list,
 * live generation placeholder, and follow-up suggestions.
 */
export const ChatThread: React.FC<ChatThreadProps> = ({
  chatHistory,
  isGenerating,
  scrollRef,
  suggestions,
  onAction,
  onTemplate,
  onApply,
  onDismiss,
  onRevise,
  onRetry,
  onSuggest,
}) => {
  if (chatHistory.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <EmptyState onAction={onAction} onTemplate={onTemplate} />
      </div>
    );
  }

  const lastIndex = chatHistory.length - 1;
  const lastIsModel = chatHistory[lastIndex].role === "model";

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="AI conversation"
      className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-5 scroll-smooth"
    >
      {chatHistory.map((msg, i) => (
        <MessageBubble
          key={i}
          msg={msg}
          index={i}
          canRetry={i === lastIndex && lastIsModel && !isGenerating}
          onApply={onApply}
          onDismiss={onDismiss}
          onRevise={onRevise}
          onRetry={onRetry}
        />
      ))}
      {!isGenerating && lastIsModel && (
        <SuggestedPrompts suggestions={suggestions} onSuggest={onSuggest} />
      )}
    </div>
  );
};
