import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Cpu } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAIStore } from "../../stores/aiStore";
import { STATIC_MODELS } from "../../constants";

const PROVIDERS = ["ollama", "openai", "anthropic", "google", "pipeline"] as const;
type Provider = (typeof PROVIDERS)[number];

interface ModelSwitcherProps {
  className?: string;
  /** Open the dropdown upward instead of downward (useful in a bottom bar). */
  dropdownUp?: boolean;
}

/**
 * Compact provider/model selector. When `dropdownUp` is true the popover
 * opens above the trigger (useful for status-bar placement).
 */
export const ModelSwitcher: React.FC<ModelSwitcherProps> = ({ className, dropdownUp }) => {
  const { serviceConfigs, availableModels, setServiceProvider, setServiceModel } = useAIStore();
  const chat = serviceConfigs.chat;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const modelsFor = (provider: Provider): string[] => {
    if (provider === "ollama") {
      return availableModels.length ? availableModels : [chat.model];
    }
    return STATIC_MODELS[provider] ?? [chat.model];
  };

  const selectProvider = (provider: Provider) => {
    setServiceProvider("chat", provider);
    const firstModel = modelsFor(provider)[0];
    if (firstModel) setServiceModel("chat", firstModel);
  };

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`AI model: ${chat.model}, provider ${chat.provider}`}
        className="flex items-center gap-1 rounded-full border border-minimal-border bg-minimal-sidebar px-2 py-1 text-[9px] font-bold uppercase tracking-tight text-minimal-muted transition-colors hover:border-minimal-accent/30 hover:text-minimal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
      >
        <Cpu className="h-3 w-3 text-minimal-accent" />
        <span className="max-w-[100px] truncate">{chat.model}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Select AI provider and model"
          className={cn(
            "absolute end-0 z-overlay-float w-56 origin-top-end animate-in rounded-2xl border border-minimal-border bg-minimal-bg p-2 shadow-2xl fade-in zoom-in-95 duration-150",
            dropdownUp ? "bottom-full mb-2 origin-bottom-end" : "top-full mt-2",
          )}
        >
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
            Provider
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                role="menuitemradio"
                aria-checked={chat.provider === p}
                onClick={() => selectProvider(p)}
                className={cn(
                  "rounded-lg py-1.5 text-[9px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
                  chat.provider === p
                    ? "bg-minimal-accent text-white"
                    : "bg-minimal-sidebar text-minimal-muted hover:text-minimal-text",
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
            Model
          </div>
          <div className="custom-scrollbar max-h-44 space-y-0.5 overflow-y-auto">
            {modelsFor(chat.provider).map((m) => (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={chat.model === m}
                onClick={() => {
                  setServiceModel("chat", m);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-[10px] font-medium text-minimal-text transition-colors hover:bg-minimal-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
                  chat.model === m && "bg-minimal-accent/10",
                )}
              >
                <span className="truncate">{m}</span>
                {chat.model === m && <Check className="h-3 w-3 shrink-0 text-minimal-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
