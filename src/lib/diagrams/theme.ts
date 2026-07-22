export type AppThemeName =
  "light" | "dark" | "system" | "andalusia" | "cosmos" | "parchment" | "tokyo";

// Named themes that read as "dark" for diagram engines (mermaid/vega/etc.).
const DARK_THEMES = new Set(["dark", "andalusia", "cosmos", "tokyo"]);

/**
 * Resolves the current UI theme to the binary "dark" | "light" hint that the
 * local diagram engines understand. `system` follows the OS preference.
 */
export function resolveTheme(name: string | null | undefined): "dark" | "light" {
  const current = name;
  if (!current || current === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }
  return DARK_THEMES.has(current) ? "dark" : "light";
}
