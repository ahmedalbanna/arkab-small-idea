import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Bold,
  Italic,
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
  Quote,
  List,
  Table,
  PenTool,
  Cpu,
  Upload,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Wifi,
} from "lucide-react";
import { cn, useMediaQuery } from "../../lib/utils";
import { Z_CLASS } from "../../lib/zIndex";
import { useAIStore } from "../../stores/aiStore";
import { useUIStore } from "../../stores/uiStore";
import { useEditorStore } from "../../stores/editorStore";
import type { EmbeddingStatus } from "../../abstractions/storage";
import { getEmbeddingServiceSafe } from "../../services/serviceContainer";
import { getEditorRef } from "../../plugins/editorAccess";
import { insertText } from "../../plugins/ai/handlers";
import { AISettingsPopover } from "../ai/AISettingsPopover";
import { FontSettingsPopover } from "./FontSettingsPopover";
import { ThemePopover } from "./ThemePopover";
import { PluginsPopover } from "./PluginsPopover";
import type { PluginContext, ToolbarItem } from "../../plugins/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BottomBarProps {
  /** Ref to the hidden file input for image upload (mobile mode). */
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Plugin-contributed toolbar items (mobile mode). */
  toolbarItems?: ToolbarItem[];
  /** Resolved plugin context (mobile mode). */
  pluginContext?: PluginContext | null;
}

// ---------------------------------------------------------------------------
// Inline Sparkles icon (duplicated from StatusBar to avoid import cycle)
// ---------------------------------------------------------------------------

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// BottomBar
// ---------------------------------------------------------------------------

/**
 * Unified bottom bar that merges the desktop StatusBar and mobile MobileToolbar
 * into a single component.  Uses `useMediaQuery` to switch between modes.
 *
 * Desktop mode (≥768px):
 *   Left — word/char count, indexing status, progress bar
 *   Right — theme, font, plugins, AI popovers + AI connection / embedding status
 *
 * Mobile mode (<768px):
 *   Formatting buttons + AI toggle + plugin-contributed buttons
 */
