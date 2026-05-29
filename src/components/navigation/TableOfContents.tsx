import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { List, X, ChevronRight, Hash, Filter } from 'lucide-react';
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
  const [maxLevel, setMaxLevel] = useState(6);

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

  const filteredHeadings = headings.filter(h => h.level <= maxLevel);

  const scrollToHeading = (pos: number) => {
    if (editorRef.current) {
      (editorRef.current as any).scrollToPos?.(pos);
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
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setMaxLevel(maxLevel === 6 ? 3 : 6)}
              className={cn(
                "p-1.5 rounded-lg transition-all text-minimal-muted hover:bg-minimal-border/50",
                maxLevel < 6 && "text-minimal-accent bg-minimal-accent/10"
              )}
              title={maxLevel === 6 ? "Show H1-H3 only" : "Show all levels"}
            >
              <Filter size={14} className={cn(maxLevel < 6 && "fill-current")} />
            </button>
            <button 
              onClick={() => setTOC(false)}
              className="p-1.5 hover:bg-minimal-border/50 rounded-lg transition-colors text-minimal-muted"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {filteredHeadings.length === 0 ? (
            <div className="p-8 text-center text-xs text-minimal-muted italic">
              {headings.length > 0 ? "No headings match the current filter." : "No headings found in this document."}
            </div>
          ) : (
            filteredHeadings.map((heading, idx) => (
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
