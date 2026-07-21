import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';
import { getPluginList } from '../../plugins';
import { useSetPluginEnabled } from '../../plugins/registryContext';
import type { PluginSettingDef } from '../../plugins/types';
import { ModalSlot } from '../layout/ModalSlot';

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

  const togglePlugin = useSetPluginEnabled();

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
    <ModalSlot
      isOpen={showSettings}
      onClose={() => setSettings(false)}
      hideCloseButton={true}
      maxWidth="max-w-md"
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-minimal-border flex items-center justify-between bg-minimal-sidebar/50 shrink-0">
          <h3 className="text-xs font-bold text-minimal-text uppercase tracking-widest">Global Settings</h3>
          <button onClick={() => setSettings(false)} className="p-2 hover:bg-minimal-border rounded-full transition-colors" aria-label="Close settings">
            <X className="w-4 h-4 text-minimal-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-0">
              {/* Theme Gallery Section */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Appearance & Style</span>
                  <span className="text-[8px] bg-minimal-accent/10 text-minimal-accent px-2 py-0.5 rounded-full font-black">PREMIUM</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'light', label: 'Classic Bright', desc: 'مشرق كلاسيكي', bg: '#ffffff', accent: '#3498db', text: 'text-gray-800' },
                    { id: 'dark', label: 'Onyx Charcoal', desc: 'فحم الأونيكس', bg: '#111115', accent: '#6366f1', text: 'text-gray-100' },
                    { id: 'system', label: 'System Match', desc: 'مزامنة النظام', bg: '#27272a', accent: '#a1a1aa', text: 'text-gray-300' },
                    { id: 'andalusia', label: 'Andalusia Gold', desc: 'الأندلس الذهبي', bg: '#fdfaf2', accent: '#2e7d32', text: 'text-emerald-900' },
                    { id: 'cosmos', label: 'Deep Cosmos', desc: 'الكون الساحر', bg: '#0a0a14', accent: '#a855f7', text: 'text-purple-200' },
                    { id: 'parchment', label: 'Vintage Parchment', desc: 'الوثيقة العتيقة', bg: '#f4ece1', accent: '#d84315', text: 'text-amber-950' },
                    { id: 'tokyo', label: 'Neon Tokyo', desc: 'طوكيو النيون', bg: '#0d0e15', accent: '#ec4899', text: 'text-cyan-400' },
                  ].map(t => {
                    const isCustom = ['andalusia', 'cosmos', 'parchment', 'tokyo'].includes(t.id);
                    return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id as any);
                        // Only auto-set heading color for custom themes that have a defined accent.
                        // Light/Dark/System respect whatever custom color the user chose.
                        if (isCustom) setHeadingColor(t.accent);
                      }}
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
                        <div className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: headingColor }} />
                      )}
                    </button>
                  );
                  })}
                </div>

                {/* Primary Theme Color — synced with selected theme, overridable */}
                <div className="flex items-center gap-2 pt-1 px-0.5">
                  <input
                    type="color"
                    value={headingColor}
                    onChange={(e) => setHeadingColor(e.target.value)}
                    aria-label="Primary theme color"
                    className="w-7 h-7 rounded-lg overflow-hidden border-none cursor-pointer bg-transparent shrink-0"
                  />
                  <span className="text-[9px] font-bold text-minimal-muted uppercase tracking-wider">
                    Primary Color · اللون الرئيسي
                  </span>
                  <span className="ms-auto font-mono text-[9px] text-minimal-muted">{headingColor}</span>
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
                      className="absolute top-1 start-0 w-3 h-3 rounded-full bg-white shadow-sm"
                    />
                  </button>
                </div>

                {/* Primary color is now integrated above with the theme cards */}
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
                          onClick={() => togglePlugin(p.id, !enabled)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative",
                            enabled ? "bg-minimal-accent" : "bg-minimal-border"
                          )}
                          aria-pressed={enabled}
                        >
                          <motion.div
                            animate={{ x: enabled ? 20 : 2 }}
                            className="absolute top-1 start-0 w-3 h-3 rounded-full bg-white shadow-sm"
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
                                    className="absolute top-1 start-0 w-3 h-3 rounded-full bg-white shadow-sm"
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

        <div className="p-4 bg-minimal-sidebar/30 border-t border-minimal-border text-center shrink-0">
          <p className="text-[8px] font-bold text-minimal-muted uppercase tracking-[0.2em]">Ink & Quill v2.0.0 — Modern Minimalism</p>
        </div>
      </div>
    </ModalSlot>
  );
};
