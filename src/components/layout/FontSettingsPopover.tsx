import React, { useEffect, useRef, useState } from "react";
import { Type, Minus, Plus } from "lucide-react";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settingsStore";

interface FontSettingsPopoverProps {
  className?: string;
}

const FONT_OPTIONS = [
  "Inter, sans-serif",
  "Georgia, serif",
  "Merriweather, serif",
  "Source Sans Pro, sans-serif",
  "System UI, sans-serif",
  "Monaco, monospace",
  "Crimson Text, serif",
];

const MAX_WIDTH_OPTIONS = [
  { label: "Narrow", value: "600px" },
  { label: "Normal", value: "800px" },
  { label: "Wide", value: "1000px" },
  { label: "Full", value: "100%" },
];

/**
 * Compact font/typography settings popover for the status bar.
 */
export const FontSettingsPopover: React.FC<FontSettingsPopoverProps> = ({ className }) => {
  const {
    fontFamily,
    fontSize,
    lineHeight,
    maxWidth,
    setFontFamily,
    setFontSize,
    setLineHeight,
    setMaxWidth,
  } = useSettingsStore();
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

  const shortFontName = fontFamily.split(",")[0].replace(/['"]/g, "");

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Font settings"
        className={cn(
          "flex items-center justify-center rounded-md border px-1.5 py-1 transition-colors",
          "border-minimal-border bg-minimal-sidebar text-minimal-muted",
          "hover:border-minimal-accent/30 hover:text-minimal-text",
          open && "border-minimal-accent/40 text-minimal-accent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
        )}
        title={`Font: ${shortFontName}, ${fontSize}px`}
      >
        <Type className="h-3 w-3" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Font settings"
          className="absolute end-0 bottom-full z-overlay-float mb-2 w-64 origin-bottom-end animate-in rounded-2xl border border-minimal-border bg-minimal-bg p-3 shadow-2xl fade-in zoom-in-95 duration-150"
        >
          {/* ── Font Family ── */}
          <div className="mb-3">
            <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
              Font Family
            </div>
            <div className="custom-scrollbar flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFontFamily(f)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[9px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
                    fontFamily === f
                      ? "bg-minimal-accent text-white"
                      : "bg-minimal-sidebar text-minimal-muted hover:text-minimal-text",
                  )}
                >
                  {f.split(",")[0].replace(/['"]/g, "")}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 h-px bg-minimal-border" />

          {/* ── Font Size ── */}
          <div className="mb-3">
            <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
              Font Size
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                aria-label="Decrease font size"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-minimal-border bg-minimal-sidebar text-minimal-muted transition-colors hover:text-minimal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[3ch] text-center text-[11px] font-mono font-bold tabular-nums text-minimal-text">
                {fontSize}
              </span>
              <button
                type="button"
                onClick={() => setFontSize(Math.min(32, fontSize + 1))}
                aria-label="Increase font size"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-minimal-border bg-minimal-sidebar text-minimal-muted transition-colors hover:text-minimal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
              >
                <Plus className="h-3 w-3" />
              </button>
              <span className="ms-1 text-[9px] text-minimal-muted">px</span>
            </div>
          </div>

          {/* ── Line Height ── */}
          <div className="mb-3">
            <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
              Line Height
            </div>
            <div className="flex items-center gap-1">
              {[1.2, 1.4, 1.6, 1.8, 2.0].map((lh) => (
                <button
                  key={lh}
                  type="button"
                  onClick={() => setLineHeight(lh)}
                  className={cn(
                    "flex-1 rounded-lg py-1 text-[9px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
                    Math.abs(lineHeight - lh) < 0.01
                      ? "bg-minimal-accent text-white"
                      : "bg-minimal-sidebar text-minimal-muted hover:text-minimal-text",
                  )}
                >
                  {lh}
                </button>
              ))}
            </div>
          </div>

          {/* ── Max Width ── */}
          <div>
            <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-widest text-minimal-muted">
              Max Width
            </div>
            <div className="flex items-center gap-1">
              {MAX_WIDTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMaxWidth(opt.value)}
                  className={cn(
                    "flex-1 rounded-lg py-1 text-[8px] font-bold uppercase tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
                    maxWidth === opt.value
                      ? "bg-minimal-accent text-white"
                      : "bg-minimal-sidebar text-minimal-muted hover:text-minimal-text",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
