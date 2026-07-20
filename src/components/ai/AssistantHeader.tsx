import React from 'react';
import { GripVertical, Minus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ModelSwitcher } from './ModelSwitcher';

export type OllamaStatus = 'idle' | 'loading' | 'ready' | 'error' | 'no-ollama';

interface AssistantHeaderProps {
  ollamaStatus: OllamaStatus;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<OllamaStatus, string> = {
  idle: 'Standby',
  loading: 'Connecting…',
  ready: 'Online',
  error: 'Error',
  'no-ollama': 'Offline',
};

/**
 * Header bar for the AI assistant: title, live provider status, inline model
 * switcher, minimize and close controls. Doubles as a drag handle.
 */
export const AssistantHeader: React.FC<AssistantHeaderProps> = ({
  ollamaStatus,
  isMinimized,
  onToggleMinimize,
  onClose,
}) => {
  const statusReady = ollamaStatus === 'ready';
  const statusError = ollamaStatus === 'error' || ollamaStatus === 'no-ollama';

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-minimal-border px-3 select-none">
      <div className="flex items-center gap-2 text-minimal-text">
        <GripVertical className="h-4 w-4 cursor-grab text-minimal-muted active:cursor-grabbing" aria-hidden />
        <span className="text-sm font-bold tracking-tight">Intelligence</span>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
            statusReady && 'bg-emerald-500/15 text-emerald-500',
            ollamaStatus === 'loading' && 'bg-amber-500/15 text-amber-500',
            statusError && 'bg-rose-500/15 text-rose-500',
            ollamaStatus === 'idle' && 'bg-minimal-sidebar text-minimal-muted'
          )}
          title={`Provider status: ${STATUS_LABEL[ollamaStatus]}`}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              statusReady && 'bg-emerald-500',
              ollamaStatus === 'loading' && 'animate-pulse bg-amber-500',
              statusError && 'bg-rose-500',
              ollamaStatus === 'idle' && 'bg-minimal-muted'
            )}
            aria-hidden
          />
          {STATUS_LABEL[ollamaStatus]}
        </span>
      </div>

      <div className="ms-auto flex items-center gap-1.5">
        <ModelSwitcher />
        <button
          type="button"
          onClick={onToggleMinimize}
          aria-label={isMinimized ? 'Expand assistant' : 'Minimize assistant'}
          aria-pressed={isMinimized}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-minimal-muted transition-colors hover:bg-minimal-sidebar hover:text-minimal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-minimal-muted transition-colors hover:bg-rose-500/10 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
