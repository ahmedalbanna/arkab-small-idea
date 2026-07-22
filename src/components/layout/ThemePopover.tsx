import React, { useEffect, useRef, useState } from "react";
import { Palette, Check, Monitor, Sun, Moon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settingsStore";

interface ThemePopoverProps {
  className?: string;
}

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

type ThemeVariant = "andalusia" | "cosmos" | "parchment" | "tokyo";

const CUSTOM_THEMES: { id: ThemeVariant; label: string; bg: string; defaultDark: boolean }[] = [
  { id: "andalusia", label: "Andalusia", bg: "#2e7d32", defaultDark: false },
  { id: "cosmos", label: "Cosmos", bg: "#a855f7", defaultDark: true },
  { id: "parchment", label: "Parchment", bg: "#d84315", defaultDark: false },
  { id: "tokyo", label: "Tokyo", bg: "#ec4899", defaultDark: true },
];

const THEME_ACCENTS: Record<string, string> = {
  light: "#3498db",
  dark: "#6366f1",
  system: "#a1a1aa",
  andalusia: "#2e7d32",
  "andalusia-dark": "#2e7d32",
  cosmos: "#a855f7",
  "cosmos-dark": "#a855f7",
  parchment: "#d84315",
  "parchment-dark": "#d84315",
  tokyo: "#ec4899",
  "tokyo-dark": "#ec4899",
};

type Theme = string;

/** Get the base theme name without -dark suffix */
const themeBase = (t: Theme): string => t.replace(/-dark$/, "");
/** Check if theme is in dark mode */
const isDarkMode = (t: Theme): boolean => t.endsWith("-dark");

/**
 * Appearance & Style popover — theme, primary color, font, and layout.
 */
export const ThemePopover: React.FC<ThemePopoverProps> = ({ className }) => {
  const { theme, setTheme, headingColor, setHeadingColor } = useSettingsStore();
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

  type StoreTheme =
    | "light"
    | "dark"
    | "system"
    | "andalusia"
    | "cosmos"
    | "parchment"
    | "tokyo"
    | "andalusia-dark"
    | "cosmos-dark"
    | "parchment-dark"
    | "tokyo-dark";

  const isCustomTheme = (t: string): boolean => CUSTOM_THEMES.some((ct) => ct.id === t);

  /** Per-theme light/dark mode memory — each custom theme remembers its own mode */
  const [savedModes, setSavedModes] = useState<Record<string, "light" | "dark">>({});

  /** Determine the current mode among Light/Dark/System even when a custom theme is active */
  const currentMode = (): string => {
    if (theme === "light" || theme === "dark" || theme === "system") return theme;
    if (isCustomTheme(themeBase(theme))) {
      return isDarkMode(theme) ? "dark" : "light";
    }
    return "light";
  };

  /** Save the current custom theme's mode before navigating away */
  const saveCurrentMode = () => {
    if (isCustomTheme(themeBase(theme))) {
      setSavedModes((prev) => ({
        ...prev,
        [themeBase(theme)]: isDarkMode(theme) ? "dark" : "light",
      }));
    }
  };

  const handleThemeChange = (t: Theme) => {
    // Save the outgoing custom theme's mode before switching
    saveCurrentMode();

    // If clicking a Light/Dark/System radio while a custom theme is active,
    // update the custom theme's mode instead of switching away from it.
    const onCustom = isCustomTheme(themeBase(theme));
    if (!isCustomTheme(t) && onCustom) {
      // Light → strip -dark; Dark → add -dark; System → switch to system base
      if (t === "light" && isDarkMode(theme)) {
        const next = themeBase(theme) as StoreTheme;
        setTheme(next);
        setSavedModes((prev) => ({ ...prev, [themeBase(theme)]: "light" }));
      } else if (t === "dark" && !isDarkMode(theme)) {
        const next = `${themeBase(theme)}-dark` as StoreTheme;
        setTheme(next);
        setSavedModes((prev) => ({ ...prev, [themeBase(theme)]: "dark" }));
      } else if (t === "system") {
        setTheme("system");
      }
      // headingColor stays unchanged — user's custom color is respected
      return;
    }

    // Switching to a base Light/Dark/System theme
    if (!isCustomTheme(t)) {
      setTheme(t as StoreTheme);
      return;
    }

    // Switching to a custom theme — use its saved mode, or the theme's default
    const savedMode = savedModes[t];
    const themeDef = CUSTOM_THEMES.find((ct) => ct.id === t);
    let mode = "";
    if (savedMode) {
      mode = savedMode === "dark" ? "-dark" : "";
    } else if (themeDef?.defaultDark) {
      mode = "-dark";
    }
    const next = (mode ? `${t}${mode}` : t) as StoreTheme;
    setTheme(next);
    setHeadingColor(THEME_ACCENTS[next] || THEME_ACCENTS[t] || headingColor);
  };

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Appearance & Style"
        className={cn(
          "flex items-center justify-center rounded-md border px-1.5 py-1 transition-colors",
          "border-minimal-border bg-minimal-sidebar text-minimal-muted",
          "hover:border-minimal-accent/30 hover:text-minimal-text",
          open && "border-minimal-accent/40 text-minimal-accent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
        )}
        title="Appearance & Style"
      >
        <Palette className="h-3 w-3" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Appearance & Style"
          className="absolute end-0 bottom-full z-overlay-float mb-2 w-72 origin-bottom-end animate-in rounded-2xl border border-minimal-border bg-minimal-bg p-3 shadow-2xl fade-in zoom-in-95 duration-150"
        >
          {/* ── Theme ── */}
          <div className="mb-3">
            <div className="mb-2 px-1 text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
              Theme · الثيم
            </div>
            <div className="mb-2 grid grid-cols-3 gap-1">
              {THEMES.map((t) => {
                const Icon = t.icon;
                const active = currentMode() === t.id;
                return (
                  <label
                    key={t.id}
                    className={cn(
                      "relative flex cursor-pointer flex-col items-center gap-1 rounded-xl py-2 text-[9px] font-bold uppercase transition-all focus-within:ring-2 focus-within:ring-minimal-accent",
                      active
                        ? "bg-minimal-accent text-white"
                        : "bg-minimal-sidebar text-minimal-muted hover:text-minimal-text",
                    )}
                  >
                    <input
                      type="radio"
                      name="theme-mode"
                      value={t.id}
                      checked={active}
                      onChange={() => handleThemeChange(t.id as Theme)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    <Icon className={cn("h-4 w-4", active ? "text-white" : "text-minimal-muted")} />
                    {t.label}
                  </label>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {CUSTOM_THEMES.map((t) => {
                const active = themeBase(theme) === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleThemeChange(t.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[9px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
                      active
                        ? "bg-minimal-accent/10 text-minimal-accent"
                        : "text-minimal-muted hover:text-minimal-text hover:bg-minimal-sidebar",
                    )}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.bg }} />
                    <span className="flex-1 text-start">{t.label}</span>
                    {active && <Check className="h-3 w-3 shrink-0 text-minimal-accent" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Primary Color ── */}
          <div className="mb-3">
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <input
                type="color"
                value={headingColor}
                onChange={(e) => setHeadingColor(e.target.value)}
                aria-label="Primary theme color"
                className="h-5 w-5 cursor-pointer rounded border-none bg-transparent overflow-hidden"
              />
              <span className="text-[9px] font-bold uppercase tracking-wider text-minimal-muted">
                Primary Color · اللون الرئيسي
              </span>
              <span className="ms-auto font-mono text-[8px] text-minimal-muted">
                {headingColor}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
