import React, { useEffect, useRef, useState } from 'react';
import { Puzzle, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSettingsStore } from '../../stores/settingsStore';
import { getPluginList } from '../../plugins';

interface PluginsPopoverProps {
  className?: string;
}

/**
 * Compact plugins toggle popover for the status bar.
 * Lists all non-essential plugins with on/off switches.
 */
export const PluginsPopover: React.FC<PluginsPopoverProps> = ({ className }) => {
  const disabledPlugins = useSettingsStore((s) => s.disabledPlugins);
  const setPluginEnabled = useSettingsStore((s) => s.setPluginEnabled);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const plugins = getPluginList().filter((p) => !p.essential);

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

  const enabledCount = plugins.length - disabledPlugins.filter((id) =>
    plugins.some((p) => p.id === id)
  ).length;

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Plugins"
        className={cn(
          'flex items-center justify-center rounded-md border px-1.5 py-1 transition-colors',
          'border-minimal-border bg-minimal-sidebar text-minimal-muted',
          'hover:border-minimal-accent/30 hover:text-minimal-text',
          open && 'border-minimal-accent/40 text-minimal-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent'
        )}
        title={`${enabledCount}/${plugins.length} plugins active`}
      >
        <Puzzle className="h-3 w-3" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Plugins"
          className="absolute end-0 bottom-full z-overlay-float mb-2 w-56 origin-bottom-end animate-in rounded-2xl border border-minimal-border bg-minimal-bg p-3 shadow-2xl fade-in zoom-in-95 duration-150"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
              Plugins
            </span>
            <span className="text-[8px] font-mono tabular-nums text-minimal-muted">
              {enabledCount}/{plugins.length}
            </span>
          </div>

          <div className="custom-scrollbar max-h-56 space-y-0.5 overflow-y-auto">
            {plugins.map((p) => {
              const isEnabled = !disabledPlugins.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  onClick={() => setPluginEnabled(p.id, !isEnabled)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent',
                    isEnabled
                      ? 'text-minimal-text hover:bg-minimal-sidebar'
                      : 'text-minimal-muted hover:bg-minimal-sidebar/50'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                      isEnabled
                        ? 'border-minimal-accent bg-minimal-accent text-white'
                        : 'border-minimal-border bg-minimal-sidebar'
                    )}
                  >
                    {isEnabled && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
