import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';
import { getPluginList, setPluginEnabled } from '../../plugins';
import type { PluginSettingDef } from '../../plugins/types';

interface SettingsModalProps {
  /** Plugin-contributed settings to render. */
  pluginSettings?: PluginSettingDef[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ pluginSettings = [] }) => {
  const { showSettings, setSettings } = useUIStore();
  const {
    theme, setTheme,
    fontFamily, setFontFamily,
    maxWidth, setMaxWidth,
    headingColor, setHeadingColor,
    enableHeadingNumbering, setEnableHeadingNumbering,
    disabledPlugins,
    pluginSettings: pluginSettingValues,
    setPluginSetting,
  } = useSettingsStore();

  const plugins = getPluginList().filter((p) => !p.essential);

  // Group plugin settings by their `group` for rendering.
  const groupedSettings = pluginSettings.reduce<Record<string, PluginSettingDef[]>>(
    (acc, def) => {
      const group = def.group ?? "Plugins";
      (acc[group] ||= []).push(def);
      return acc;
    },
    {},
  );

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
              {/* Theme Gallery Section */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Appearance & Style</span>
                  <span className="text-[8px] bg-minimal-accent/10 text-minimal-accent px-2 py-0.5 rounded-full font-black">PREMIUM</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'light', label: 'Classic Bright', desc: 'مشرق كلاسيكي', bg: '#ffffff', accent: '#3498db', text: 'text-zinc-800' },
                    { id: 'dark', label: 'Onyx Charcoal', desc: 'فحم الأونيكس', bg: '#111115', accent: '#6366f1', text: 'text-zinc-100' },
                    { id: 'system', label: 'System Match', desc: 'مزامنة النظام', bg: '#27272a', accent: '#a1a1aa', text: 'text-zinc-300' },
                    { id: 'andalusia', label: 'Andalusia Gold', desc: 'الأندلس الذهبي', bg: '#fdfaf2', accent: '#2e7d32', text: 'text-emerald-900' },
                    { id: 'cosmos', label: 'Deep Cosmos', desc: 'الكون الساحر', bg: '#0a0a14', accent: '#a855f7', text: 'text-purple-200' },
                    { id: 'parchment', label: 'Vintage Parchment', desc: 'الوثيقة العتيقة', bg: '#f4ece1', accent: '#d84315', text: 'text-amber-950' },
                    { id: 'tokyo', label: 'Neon Tokyo', desc: 'طوكيو النيون', bg: '#0d0e15', accent: '#ec4899', text: 'text-cyan-400' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as any)}
                      className={cn(
                        "relative flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 group cursor-pointer",
                        theme === t.id
                          ? "border-minimal-accent ring-2 ring-minimal-accent/20 bg-minimal-sidebar shadow-md"
                          : "bg-minimal-sidebar/40 border-minimal-border hover:border-minimal-accent/30"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[10px] font-black uppercase tracking-tight text-minimal-text truncate">
                          {t.label}
                        </span>
                        <div className="flex gap-1">
                          <div className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.bg }} />
                          <div className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.accent }} />
                        </div>
                      </div>
                      <span className="text-[9px] text-minimal-muted leading-tight font-medium">
                        {t.desc}
                      </span>
                      {theme === t.id && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-minimal-accent rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Typography Section */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Typography</h4>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-minimal-muted uppercase">Font Family / عائلة الخط</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Cairo (حديث هندسي)', value: '"Cairo", sans-serif' },
                      { label: 'Amiri (أصيل كلاسيكي)', value: '"Amiri", serif' },
                      { label: 'Sans Serif (Inter)', value: 'Inter, sans-serif' },
                      { label: 'Serif (Garamond)', value: '"EB Garamond", serif' },
                      { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
                      { label: 'Courier Typewriter', value: '"Courier Prime", monospace' },
                    ].map(f => (
                      <button
                        key={f.value}
                        onClick={() => setFontFamily(f.value)}
                        className={cn(
                          "py-2 px-3 rounded-xl border text-[10px] font-bold transition-all text-left flex flex-col gap-0.5 cursor-pointer",
                          fontFamily === f.value
                            ? "bg-minimal-accent/10 border-minimal-accent text-minimal-accent"
                            : "bg-minimal-sidebar/50 border-minimal-border text-minimal-muted hover:border-minimal-accent/30"
                        )}
                        style={{ fontFamily: f.value }}
                      >
                        <span className="truncate leading-tight">{f.label.split(' ')[0]}</span>
                        <span className="text-[8px] opacity-70 truncate font-normal leading-tight">{f.label.includes(' ') ? f.label.substring(f.label.indexOf(' ') + 1) : ''}</span>
                      </button>
                    ))}
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

              {/* Headings Section */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Editor Headings</h4>
                
                <div className="flex items-center justify-between p-3 bg-minimal-sidebar/50 border border-minimal-border rounded-xl">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-minimal-text uppercase">Automatic Numbering</label>
                    <p className="text-[8px] text-minimal-muted uppercase">1.1, 1.2, 2.1 formatting</p>
                  </div>
                  <button
                    onClick={() => setEnableHeadingNumbering(!enableHeadingNumbering)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-all relative",
                      enableHeadingNumbering ? "bg-minimal-accent" : "bg-minimal-border"
                    )}
                  >
                    <motion.div
                      animate={{ x: enableHeadingNumbering ? 20 : 2 }}
                      className="absolute top-1 left-0 w-3 h-3 rounded-full bg-white shadow-sm"
                    />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-minimal-muted uppercase">Primary Theme Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={headingColor}
                      onChange={(e) => setHeadingColor(e.target.value)}
                      className="w-10 h-10 rounded-lg overflow-hidden border-none cursor-pointer bg-transparent"
                    />
                    <div className="flex-1 px-3 py-2 bg-minimal-sidebar/50 border border-minimal-border rounded-xl font-mono text-[10px] text-minimal-text uppercase">
                      {headingColor}
                    </div>
                  </div>
                </div>
              </section>

              {/* Features Section */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Features / الميزات</h4>
                <div className="space-y-2">
                  {plugins.map((p) => {
                    const enabled = !disabledPlugins.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-minimal-sidebar/50 border border-minimal-border rounded-xl"
                      >
                        <div className="space-y-0.5">
                          <label className="text-[10px] font-bold text-minimal-text uppercase">{p.name}</label>
                          <p className="text-[8px] text-minimal-muted uppercase">{p.id}</p>
                        </div>
                        <button
                          onClick={() => setPluginEnabled(p.id, !enabled)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative",
                            enabled ? "bg-minimal-accent" : "bg-minimal-border"
                          )}
                          aria-pressed={enabled}
                        >
                          <motion.div
                            animate={{ x: enabled ? 20 : 2 }}
                            className="absolute top-1 left-0 w-3 h-3 rounded-full bg-white shadow-sm"
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Plugin Settings Section */}
              {pluginSettings.length > 0 && (
                <section className="space-y-4">
                  <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Plugin Settings</h4>
                  {Object.entries(groupedSettings).map(([group, defs]) => (
                    <div key={group} className="space-y-2">
                      <p className="text-[8px] font-bold text-minimal-accent uppercase tracking-widest">{group}</p>
                      {defs.map((def) => {
                        const key = `${def.pluginId}.${def.key}`;
                        const value = pluginSettingValues[key] ?? def.defaultValue;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between p-3 bg-minimal-sidebar/50 border border-minimal-border rounded-xl gap-3"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <label className="text-[10px] font-bold text-minimal-text uppercase block truncate">{def.label}</label>
                              {def.description && (
                                <p className="text-[8px] text-minimal-muted uppercase truncate">{def.description}</p>
                              )}
                            </div>
                            <div className="shrink-0">
                              {def.type === "toggle" && (
                                <button
                                  onClick={() => setPluginSetting(def.pluginId, def.key, !value)}
                                  className={cn(
                                    "w-10 h-5 rounded-full transition-all relative",
                                    value ? "bg-minimal-accent" : "bg-minimal-border"
                                  )}
                                  aria-pressed={!!value}
                                >
                                  <motion.div
                                    animate={{ x: value ? 20 : 2 }}
                                    className="absolute top-1 left-0 w-3 h-3 rounded-full bg-white shadow-sm"
                                  />
                                </button>
                              )}
                              {def.type === "select" && (
                                <select
                                  value={String(value)}
                                  onChange={(e) => setPluginSetting(def.pluginId, def.key, e.target.value)}
                                  className="bg-minimal-sidebar border border-minimal-border rounded-lg px-2 py-1 text-[10px] font-bold text-minimal-text"
                                >
                                  {def.options?.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              )}
                              {def.type === "text" && (
                                <input
                                  type="text"
                                  value={String(value)}
                                  onChange={(e) => setPluginSetting(def.pluginId, def.key, e.target.value)}
                                  className="bg-minimal-sidebar border border-minimal-border rounded-lg px-2 py-1 text-[10px] font-bold text-minimal-text w-32"
                                />
                              )}
                              {def.type === "number" && (
                                <input
                                  type="number"
                                  value={Number(value)}
                                  onChange={(e) => setPluginSetting(def.pluginId, def.key, Number(e.target.value))}
                                  className="bg-minimal-sidebar border border-minimal-border rounded-lg px-2 py-1 text-[10px] font-bold text-minimal-text w-20"
                                />
                              )}
                              {def.type === "slider" && (
                                <input
                                  type="range"
                                  value={Number(value)}
                                  onChange={(e) => setPluginSetting(def.pluginId, def.key, Number(e.target.value))}
                                  className="w-24 accent-minimal-accent"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </section>
              )}
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
