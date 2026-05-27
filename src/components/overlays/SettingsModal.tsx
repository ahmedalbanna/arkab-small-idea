import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';

export const SettingsModal: React.FC = () => {
  const { showSettings, setSettings } = useUIStore();
  const {
    theme, setTheme,
    fontFamily, setFontFamily,
    fontSize, setFontSize,
    lineHeight, setLineHeight,
    maxWidth, setMaxWidth
  } = useSettingsStore();

  return (
    <AnimatePresence>
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettings(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-minimal-bg border border-minimal-border rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-minimal-border flex items-center justify-between bg-minimal-sidebar/50">
              <h3 className="text-xs font-bold text-minimal-text uppercase tracking-widest">Global Settings</h3>
              <button onClick={() => setSettings(false)} className="p-2 hover:bg-minimal-border rounded-full transition-colors">
                <X className="w-4 h-4 text-minimal-muted" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Theme Section */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Appearance</h4>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'system'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        "py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition-all",
                        theme === t
                          ? "bg-minimal-accent border-minimal-accent text-white shadow-lg shadow-minimal-accent/20"
                          : "bg-minimal-sidebar/50 border-minimal-border text-minimal-muted hover:border-minimal-accent/30"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>

              {/* Typography Section */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Typography</h4>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-minimal-muted uppercase">Font Family</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Sans Serif', value: 'Inter, sans-serif' },
                      { label: 'Serif', value: '"Merriweather", serif' },
                      { label: 'Mono', value: '"JetBrains Mono", monospace' },
                      { label: 'Elegant', value: '"EB Garamond", serif' },
                    ].map(f => (
                      <button
                        key={f.value}
                        onClick={() => setFontFamily(f.value)}
                        className={cn(
                          "py-2 px-3 rounded-xl border text-[10px] font-bold transition-all text-left",
                          fontFamily === f.value
                            ? "bg-minimal-accent/10 border-minimal-accent text-minimal-accent"
                            : "bg-minimal-sidebar/50 border-minimal-border text-minimal-muted hover:border-minimal-accent/30"
                        )}
                        style={{ fontFamily: f.value }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-minimal-muted uppercase">Size: {fontSize}px</label>
                    <input
                      type="range" min="12" max="24" step="1"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full accent-minimal-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-minimal-muted uppercase">Spacing: {lineHeight}</label>
                    <input
                      type="range" min="1.2" max="2.4" step="0.1"
                      value={lineHeight}
                      onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                      className="w-full accent-minimal-accent"
                    />
                  </div>
                </div>
              </section>

              {/* Layout Section */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Layout</h4>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-minimal-muted uppercase">Content Width</label>
                  <div className="flex gap-2">
                    {['600px', '800px', '1000px', '100%'].map(w => (
                      <button
                        key={w}
                        onClick={() => setMaxWidth(w)}
                        className={cn(
                          "flex-1 py-2 rounded-xl border text-[10px] font-bold transition-all",
                          maxWidth === w
                            ? "bg-minimal-accent/10 border-minimal-accent text-minimal-accent"
                            : "bg-minimal-sidebar/50 border-minimal-border text-minimal-muted hover:border-minimal-accent/30"
                        )}
                      >
                        {w === '100%' ? 'Full' : w}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="p-4 bg-minimal-sidebar/30 border-t border-minimal-border text-center">
              <p className="text-[8px] font-bold text-minimal-muted uppercase tracking-[0.2em]">Ink & Quill v2.0.0 — Modern Minimalism</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
