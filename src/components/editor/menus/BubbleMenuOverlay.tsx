import { motion, AnimatePresence } from "motion/react";
import type { BubbleMenuState } from "../../../stores/aiUIStore";
import { AIFloatingToolbar } from "../AIFloatingToolbar";
import type { EditorView } from "prosemirror-view";
import type { AIAssistantAction } from "../../../services/aiService";
import type { AIScope } from "../hooks/useAIStreaming";

interface Props {
  bubbleMenu: BubbleMenuState;
  editorId: string;
  isProcessingAI: boolean;
  aiStreaming: boolean;
  onAction: (action: AIAssistantAction, customInstruction?: string, scope?: AIScope) => void;
  onStop: () => void;
  onClose: () => void;
  viewRef: React.RefObject<EditorView | null>;
}

export function BubbleMenuOverlay({
  bubbleMenu,
  editorId,
  isProcessingAI,
  aiStreaming,
  onAction,
  onStop,
  onClose,
  viewRef,
}: Props) {
  if (!bubbleMenu.show || bubbleMenu.editorId !== editorId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        style={{
          position: "absolute",
          left: bubbleMenu.x,
          top: bubbleMenu.y,
          transform: "translateX(-50%)",
        }}
        className="z-[100] flex items-center gap-0.5 bg-minimal-bg border border-minimal-border rounded-xl p-1 shadow-2xl backdrop-blur-xl ring-1 ring-minimal-border"
      >
        <AIFloatingToolbar
          state={{ x: 0, y: 0, show: true, editorId }}
          isProcessingAI={isProcessingAI}
          aiStreaming={aiStreaming}
          onAction={onAction}
          onStop={onStop}
          onClose={() => {
            onClose();
            viewRef.current?.focus();
          }}
          embedded
        />
      </motion.div>
    </AnimatePresence>
  );
}
