import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { List, X, ChevronRight, Hash } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useEditorStore } from '../../stores/editorStore';
import { type EditorRef } from '../ProseMirrorEditor';
import { cn } from '../../lib/utils';

interface TableOfContentsProps {
  editorRef: React.RefObject<EditorRef>;
}

interface HeadingInfo {
  text: string;
  level: number;
  pos: number;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ editorRef }) => {
  const { showTOC, setTOC } = useUIStore();
  const { activeFocusedPageId } = useEditorStore();
  const [headings, setHeadings] = useState<HeadingInfo[]>([]);

  const refreshHeadings = useCallback(() => {
    if (editorRef.current) {
      const h = editorRef.current.getHeadings();
      setHeadings(h);
    }
  }, [editorRef]);

  useEffect(() => {
    if (showTOC) {
      refreshHeadings();
    }
  }, [showTOC, refreshHeadings, activeFocusedPageId]);

  // Optionally, listen to content changes to update TOC in real-time
  // For simplicity, we just refresh when TOC is opened or page changes

  const scrollToHeading = (pos: number) => {
    if (editorRef.current) {
      // We can use transform to get the DOM node or just focus and scroll
      // Actually ProseMirror handles scrolling better if we set selection
      // But we can implement a custom scroll if needed.
      // For now, let's just use the scrollToText if available or implement pos-based scroll in ProseMirrorEditor
      // I'll add a scrollToPos to EditorRef as well for better precision.
      (editorRef.current as any).scrollToPos?.(pos);
      // If scrollToPos is not there yet, let's add it. 
    }
  };

  if (!showTOC) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="fixed top-24 right-6 w-64 bg-minimal-sidebar/90 backdrop-blur-xl border border-minimal-border rounded-2xl shadow-2xl z-40 flex flex-col max-h-[70vh]"
      >
        <div className="p-4 border-b border-minimal-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-minimal-accent">
            <List size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Outline</span>
          </div>
          <button 
            onClick={() => setTOC(false)}
            className="p-1 hover:bg-minimal-border rounded-lg transition-colors text-minimal-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {headings.length === 0 ? (
            <div className="p-8 text-center text-xs text-minimal-muted italic">
              No headings found in this document.
            </div>
          ) : (
            headings.map((heading, idx) => (
              <button
                key={`${idx}-${heading.pos}`}
                onClick={() => scrollToHeading(heading.pos)}
                className={cn(
                  "w-full text-left p-2 rounded-lg hover:bg-minimal-accent/5 transition-all group flex items-start gap-2",
                  "border border-transparent hover:border-minimal-accent/10"
                )}
              >
                <div 
                  className="mt-1 flex-shrink-0 text-minimal-muted group-hover:text-minimal-accent transition-colors"
                  style={{ marginLeft: `${(heading.level - 1) * 12}px` }}
                >
                  <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
                <span className={cn(
                  "text-[11px] leading-tight transition-colors",
                  heading.level === 1 ? "font-bold text-minimal-text" : "text-minimal-muted group-hover:text-minimal-text",
                )}>
                  {heading.text || "Untitled Section"}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="p-3 bg-minimal-sidebar/50 border-t border-minimal-border">
          <button 
            onClick={refreshHeadings}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-wider text-minimal-muted hover:text-minimal-accent transition-colors flex items-center justify-center gap-2"
          >
            <Hash size={12} />
            Refresh Outline
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TableOfContents;
