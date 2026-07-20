import React, { useEffect, useRef, useState } from 'react';
import {
  Settings,
  BookOpen,
  Globe,
  MessageSquare,
  Wand2,
  Search,
  Sparkles,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAIStore } from '../../stores/aiStore';
import { STATIC_MODELS } from '../../constants';

const PROVIDERS = ['ollama', 'openai', 'anthropic', 'google', 'pipeline'] as const;
type Provider = (typeof PROVIDERS)[number];

type ServiceKey = 'chat' | 'actions' | 'semantic' | 'embeddings';

interface ServiceMeta {
  key: ServiceKey;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const SERVICES: ServiceMeta[] = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'actions', label: 'Actions', icon: Wand2 },
  { key: 'semantic', label: 'Semantic', icon: Search },
  { key: 'embeddings', label: 'Embeddings', icon: Sparkles },
];

interface AISettingsPopoverProps {
  className?: string;
}

/**
 * Unified AI settings popover for the status bar.
 * Contains service model configuration (provider + model list),
 * personal instructions, and Ollama host URL.
 */
export const AISettingsPopover: React.FC<AISettingsPopoverProps> = ({ className }) => {
  const {
    personalInstructions,
    providerConfigs,
    serviceConfigs,
    availableModels,
    setPersonalInstructions,
    setOllamaHost,
    setServiceProvider,
    setServiceModel,
  } = useAIStore();
  const [open, setOpen] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState(personalInstructions);
  const [hostDraft, setHostDraft] = useState(providerConfigs.ollama.host);
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync drafts when the popover opens / store changes
  useEffect(() => {
    if (open) {
      setInstructionsDraft(personalInstructions);
      setHostDraft(providerConfigs.ollama.host);
    }
  }, [open, personalInstructions, providerConfigs.ollama.host]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const commitInstructions = () => {
    if (instructionsDraft !== personalInstructions) {
      setPersonalInstructions(instructionsDraft);
    }
  };

  const commitHost = () => {
    if (hostDraft !== providerConfigs.ollama.host) {
      setOllamaHost(hostDraft);
    }
  };

  const modelsFor = (provider: Provider, currentModel: string): string[] => {
    if (provider === 'ollama') {
      return availableModels.length ? availableModels : [currentModel];
    }
    return STATIC_MODELS[provider] ?? [currentModel];
  };

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="AI settings"
        className={cn(
          'flex items-center justify-center rounded-md border px-1.5 py-1 transition-colors',
          'border-minimal-border bg-minimal-sidebar text-minimal-muted',
          'hover:border-minimal-accent/30 hover:text-minimal-text',
          open && 'border-minimal-accent/40 text-minimal-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent'
        )}
        title="AI settings"
      >
        <Settings className="h-3 w-3" />
      </button>

      {/* Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="AI settings"
          className="absolute end-0 bottom-full z-overlay-float mb-2 w-80 origin-bottom-end animate-in rounded-2xl border border-minimal-border bg-minimal-bg p-3 shadow-2xl fade-in zoom-in-95 duration-150"
        >
          {/* ── Service Model Configuration ── */}
          <div className="mb-3">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <ChevronDown className="h-3 w-3 text-minimal-accent" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
                Model Configuration
              </span>
            </div>
            <div className="space-y-2">
              {SERVICES.map((svc) => {
                const config = serviceConfigs[svc.key];
                const Icon = svc.icon;
                return (
                  <ServiceConfigSection
                    key={svc.key}
                    icon={<Icon className="h-3 w-3 text-minimal-accent shrink-0" />}
                    label={svc.label}
                    provider={config.provider}
                    model={config.model}
                    models={modelsFor(config.provider, config.model)}
                    onProviderChange={(p) => {
                      setServiceProvider(svc.key, p);
                      const first = modelsFor(p, config.model)[0];
                      if (first) setServiceModel(svc.key, first);
                    }}
                    onModelChange={(m) => setServiceModel(svc.key, m)}
                  />
                );
              })}
            </div>
          </div>

          <div className="mb-3 h-px bg-minimal-border" />

          {/* ── Personal Instructions ── */}
          <div className="mb-3">
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <BookOpen className="h-3 w-3 text-minimal-accent" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
                Personal Instructions
              </span>
            </div>
            <textarea
              value={instructionsDraft}
              onChange={(e) => setInstructionsDraft(e.target.value)}
              onBlur={commitInstructions}
              rows={3}
              placeholder="e.g. Always respond in Arabic, use a formal tone…"
              aria-label="Personal instructions for the AI"
              className="custom-scrollbar w-full resize-none rounded-xl border border-minimal-border bg-minimal-sidebar px-3 py-2 text-[11px] leading-relaxed text-minimal-text placeholder:text-minimal-muted focus:border-minimal-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
            />
          </div>

          <div className="mb-3 h-px bg-minimal-border" />

          {/* ── Ollama Host URL ── */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <Globe className="h-3 w-3 text-minimal-accent" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
                Ollama Host
              </span>
            </div>
            <input
              value={hostDraft}
              onChange={(e) => setHostDraft(e.target.value)}
              onBlur={commitHost}
              placeholder="http://localhost:11434"
              aria-label="Ollama server URL"
              className="w-full rounded-xl border border-minimal-border bg-minimal-sidebar px-3 py-2 text-[11px] font-mono text-minimal-text placeholder:text-minimal-muted focus:border-minimal-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ───── Service config section ───── */

interface ServiceConfigSectionProps {
  icon: React.ReactNode;
  label: string;
  provider: Provider;
  model: string;
  models: string[];
  onProviderChange: (p: Provider) => void;
  onModelChange: (m: string) => void;
}

const ServiceConfigSection: React.FC<ServiceConfigSectionProps> = ({
  icon,
  label,
  provider,
  model,
  models,
  onProviderChange,
  onModelChange,
}) => {
  return (
    <div className="rounded-xl border border-minimal-border bg-minimal-sidebar/40 p-2.5 transition-colors hover:bg-minimal-sidebar">
      {/* Header: icon + service name */}
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider text-minimal-text">
          {label}
        </span>
      </div>

      {/* Provider selector */}
      <div className="mb-2 grid grid-cols-3 gap-1">
        {PROVIDERS.map((p) => (
          <button
            key={p}
            type="button"
            role="menuitemradio"
            aria-checked={provider === p}
            onClick={() => onProviderChange(p)}
            className={cn(
              'rounded-lg py-1 text-[8px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent',
              provider === p
                ? 'bg-minimal-accent text-white'
                : 'bg-minimal-bg text-minimal-muted hover:text-minimal-text'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Model list */}
      <div className="custom-scrollbar flex max-h-28 flex-wrap gap-1 overflow-y-auto">
        {models.map((m) => (
          <button
            key={m}
            type="button"
            role="menuitemradio"
            aria-checked={model === m}
            onClick={() => onModelChange(m)}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent',
              model === m
                ? 'bg-minimal-accent/10 text-minimal-accent ring-1 ring-minimal-accent/30'
                : 'bg-minimal-bg text-minimal-muted hover:text-minimal-text hover:bg-minimal-sidebar'
            )}
          >
            <span className="truncate max-w-[130px]">{m}</span>
            {model === m && <Check className="h-2.5 w-2.5 shrink-0 text-minimal-accent" />}
          </button>
        ))}
      </div>
    </div>
  );
};
