import React, { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  CornerDownLeft,
  MessageSquarePlus,
  Pencil,
  RefreshCw,
  Trash2,
  Wand2,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";
import type { ChatMessage } from "../../services/aiService";

export type ApplyMethod = "append" | "insert" | "replace" | "suggest";

interface MessageBubbleProps {
  msg: ChatMessage;
  index: number;
  canRetry: boolean;
  onApply: (result: string, method: ApplyMethod) => void;
  onDismiss: (index: number) => void;
  onRevise: (text: string) => void;
  onRetry: () => void;
}

const ActionButton: React.FC<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}> = ({ label, onClick, children, danger }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={cn(
      "flex h-7 w-7 items-center justify-center rounded-lg text-minimal-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
      danger
        ? "hover:bg-rose-500/10 hover:text-rose-500"
        : "hover:bg-minimal-sidebar hover:text-minimal-text",
    )}
  >
    {children}
  </button>
);

/**
 * A single chat message. User messages are right-aligned and compact; model
 * messages render markdown with an action toolbar (copy / apply / suggest /
 * revise / retry / dismiss).
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  index,
  canRetry,
  onApply,
  onDismiss,
  onRevise,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  const text = msg.parts?.map((p) => p.text || "").join("") ?? "";
  const images = msg.images ?? [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-ee-md bg-minimal-accent px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm">
          {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {images.map((src, i) => (
                <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group/msg flex justify-start">
      <div className="max-w-[92%]">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-minimal-accent/10 text-minimal-accent">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 rounded-2xl rounded-es-md border border-minimal-border bg-minimal-sidebar px-3.5 py-2.5">
            {text ? (
              <div className="break-words text-sm leading-relaxed text-minimal-text">
                <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-1 text-sm text-minimal-muted">
                <span className="h-2 w-2 animate-bounce rounded-full bg-minimal-muted [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-minimal-muted [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-minimal-muted" />
              </div>
            )}
          </div>
        </div>

        <div className="ms-9 mt-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/msg:opacity-100">
          <ActionButton label="Copy response" onClick={copy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </ActionButton>
          <ActionButton label="Replace selection" onClick={() => onApply(text, "replace")}>
            <Wand2 className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton label="Insert at cursor" onClick={() => onApply(text, "insert")}>
            <CornerDownLeft className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton label="Append to end" onClick={() => onApply(text, "append")}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton label="Use as suggestion" onClick={() => onApply(text, "suggest")}>
            <Pencil className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton label="Revise this response" onClick={() => onRevise(text)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </ActionButton>
          {canRetry && (
            <ActionButton label="Regenerate response" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 text-minimal-accent" />
            </ActionButton>
          )}
          <ActionButton label="Dismiss message" danger onClick={() => onDismiss(index)}>
            <Trash2 className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </div>
    </div>
  );
};
