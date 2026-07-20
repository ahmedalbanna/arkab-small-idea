import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Cpu,
  MessageSquare,
  Sparkles,
  Wand2,
  Search,
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

interface ModelConfigBarProps {
  className?: string;
}

/**
 * Four compact buttons (one per service) shown in the status bar.
 * Each opens its own popover to pick the provider and then a model
 * from that provider's available list.
 */
export const ModelConfigBar: React.FC<ModelConfigBarProps> = ({ className }) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {SERVICES.map((svc) => (
        <ServiceDropdown key={svc.key} service={svc} />
      ))}
    </div>
  );
};

/* ───── Single service dropdown ───── */

const ServiceDropdown: React.FC<{ service: ServiceMeta }> = ({ service: svc }) => {
  const { serviceConfigs, availableModels, setServiceProvider, setServiceModel } =
    useAIStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const config = serviceConfigs[svc.key];
  const Icon = svc.icon;

  const modelsFor = (provider: Provider): string[] => {
    if (provider === 'ollama') {
      return availableModels.length ? availableModels : [config.model];
    }
    return STATIC_MODELS[provider] ?? [config.model];
  };

  return (
    <div className="relative" ref={rootRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${svc.label} model: ${config.model}`}
        className={cn(
          'flex items-center gap-1 rounded-md border px-1.5 py-1 text-[9px] font-bold uppercase tracking-tight transition-colors',
          'border-minimal-border bg-minimal-sidebar text-minimal-muted',
          'hover:border-minimal-accent/30 hover:text-minimal-text',
          open && 'border-minimal-accent/40 text-minimal-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent'
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="max-w-[60px] truncate">{config.model}</span>
        <ChevronDown className={cn('h-2.5 w-2.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown — provider at top, models list below */}
      {open && (
        <div
          role="menu"
          aria-label={`${svc.label} provider and model`}
          className="absolute end-0 bottom-full z-overlay-float mb-2 w-56 origin-bottom-end animate-in rounded-xl border border-minimal-border bg-minimal-bg p-2 shadow-2xl fade-in zoom-in-95 duration-150"
        >
          {/* Provider selector */}
          <div className="px-1.5 py-1 text-[8px] font-bold uppercase tracking-widest text-minimal-muted">
            Provider
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1 px-1">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                role="menuitemradio"
                aria-checked={config.provider === p}
                onClick={() => {
                  setServiceProvider(svc.key, p);
                  const first = modelsFor(p)[0];
                  if (first) setServiceModel(svc.key, first);
                }}
                className={cn(
                  'rounded-lg py-1 text-[8px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent',
                  config.provider === p
                    ? 'bg-minimal-accent text-white'
                    : 'bg-minimal-sidebar text-minimal-muted hover:text-minimal-text'
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Model list */}
          <div className="px-1.5 py-1 text-[8px] font-bold uppercase tracking-widest text-minimal-muted">
            Model
          </div>
          <div className="custom-scrollbar max-h-44 space-y-0.5 overflow-y-auto px-1">
            {modelsFor(config.provider).map((m) => (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={config.model === m}
                onClick={() => {
                  setServiceModel(svc.key, m);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-[10px] font-medium text-minimal-text transition-colors hover:bg-minimal-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent',
                  config.model === m && 'bg-minimal-accent/10'
                )}
              >
                <span className="truncate">{m}</span>
                {config.model === m && <Check className="h-3 w-3 shrink-0 text-minimal-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
