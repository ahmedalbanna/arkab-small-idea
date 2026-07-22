import React, { useMemo } from "react";
import type { OllamaStatus } from "./AssistantHeader";
import { AssistantHeader } from "./AssistantHeader";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import type { ApplyMethod } from "./MessageBubble";
import type { ChatMessage } from "../../services/aiService";

export interface AIAssistantProps {
  ollamaStatus: OllamaStatus;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  chatImageInputRef: React.RefObject<HTMLInputElement>;
  chatAttachedImages: string[];
  setChatAttachedImages: (value: string[]) => void;
  chatHistory: ChatMessage[];
  isGenerating: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  handleAiGenerate: () => void;
  handleChatImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatChatInput: (type: "bold" | "italic" | "list") => void;
  stopAiGenerate: () => void;
  handleAiAction: (actionId: string) => void;
  handleDismissMessage: (index: number) => void;
  handleReviseMessage: (text: string) => void;
  onApply: (result: string, method: ApplyMethod) => void;
  onRetry: () => void;
  onClose: () => void;
}

const FOLLOW_UPS = [
  "Make it more concise",
  "Rewrite in a formal tone",
  "Give me three alternatives",
];

/**
 * Root AI assistant surface. Composes the header, conversation thread, and
 * composer. Behaviour is driven entirely by the props supplied by AIHost
 * (streaming, handlers, shortcuts). Visibility is controlled externally
 * (AnimatePresence in AIHost) — this component always renders its full UI.
 */
export const AIAssistant: React.FC<AIAssistantProps> = ({
  ollamaStatus,
  aiPrompt,
  setAiPrompt,
  chatInputRef,
  chatImageInputRef,
  chatAttachedImages,
  setChatAttachedImages,
  chatHistory,
  isGenerating,
  scrollRef,
  handleAiGenerate,
  handleChatImageUpload,
  formatChatInput,
  stopAiGenerate,
  handleAiAction,
  handleDismissMessage,
  handleReviseMessage,
  onApply,
  onRetry,
  onClose,
}) => {
  const suggestions = useMemo(() => {
    if (isGenerating || chatHistory.length === 0) return [];
    const last = chatHistory[chatHistory.length - 1];
    return last.role === "model" ? FOLLOW_UPS : [];
  }, [chatHistory, isGenerating]);

  const handleSuggest = (prompt: string) => {
    setAiPrompt(prompt);
    chatInputRef.current?.focus();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <AssistantHeader ollamaStatus={ollamaStatus} onClose={onClose} />

      <ChatThread
        chatHistory={chatHistory}
        isGenerating={isGenerating}
        scrollRef={scrollRef}
        suggestions={suggestions}
        onAction={handleAiAction}
        onTemplate={handleSuggest}
        onApply={onApply}
        onDismiss={handleDismissMessage}
        onRevise={handleReviseMessage}
        onRetry={onRetry}
        onSuggest={handleSuggest}
      />
      <Composer
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        chatInputRef={chatInputRef}
        chatImageInputRef={chatImageInputRef}
        chatAttachedImages={chatAttachedImages}
        setChatAttachedImages={setChatAttachedImages}
        handleAiGenerate={handleAiGenerate}
        handleChatImageUpload={handleChatImageUpload}
        formatChatInput={formatChatInput}
        stopAiGenerate={stopAiGenerate}
        isGenerating={isGenerating}
        isEmpty={chatHistory.length === 0}
        onAction={handleAiAction}
      />
    </div>
  );
};
