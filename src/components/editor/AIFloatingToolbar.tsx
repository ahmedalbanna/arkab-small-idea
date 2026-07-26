import { useState, useRef, useCallback, memo, type RefObject } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  CheckCheck,
  FileText,
  Maximize2,
  Minimize2,
  RotateCcw,
  MoreHorizontal,
  ChevronUp,
  Square,
  Wand2,
  ArrowRight,
  Layout,
  Heading,
  Send,
} from "lucide-react";
import type { AIAssistantAction } from "../../services/aiService";
import type { AIScope } from "./hooks/useAIStreaming";
import { cn } from "../../lib/utils";

interface AIFloatingToolbarProps {
  state: { x: number; y: number; show: boolean; editorId: string };
  isProcessingAI: boolean;
  /** When the AI is streaming inline, we show a simpler indicator instead. */
  aiStreaming: boolean;
  onAction: (action: AIAssistantAction, customInstruction?: string, scope?: AIScope) => void;
  onStop: () => void;
  /** Called when the user presses Escape with an empty input. */
  onClose?: () => void;
  /** Editor text direction (for RTL positioning). */
  direction?: "ltr" | "rtl";
  /** Container element used for viewport clamping. */
  containerRef?: RefObject<HTMLDivElement | null>;
  /** When true, renders only the toolbar content without the outer positioning wrapper — use inside a bubble menu. */
  embedded?: boolean;
}

/**
 * Single source of truth for all AI action definitions.
 * Each entry carries its scope explicitly so that every invocation path
 * (compact toolbar, expanded panel, bubble menu) sends the same signal.
 *
 * Groups:
 *   - "quick":   Shown in the compact row (most common actions).
 *   - "editing": Shown in the expanded "Editing" section.
 *   - "structure": Shown in the expanded "Structure" section.
 */
interface AIActionDef {
  id: AIAssistantAction;
  label: string;
  icon: React.FC<{ className?: string }>;
  scope: AIScope;
  group: "quick" | "editing" | "structure";
}

const AI_ACTION_DEFS: AIActionDef[] = [
  // Quick actions (compact row — selection scope by default)
  { id: "improve", label: "Improve", icon: Zap, scope: "sel", group: "quick" },
  { id: "fix-grammar", label: "Fix Grammar", icon: CheckCheck, scope: "sel", group: "quick" },
  { id: "summarize", label: "Summarize", icon: FileText, scope: "sel", group: "quick" },
  { id: "expand", label: "Expand", icon: Maximize2, scope: "sel", group: "quick" },
  { id: "rewrite", label: "Rewrite", icon: RotateCcw, scope: "sel", group: "quick" },

  // Editing actions (expanded panel)
  { id: "improve", label: "Improve", icon: Wand2, scope: "sel", group: "editing" },
  { id: "fix-grammar", label: "Fix Grammar", icon: CheckCheck, scope: "sel", group: "editing" },
  { id: "shorten", label: "Shorten", icon: Minimize2, scope: "sel", group: "editing" },
  { id: "expand", label: "Expand", icon: Maximize2, scope: "sel", group: "editing" },
  { id: "rewrite", label: "Rewrite", icon: RotateCcw, scope: "sel", group: "editing" },
  { id: "complete-text", label: "Continue", icon: ArrowRight, scope: "sel", group: "editing" },

  // Structure actions (expanded panel — doc scope)
  { id: "generate-outline", label: "Outline", icon: Layout, scope: "doc", group: "structure" },
  { id: "expand-outline", label: "Expand Outline", icon: Zap, scope: "doc", group: "structure" },
  { id: "draft-topic", label: "Draft Topic", icon: ArrowRight, scope: "doc", group: "structure" },
  { id: "summarize", label: "Summarize", icon: FileText, scope: "sel", group: "structure" },
  { id: "suggest-title", label: "Titles", icon: Heading, scope: "doc", group: "structure" },
];

