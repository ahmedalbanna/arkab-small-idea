import React from 'react';
import { Bold, Image as ImageIcon, Italic, Send, Square, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { QuickActions } from './QuickActions';

interface ComposerProps {
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  chatImageInputRef: React.RefObject<HTMLInputElement>;
  chatAttachedImages: string[];
  setChatAttachedImages: (value: string[]) => void;
  handleAiGenerate: () => void;
  handleChatImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatChatInput: (type: 'bold' | 'italic' | 'list') => void;
  stopAiGenerate: () => void;
  isGenerating: boolean;
  isEmpty: boolean;
  onAction: (actionId: string) => void;
}

/**
 * Composer: textarea with inline formatting, image attachment, send/stop, and
 * the quick-action grid when the conversation is empty.
 */
export const Composer: React.FC<ComposerProps> = ({
  aiPrompt,
  setAiPrompt,
  chatInputRef,
  chatImageInputRef,
  chatAttachedImages,
  setChatAttachedImages,
  handleAiGenerate,
  handleChatImageUpload,
  formatChatInput,
  stopAiGenerate,
  isGenerating,
  isEmpty,
  onAction,
}) => {
  const canSend = (aiPrompt.trim().length > 0 || chatAttachedImages.length > 0) && !isGenerating;

  return (
    <div className="shrink-0 border-t border-minimal-border bg-minimal-bg">
      {isEmpty && <QuickActions onAction={onAction} />}

      {chatAttachedImages.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {chatAttachedImages.map((src, i) => (
            <div key={i} className="group relative h-14 w-14">
              <img src={src} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setChatAttachedImages(chatAttachedImages.filter((_, idx) => idx !== i))}
                aria-label="Remove image"
                className="absolute -end-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-minimal-text text-minimal-bg opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 p-2.5">
        <div className="flex flex-row gap-0.5">
          <button
            type="button"
            onClick={() => chatImageInputRef.current?.click()}
            aria-label="Attach image"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-minimal-muted transition-colors hover:bg-minimal-sidebar hover:text-minimal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => formatChatInput('bold')}
            aria-label="Bold"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-minimal-muted transition-colors hover:bg-minimal-sidebar hover:text-minimal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => formatChatInput('italic')}
            aria-label="Italic"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-minimal-muted transition-colors hover:bg-minimal-sidebar hover:text-minimal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
          >
            <Italic className="h-4 w-4" />
          </button>
        </div>

        <textarea
          ref={chatInputRef}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAiGenerate();
            }
          }}
          rows={1}
          placeholder="Ask about your document…"
          aria-label="Message the AI assistant"
          className="custom-scrollbar max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-minimal-border bg-minimal-sidebar px-3 py-2 text-sm text-minimal-text placeholder:text-minimal-muted focus:border-minimal-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
        />

        <button
          type="button"
          onClick={isGenerating ? stopAiGenerate : handleAiGenerate}
          disabled={!isGenerating && !canSend}
          aria-label={isGenerating ? 'Stop generating' : 'Send message'}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent',
            isGenerating
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : canSend
              ? 'bg-minimal-accent text-white hover:opacity-90'
              : 'cursor-not-allowed bg-minimal-sidebar text-minimal-muted'
          )}
        >
          {isGenerating ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
