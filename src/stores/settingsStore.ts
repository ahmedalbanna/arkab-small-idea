import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  
  setTheme: (theme: SettingsState['theme'] | ((prev: SettingsState['theme']) => SettingsState['theme'])) => void;
  setFontSize: (size: number | ((prev: number) => number)) => void;
  setLineHeight: (height: number | ((prev: number) => number)) => void;
  setMaxWidth: (width: string | ((prev: string) => string)) => void;
  setFontFamily: (font: string | ((prev: string) => string)) => void;
  setHeadingColor: (color: string) => void;
  setEnableHeadingNumbering: (enabled: boolean) => void;
  setPluginEnabled: (id: string, enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 16,
      lineHeight: 1.6,
      maxWidth: '800px',
      fontFamily: 'Inter, sans-serif',
      headingColor: '#000000',
      enableHeadingNumbering: false,
      disabledPlugins: [],

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
    }),
    {
      name: 'ink-quill-settings',
    }
  )
);
