import { motion, AnimatePresence } from "motion/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Zap,
  CheckCheck,
  FileText,
  ArrowRight,
  Copy,
  Scissors,
} from "lucide-react";
import type { Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import type { ContextMenuState } from "../../../stores/aiUIStore";
import { editorSerializer } from "../hooks/useMarkdownSerializer";

interface Props {
  contextMenu: ContextMenuState;
  onClose: () => void;
  handleFormat: (type: string) => void;
  handleAIAction: (action: string) => void;
  viewRef: React.RefObject<EditorView | null>;
  editorSchema: Schema | null;
}

export function ContextMenu({
  contextMenu,
  onClose,
  handleFormat,
  handleAIAction,
  viewRef,
  editorSchema,
}: Props) {
  if (!contextMenu.show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: "absolute",
          left: contextMenu.x,
          top: contextMenu.y,
        }}
        className="z-[200] w-56 bg-minimal-bg border border-minimal-border rounded-xl shadow-2xl p-2 flex flex-col gap-1 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest bg-minimal-sidebar rounded-t-lg mb-1">
            Editing
          </div>
          {(
            [
              { id: "bold", label: "Bold", icon: Bold },
              { id: "italic", label: "Italic", icon: Italic },
              { id: "underline", label: "Underline", icon: Underline },
              { id: "strike", label: "Strikethrough", icon: Strikethrough },
              { id: "code", label: "Code Block", icon: Code },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                handleFormat(item.id);
                onClose();
              }}
              className="flex items-center gap-2 p-1.5 hover:bg-minimal-sidebar rounded-lg text-left transition-colors text-minimal-text"
            >
              <item.icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}

          <div className="h-px bg-minimal-border my-1 mx-1" />

          <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest bg-minimal-sidebar mb-1">
            AI Power
          </div>
          {(
            [
              { id: "improve", label: "Refine & Improve", icon: Zap },
              { id: "fix-grammar", label: "Fix Errors", icon: CheckCheck },
              { id: "summarize", label: "Summarize", icon: FileText },
              { id: "complete-text", label: "Continue Writing", icon: ArrowRight },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                handleAIAction(item.id);
                onClose();
              }}
              className="flex items-center gap-2 p-1.5 hover:bg-minimal-accent/20 rounded-lg text-left transition-colors text-minimal-text"
            >
              <item.icon className="w-3.5 h-3.5 text-minimal-accent" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}

          <div className="h-px bg-minimal-border my-1 mx-1" />

          <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest bg-minimal-sidebar mb-1">
            Clipboard
          </div>
          {(
            [
              {
                id: "copy",
                label: "Copy as Markdown",
                icon: Copy,
                action: () => {
                  if (viewRef.current && editorSchema) {
                    const { state } = viewRef.current;
                    const { from, to } = state.selection;
                    const slice = state.selection.content();
                    const markdown = editorSerializer.serialize(
                      editorSchema.nodes.doc.create(null, slice.content) as any,
                    );
                    const plainText = state.doc.textBetween(from, to, " ");

                    if (navigator.clipboard && navigator.clipboard.write) {
                      const textBlob = new Blob([plainText], { type: "text/plain" });
                      const markdownBlob = new Blob([markdown], { type: "text/markdown" });

                      try {
                        navigator.clipboard.write([
                          new ClipboardItem({
                            "text/plain": textBlob,
                            "text/markdown": markdownBlob,
                          }),
                        ]);
                      } catch {
                        navigator.clipboard.writeText(markdown || plainText);
                      }
                    } else {
                      navigator.clipboard.writeText(markdown || plainText);
                    }
                  }
                },
              },
              {
                id: "cut",
                label: "Cut text",
                icon: Scissors,
                action: () => {
                  if (viewRef.current && editorSchema) {
                    const { state, dispatch } = viewRef.current;
                    const slice = state.selection.content();
                    const markdown = editorSerializer.serialize(
                      editorSchema.nodes.doc.create(null, slice.content) as any,
                    );

                    navigator.clipboard.writeText(markdown);
                    dispatch(state.tr.deleteSelection());
                  }
                },
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.action();
                onClose();
              }}
              className="flex items-center gap-2 p-1.5 hover:bg-minimal-border rounded-lg text-left transition-colors text-minimal-muted hover:text-minimal-text"
            >
              <item.icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
