import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, GripVertical, Link, Check } from "lucide-react";
import { cn, slugify } from "../../../lib/utils";
import type { SideMenuState, BubbleMenuState } from "../../../stores/aiUIStore";
import type { EditorView } from "prosemirror-view";

interface Props {
  sideMenu: SideMenuState;
  bubbleMenu: BubbleMenuState;
  editorId: string;
  viewRef: React.RefObject<EditorView | null>;
  onOpenSlash: (pos: number) => void;
}

export function SideMenuOverlay({ sideMenu, bubbleMenu, editorId, viewRef, onOpenSlash }: Props) {
  const [isCopied, setIsCopied] = useState(false);

  if (
    !sideMenu.show ||
    sideMenu.editorId !== editorId ||
    (bubbleMenu.editorId === editorId && bubbleMenu.show)
  )
    return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        style={{
          position: "absolute",
          left: "-2rem",
          top: sideMenu.y,
        }}
        className="z-[50] flex items-center gap-0.5 group"
      >
        <button
          onClick={() => onOpenSlash(sideMenu.pos)}
          className="p-1.5 hover:bg-minimal-accent/10 text-minimal-muted/40 hover:text-minimal-accent rounded-lg transition-all cursor-pointer bg-minimal-bg/50 backdrop-blur"
          title="Add Block"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <div className="p-1.5 text-minimal-muted/20 cursor-grab hover:text-minimal-muted transition-colors">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        {sideMenu.nodeName === "heading" && (
          <>
            <div className="w-px h-4 bg-minimal-border mx-0.5" />
            <button
              onClick={() => {
                if (!viewRef.current) return;
                const node = viewRef.current.state.doc.nodeAt(sideMenu.pos);
                if (node && node.type.name === "heading") {
                  const slug = slugify(node.textContent);
                  const url = new URL(window.location.href);
                  url.hash = slug;
                  navigator.clipboard.writeText(url.toString());
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }
              }}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer bg-minimal-bg/50 backdrop-blur border border-transparent",
                isCopied
                  ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20"
                  : "text-minimal-muted/40 hover:text-minimal-accent hover:bg-minimal-accent/10",
              )}
              title={isCopied ? "Copied!" : "Copy Anchor Link"}
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
