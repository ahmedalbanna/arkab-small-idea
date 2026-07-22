import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Square, Check, Plus, RefreshCcw, X as XIcon } from "lucide-react";

interface AIStreamOverlayState {
  y: number;
  isStreaming: boolean;
  showActions: boolean;
  customInstruction?: string;
  abortController?: AbortController;
}

interface Props {
  aiDraft: AIStreamOverlayState | null;
  onDecision: (decision: "replace" | "append" | "retry" | "cancel") => void;
  onStop: () => void;
}

export function AIStreamOverlay({ aiDraft, onDecision, onStop }: Props) {
  if (!aiDraft) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        style={{
          position: "absolute",
          left: "2rem",
          top: aiDraft.y,
        }}
        className="z-[150] flex flex-col items-start gap-2 max-w-full"
      >
        {aiDraft.isStreaming ? (
          <div className="flex items-center gap-2 bg-minimal-bg border border-minimal-accent/50 rounded-xl p-1.5 shadow-xl backdrop-blur-xl ring-1 ring-minimal-accent/20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-minimal-accent" />
            </motion.div>
            <span className="text-xs font-semibold text-minimal-accent pe-2">AI is Writing...</span>
            {aiDraft.customInstruction && (
              <>
                <div className="w-px h-3 bg-minimal-border" />
                <span className="text-[9px] font-medium text-minimal-muted whitespace-nowrap truncate max-w-[150px]">
                  Custom: {aiDraft.customInstruction}
                </span>
              </>
            )}
            <div className="w-px h-3 bg-minimal-border" />
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-400 hover:bg-minimal-sidebar hover:text-red-300 rounded"
              title="Stop AI Generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Stop
            </button>
          </div>
        ) : aiDraft.showActions ? (
          <div className="flex items-center gap-1 bg-minimal-bg border border-minimal-border rounded-xl p-1 shadow-2xl backdrop-blur-xl ring-1 ring-minimal-border">
            {aiDraft.customInstruction && (
              <>
                <span className="text-[9px] font-medium text-minimal-muted px-1.5 whitespace-nowrap truncate max-w-[150px]">
                  Custom: {aiDraft.customInstruction}
                </span>
                <div className="w-px h-3 bg-minimal-border" />
              </>
            )}
            <button
              onClick={() => onDecision("replace")}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-emerald-400 hover:bg-minimal-sidebar hover:text-emerald-300 rounded"
            >
              <Check className="w-3.5 h-3.5" /> Approve & Replace
            </button>
            <div className="w-px h-4 bg-minimal-border" />
            <button
              onClick={() => onDecision("append")}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-minimal-accent hover:bg-minimal-sidebar hover:text-minimal-accent-hover rounded"
            >
              <Plus className="w-3.5 h-3.5" /> Append Below
            </button>
            <div className="w-px h-4 bg-minimal-border" />
            <button
              onClick={() => onDecision("retry")}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-minimal-text hover:bg-minimal-sidebar hover:text-minimal-text rounded"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Regenerate
            </button>
            <div className="w-px h-4 bg-minimal-border" />
            <button
              onClick={() => onDecision("cancel")}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-minimal-sidebar hover:text-red-300 rounded"
            >
              <XIcon className="w-3.5 h-3.5" /> Discard
            </button>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