export const BottomBar: React.FC<BottomBarProps> = ({
  fileInputRef,
  toolbarItems = [],
  pluginContext = null,
}) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  // ── Desktop: Stats ──
  const { ollamaStatus, provider, serviceConfigs } = useAIStore();
  const { isIndexing, indexedChunks, indexedEpisodes, isAutoSaving } = useUIStore();
  const { pages, activeFocusedPageId } = useEditorStore();

  // ── Embedding provider info ─────────────────────────────────────────
  const embeddingProvider = serviceConfigs?.embeddings?.provider ?? "pipeline";
  const embeddingModel = serviceConfigs?.embeddings?.model ?? "";
  const isApiEmbedding =
    embeddingProvider === "google" ||
    embeddingProvider === "openai" ||
    embeddingProvider === "ollama";

  const activePage = pages.find((p) => p.id === activeFocusedPageId) || pages[0];
  const markdown = activePage?.content || "";
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const charCount = markdown.length;
  const wordGoal = activePage?.wordGoal ?? 0;
  const goalProgress = wordGoal > 0 ? Math.min((wordCount / wordGoal) * 100, 100) : 0;

  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus>("idle");
  const [embeddingProgress, setEmbeddingProgress] = useState(0);

  useEffect(() => {
    const svc = getEmbeddingServiceSafe();
    if (!svc) return;
    return svc.subscribe((status, progress) => {
      setEmbeddingStatus(status);
      setEmbeddingProgress(progress);
    });
  }, []);

  // ── Announced text for aria-live ──
  const statusAnnouncement =
    [
      isAutoSaving ? "Auto-saving" : null,
      isIndexing ? "Indexing" : null,
      embeddingStatus === "ready" ? "Semantic AI ready" : null,
    ]
      .filter(Boolean)
      .join(". ") || `${wordCount} words`;

  // ── Mobile: Formatting ──
  const activePageId = pages.find((p) => p.id === activeFocusedPageId)?.id ?? null;
  const editorRef = activePageId ? getEditorRef(activePageId) : null;
  const pluginButtons = toolbarItems.filter((t) => (t.show ? t.show() : true));

  return (
    <>
      {/* Screen-reader live region for dynamic status updates */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>

      {isMobile ? (
        /* ────────── MOBILE MODE ────────── */
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className={cn(
            "fixed bottom-0 inset-x-0",
            "bg-minimal-bg/90 backdrop-blur border-t border-minimal-border",
            "shadow-[0_-10px_40px_rgba(0,0,0,0.1)]",
            Z_CLASS.sticky,
          )}
          style={{
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex items-center justify-around p-3 overflow-x-auto custom-scrollbar no-scrollbar scroll-smooth gap-1">
            <ToolbarButton
              icon={Bold}
              onClick={() => editorRef?.handleFormat("bold")}
              label="Bold"
            />
            <ToolbarButton
              icon={Italic}
              onClick={() => editorRef?.handleFormat("italic")}
              label="Italic"
            />
            <ToolbarButton
              icon={Quote}
              onClick={() => editorRef?.handleFormat("quote")}
              label="Blockquote"
            />
            <ToolbarButton
              icon={Table}
              onClick={() => editorRef?.handleFormat("tableify")}
              label="Table"
            />
            <ToolbarButton
              icon={List}
              onClick={() => editorRef?.handleFormat("bullet")}
              label="Bullet list"
            />
            <ToolbarButton
              icon={Heading2}
              onClick={() => editorRef?.handleFormat("h2")}
              label="Heading 2"
            />
            <ToolbarButton
              icon={LinkIcon}
              onClick={() => insertText("[", "](url)")}
              label="Insert link"
            />
            <ToolbarButton
              icon={ImageIcon}
              onClick={() => fileInputRef?.current?.click()}
              label="Insert image"
            />
            <ToolbarButton
              icon={PenTool}
              onClick={() => editorRef?.insertScribble()}
              label="Scribble"
            />
            <div className="w-px h-8 bg-minimal-border mx-1 shrink-0" />

            {pluginButtons.map((item) => {
              const Icon = item.icon;
              const active = item.isActive ? item.isActive() : false;
              return (
                <ToolbarButton
                  key={item.id}
                  icon={Icon}
                  onClick={() => item.onClick(pluginContext as PluginContext)}
                  label={item.label}
                  active={active}
                />
              );
            })}
          </div>
        </motion.div>
      ) : (
        /* ────────── DESKTOP MODE ────────── */
        <motion.footer
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className={cn(
            "fixed bottom-0 inset-x-0 h-9 md:h-11",
            "border-t border-minimal-border",
            "bg-minimal-bg/95 backdrop-blur-xl text-minimal-muted select-none",
            "shadow-[0_-4px_12px_rgba(0,0,0,0.03)]",
            Z_CLASS.sticky,
          )}
        >
          <div className="flex items-center justify-between h-full px-4 md:px-6">
            {/* ── Left Side: Stats ── */}
            <div className="flex gap-4 md:gap-8 items-center h-full">
              {isAutoSaving && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-2.5 py-1 bg-green-500/10 rounded-sm border border-green-500/20"
                >
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <span className="text-[9px] font-bold text-green-600 uppercase tracking-widest whitespace-nowrap">
                    Continuous Protection Active
                  </span>
                </motion.div>
              )}

              <div className={cn("flex gap-4 md:gap-6", isAutoSaving && "hidden sm:flex")}>
                <StatBlock label="WORDS" value={wordCount} />
                <StatBlock label="CHARS" value={charCount} />
              </div>

              <div className="h-6 w-px bg-minimal-border hidden sm:block" />

              {isIndexing ? (
                <div className="flex items-center gap-2 px-2 py-0.5 bg-minimal-accent/5 rounded border border-minimal-accent/20 animate-pulse">
                  <Loader2 className="w-3 h-3 text-minimal-accent animate-spin" />
                  <span className="text-[9px] font-bold text-minimal-accent uppercase tracking-widest">
                    Optimizing Intelligence Index...
                  </span>
                </div>
              ) : (
                <div className="hidden sm:flex flex-col justify-center">
                  <span className="text-[8px] font-bold opacity-40 leading-none mb-0.5 tracking-tighter">
                    MEMORY DEPTH
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-minimal-muted">
                      {indexedChunks + indexedEpisodes} NODES
                    </span>
                  </div>
                </div>
              )}

              {wordGoal > 0 && (
                <>
                  <div className="h-6 w-px bg-minimal-border hidden md:block" />
                  <div className="flex flex-col justify-center">
                    <span className="text-[8px] font-bold opacity-40 leading-none">PROGRESS</span>
                    <div className="flex items-center gap-3">
                      <div className="w-16 md:w-32 h-1 bg-minimal-border rounded-full overflow-hidden hidden sm:block">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${goalProgress}%` }}
                          className={cn(
                            "h-full",
                            goalProgress >= 100 ? "bg-emerald-500" : "bg-minimal-accent",
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-mono font-bold",
                          goalProgress >= 100
                            ? "text-emerald-500 underline underline-offset-2"
                            : "text-minimal-accent",
                        )}
                      >
                        {Math.round(goalProgress)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Right Side: Status Indicators ── */}
            <div className="flex gap-4 md:gap-6 items-center">
              <ThemePopover className="hidden md:flex" />
              <FontSettingsPopover className="hidden md:flex" />
              <PluginsPopover className="hidden md:flex" />
              <AISettingsPopover className="hidden md:flex" />

              <div className="h-6 w-px bg-minimal-border hidden md:block" />

              <div className="flex gap-2 items-center">
                {ollamaStatus.connected && (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-all",
                      "bg-green-500/5 text-green-600 border-green-500/10",
                    )}
                    title={`AI Provider: ${provider.toUpperCase()} | Model: ${ollamaStatus.model}`}
                  >
                    <Cpu className="w-3 h-3" />
                    <span className="text-[9px] font-bold tracking-widest">
                      {ollamaStatus.model.toUpperCase()}
                    </span>
                  </div>
                )}

                {embeddingStatus === "error" && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-red-500/20 bg-red-500/5 text-red-500"
                    title="Embedding model failed to load"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      Model Error
                    </span>
                    <button
                      onClick={() => {
                        const svc = getEmbeddingServiceSafe();
                        svc?.loadModel();
                      }}
                      className="ml-1 p-0.5 rounded hover:bg-red-500/10 transition-colors"
                      title="Retry loading"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}

                {embeddingStatus === "idle" && !isApiEmbedding && (
                  <button
                    onClick={() => {
                      const svc = getEmbeddingServiceSafe();
                      svc?.loadModel();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-minimal-accent/10 text-minimal-accent border border-minimal-accent/20 hover:bg-minimal-accent text-[9px] hover:text-white font-bold tracking-widest transition-all group scale-100 hover:scale-105 active:scale-95"
                    title={`Download local embedding model (${embeddingModel || "Xenova/all-MiniLM-L6-v2"})`}
                  >
                    <Upload className="w-3 h-3 rotate-180" />
                    <span>LOAD LOCAL MODEL</span>
                  </button>
                )}

                {embeddingStatus === "loading" && (
                  <div className="flex items-center gap-3 px-3 py-1 rounded-sm bg-minimal-sidebar border border-minimal-border">
                    <Loader2 className="w-3 h-3 text-minimal-accent animate-spin shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold opacity-40 leading-none mb-0.5 tracking-tighter">
                        LOADING EMBEDDING MODEL
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-minimal-border rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-minimal-accent"
                            initial={{ width: 0 }}
                            animate={{ width: `${embeddingProgress}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-minimal-accent">
                          {Math.round(embeddingProgress)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {embeddingStatus === "ready" && !isApiEmbedding && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
                    title="Local embedding pipeline ready"
                  >
                    <SparklesIcon className="w-3 h-3 shrink-0" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      Pipeline Ready
                    </span>
                  </div>
                )}

                {isApiEmbedding && (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-all",
                      embeddingStatus === "error"
                        ? "border-red-500/20 bg-red-500/5 text-red-500"
                        : "border-blue-500/20 bg-blue-500/5 text-blue-600",
                    )}
                    title={`Embedding provider: ${embeddingProvider.toUpperCase()}${embeddingModel ? ` | Model: ${embeddingModel}` : ""}`}
                  >
                    {embeddingStatus === "error" ? (
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                    ) : (
                      <Wifi className="w-3 h-3 shrink-0" />
                    )}
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      {embeddingProvider} Embeddings
                    </span>
                    {embeddingStatus === "error" && (
                      <span className="text-[8px] ml-1 opacity-70">ERR</span>
                    )}
                  </div>
                )}

                {!getEmbeddingServiceSafe() && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-minimal-border bg-minimal-sidebar text-minimal-muted/50"
                    title="RAG & embedding services not available (rag plugin disabled)"
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">RAG Off</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.footer>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Small vertical stat block (label + value). */
function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col justify-center">
      <span className="text-[8px] font-bold opacity-40 leading-none mb-0.5 tracking-tighter">
        {label}
      </span>
      <span className="text-[11px] font-mono font-bold text-minimal-text tabular-nums">
        {value}
      </span>
    </div>
  );
}

/** Single toolbar icon button (mobile mode). */
function ToolbarButton({
  icon: Icon,
  onClick,
  label,
  highlighted,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  label: string;
  highlighted?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "p-3 rounded-xl transition-colors shrink-0",
        highlighted
          ? "bg-minimal-accent/10 text-minimal-accent"
          : active
            ? "bg-minimal-accent/20 text-minimal-accent"
            : "bg-minimal-sidebar text-minimal-muted hover:text-minimal-text",
      )}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