export const AIFloatingToolbar = memo(
  function AIFloatingToolbar({
    state,
    isProcessingAI,
    aiStreaming,
    onAction,
    onStop,
    onClose,
    direction = "ltr",
    containerRef,
    embedded = false,
  }: AIFloatingToolbarProps) {
    const [customInstruction, setCustomInstruction] = useState("");
    const [expanded, setExpanded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const expandedInputRef = useRef<HTMLInputElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    const handleSubmitCustom = useCallback(() => {
      const text = customInstruction.trim();
      if (!text) return;
      onAction("complete-text", text);
      setCustomInstruction("");
    }, [customInstruction, onAction]);

    const handleExpandedCustomSubmit = useCallback(() => {
      const text = customInstruction.trim();
      if (!text) return;
      onAction("complete-text", text);
      setCustomInstruction("");
      setExpanded(false);
    }, [customInstruction, onAction]);

    const handleAction = useCallback(
      (id: AIAssistantAction, scope?: AIScope) => {
        onAction(id, undefined, scope);
        setCustomInstruction("");
        setExpanded(false);
      },
      [onAction],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSubmitCustom();
        } else if (e.key === "Escape") {
          if (customInstruction.trim()) {
            setCustomInstruction("");
          } else if (expanded) {
            setExpanded(false);
          } else {
            onClose?.();
          }
        }
      },
      [customInstruction, expanded, handleSubmitCustom, onClose],
    );

    const handleExpandedKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleExpandedCustomSubmit();
        } else if (e.key === "Escape") {
          if (customInstruction.trim()) {
            setCustomInstruction("");
          } else {
            setExpanded(false);
          }
        }
      },
      [customInstruction, handleExpandedCustomSubmit],
    );

    // Clamp position so the toolbar stays inside the editor container.
    const clampPosition = (left: number, top: number): { left: number; top: number } => {
      const containerEl = containerRef?.current;
      if (!containerEl || !toolbarRef.current) return { left, top };

      const containerRect = containerEl.getBoundingClientRect();
      const toolbarWidth = toolbarRef.current.offsetWidth;
      const toolbarHeight = toolbarRef.current.offsetHeight;
      const padding = 8;

      let clampedLeft = left;
      let clampedTop = top;

      // Horizontal clamping
      if (direction === "rtl") {
        clampedLeft = Math.max(
          padding + toolbarWidth / 2,
          Math.min(clampedLeft, containerRect.width - padding - toolbarWidth / 2),
        );
      } else {
        clampedLeft = Math.max(
          padding + toolbarWidth / 2,
          Math.min(clampedLeft, containerRect.width - padding - toolbarWidth / 2),
        );
      }

      // Vertical clamping
      clampedTop = Math.max(
        padding,
        Math.min(clampedTop, containerRect.height - toolbarHeight - padding),
      );

      return { left: clampedLeft, top: clampedTop };
    };

    const pos = clampPosition(state.x, state.y);
    const rtlTransform = direction === "rtl" ? "translateX(50%)" : "translateX(-50%)";

    const toolbarContent = (
      <>
        {/* Compact toolbar row */}
        <div
          className={cn("flex items-center gap-0.5 p-1", direction === "rtl" && "flex-row-reverse")}
        >
          {/* Quick action icons (always pass scope explicitly) */}
          {AI_ACTION_DEFS.filter((a) => a.group === "quick").map((action) => (
            <button
              key={`quick-${action.id}`}
              onClick={() => onAction(action.id, undefined, action.scope)}
              disabled={isProcessingAI}
              className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={`${action.label} [${action.scope}]`}
            >
              <action.icon className="w-3.5 h-3.5" />
            </button>
          ))}

          <div className="w-px h-3 bg-minimal-border mx-0.5" />

          {/* Custom instruction input */}
          <input
            ref={inputRef}
            data-testid="ai-custom-instruction"
            type="text"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI…"
            className="w-20 bg-minimal-sidebar/50 border border-minimal-border/50 rounded px-1.5 py-1 text-[10px] text-minimal-text placeholder:text-minimal-muted outline-none focus:border-minimal-accent/50 transition-colors"
            disabled={isProcessingAI}
          />

          {/* More/Less toggle */}
          <button
            onClick={() => setExpanded((prev) => !prev)}
            disabled={isProcessingAI}
            className={cn(
              "p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
              expanded
                ? "bg-minimal-accent/20 text-minimal-accent"
                : "hover:bg-minimal-accent/20 text-minimal-muted hover:text-minimal-accent",
            )}
            title={expanded ? "Collapse AI Actions" : "More AI Actions"}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <MoreHorizontal className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Stop button shown during inline AI streaming */}
          {aiStreaming && (
            <>
              <div className="w-px h-3 bg-minimal-border mx-0.5" />
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-medium text-red-400 hover:bg-minimal-sidebar hover:text-red-300 rounded transition-colors"
                title="Stop AI Generation"
              >
                <Square className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            </>
          )}
        </div>

        {/* Expanded AI tools panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden border-t border-minimal-border"
            >
              <div className="w-72 p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                {/* Editing section */}
                <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest">
                  Editing
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {AI_ACTION_DEFS.filter((a) => a.group === "editing").map((item) => (
                    <button
                      key={`editing-${item.id}`}
                      onClick={() => handleAction(item.id, item.scope)}
                      disabled={isProcessingAI}
                      className="flex items-center gap-1.5 p-1.5 hover:bg-minimal-sidebar rounded-lg text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed group/pop"
                    >
                      <item.icon className="w-3 h-3 text-minimal-accent shrink-0" />
                      <span className="text-[10px] text-minimal-text font-medium leading-tight">
                        {item.label}
                      </span>
                      <span className="ml-auto text-[7px] font-bold text-minimal-muted/50 uppercase tracking-wider shrink-0">
                        [{item.scope}]
                      </span>
                    </button>
                  ))}
                </div>

                {/* Structure section */}
                <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest mt-1">
                  Structure
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {AI_ACTION_DEFS.filter((a) => a.group === "structure").map((item) => (
                    <button
                      key={`structure-${item.id}`}
                      onClick={() => handleAction(item.id, item.scope)}
                      disabled={isProcessingAI}
                      className="flex items-center gap-1.5 p-1.5 hover:bg-minimal-sidebar rounded-lg text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed group/pop"
                    >
                      <item.icon className="w-3 h-3 text-minimal-accent shrink-0" />
                      <span className="text-[10px] text-minimal-text font-medium leading-tight">
                        {item.label}
                      </span>
                      <span className="ml-auto text-[7px] font-bold text-minimal-muted/50 uppercase tracking-wider shrink-0">
                        [{item.scope}]
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom instruction in expanded panel */}
                <div className="mt-2 pt-2 border-t border-minimal-border/30">
                  <div className="flex items-center gap-1.5 bg-minimal-sidebar border border-minimal-border rounded-lg px-2 py-1">
                    <input
                      ref={expandedInputRef}
                      data-testid="ai-custom-instruction-expanded"
                      type="text"
                      value={customInstruction}
                      onChange={(e) => setCustomInstruction(e.target.value)}
                      onKeyDown={handleExpandedKeyDown}
                      placeholder="Custom instruction…"
                      className="flex-1 bg-transparent text-[10px] text-minimal-text placeholder:text-minimal-muted outline-none"
                      disabled={isProcessingAI}
                    />
                    {customInstruction.trim() && (
                      <button
                        onClick={handleExpandedCustomSubmit}
                        disabled={isProcessingAI}
                        className="p-1 text-minimal-accent hover:bg-minimal-accent/10 rounded transition-colors disabled:opacity-40"
                        title="Run custom instruction"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );

    // Embedded mode: render just the content (for use inside a bubble menu).
    if (embedded) {
      return (
        <div
          ref={toolbarRef}
          className={cn(
            "flex flex-col items-stretch bg-minimal-bg border border-minimal-border rounded-xl shadow-2xl backdrop-blur-xl ring-1 ring-minimal-border",
            direction === "rtl" && "[&>*]:flex-row-reverse",
          )}
        >
          {toolbarContent}
        </div>
      );
    }

    return (
      <AnimatePresence>
        {state.show && (
          <motion.div
            ref={toolbarRef}
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -5 }}
            style={{
              position: "absolute",
              left: pos.left,
              top: pos.top,
              transform: rtlTransform,
            }}
            className={cn(
              "z-[110] flex flex-col items-stretch bg-minimal-bg border border-minimal-border rounded-xl shadow-2xl backdrop-blur-xl ring-1 ring-minimal-border",
              direction === "rtl" && "[&>*]:flex-row-reverse",
            )}
          >
            {toolbarContent}
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
  (prev, next) =>
    prev.state.show === next.state.show &&
    prev.state.x === next.state.x &&
    prev.state.y === next.state.y &&
    prev.state.editorId === next.state.editorId &&
    prev.isProcessingAI === next.isProcessingAI &&
    prev.aiStreaming === next.aiStreaming &&
    prev.onAction === next.onAction &&
    prev.onStop === next.onStop &&
    prev.onClose === next.onClose &&
    prev.direction === next.direction &&
    prev.embedded === next.embedded,
);
