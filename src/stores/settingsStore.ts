import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  migratePluginToggles,
  PLUGIN_TOGGLES_VERSION,
} from '../plugins/pluginToggleMigration';
import { idbStorage } from '../lib/idbStorage';

interface SettingsState {
  theme: 'light' | 'dark' | 'system' | 'andalusia' | 'cosmos' | 'parchment' | 'tokyo';
  fontSize: number;
  lineHeight: number;
  maxWidth: string;
  fontFamily: string;
  headingColor: string;
  enableHeadingNumbering: boolean;
  /** Ids of plugins the user has turned off. Persisted. */
  disabledPlugins: string[];
  /** Values for plugin-contributed settings, keyed by `${pluginId}.${key}`. */
  pluginSettings: Record<string, unknown>;

  setTheme: (theme: SettingsState['theme'] | ((prev: SettingsState['theme']) => SettingsState['theme'])) => void;
  setFontSize: (size: number | ((prev: number) => number)) => void;
  setLineHeight: (height: number | ((prev: number) => number)) => void;
  setMaxWidth: (width: string | ((prev: string) => string)) => void;
  setFontFamily: (font: string | ((prev: string) => string)) => void;
  setHeadingColor: (color: string) => void;
  setEnableHeadingNumbering: (enabled: boolean) => void;
  setPluginEnabled: (id: string, enabled: boolean) => void;
  setPluginSetting: (pluginId: string, key: string, value: unknown) => void;
  getPluginSetting: (pluginId: string, key: string, fallback?: unknown) => unknown;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      fontSize: 16,
      lineHeight: 1.6,
      maxWidth: '800px',
      fontFamily: 'Inter, sans-serif',
      headingColor: '#000000',
      enableHeadingNumbering: false,
      disabledPlugins: [],
      pluginSettings: {},

      setTheme: (theme) => set((state) => ({ 
        theme: typeof theme === 'function' ? theme(state.theme) : theme 
      })),
      setFontSize: () => {},
      setLineHeight: () => {},
      setMaxWidth: (maxWidth) => set((state) => ({ 
        maxWidth: typeof maxWidth === 'function' ? maxWidth(state.maxWidth) : maxWidth 
      })),
      setFontFamily: (fontFamily) => set((state) => ({ 
        fontFamily: typeof fontFamily === 'function' ? fontFamily(state.fontFamily) : fontFamily 
      })),
      setHeadingColor: (headingColor) => set({ headingColor }),
      setEnableHeadingNumbering: (enableHeadingNumbering) => set({ enableHeadingNumbering }),
      setPluginEnabled: (id, enabled) =>
        set((state) => {
          const set = new Set(state.disabledPlugins);
          if (enabled) set.delete(id);
          else set.add(id);
          return { disabledPlugins: [...set] };
        }),
      setPluginSetting: (pluginId, key, value) =>
        set((state) => ({
          pluginSettings: {
            ...state.pluginSettings,
            [`${pluginId}.${key}`]: value,
          },
        })),
      getPluginSetting: (pluginId, key, fallback) =>
        get().pluginSettings[`${pluginId}.${key}`] ?? fallback,
    }),
    {
      name: 'ink-quill-settings',
      storage: createJSONStorage(() => idbStorage),
      version: PLUGIN_TOGGLES_VERSION,
      // Reconcile persisted plugin toggles to the current schema on load:
      // coerce the shape and apply any legacy id renames so old storage keeps
      // working after a plugin is renamed. Unknown (removed) ids are pruned at
      // runtime by `validateDisabledPlugins` when the editor builds.
      migrate: (persisted: Record<string, unknown> | undefined, version: number) => {
        const state = persisted ?? {};
        return {
          ...state,
          disabledPlugins: migratePluginToggles(
            state.disabledPlugins,
            version ?? 0,
          ),
        };
      },
    }
  )
);
