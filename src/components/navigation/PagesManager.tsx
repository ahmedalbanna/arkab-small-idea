import React from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Plus, X, Trash2, GripVertical } from 'lucide-react';
import { cn, useMediaQuery } from '../../lib/utils';
import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';

export const PagesManager: React.FC = () => {
  const { showPages, setPagesMenu } = useUIStore();
  const { pages, activePageIds, activeFocusedPageId, addPage, removePage, togglePageOpen, setActiveFocusedPageId, reorderPages } = useEditorStore();
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <AnimatePresence>
      {showPages && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          className={cn(
            "fixed inset-y-0 right-0 z-[120] shadow-2xl bg-minimal-sidebar border-l border-minimal-border flex flex-col",
            isMobile ? "w-full" : "w-[320px]"
          )}
        >
          <div className="h-full flex flex-col p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-minimal-text uppercase tracking-widest">Chapters & Pages</h3>
              <button onClick={() => setPagesMenu(false)} className="p-2 hover:bg-minimal-border rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <button 
              onClick={() => addPage('New Chapter')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-minimal-accent text-white rounded-2xl text-[10px] font-bold shadow-lg shadow-minimal-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>ADD CHAPTER</span>
            </button>

            <Reorder.Group 
              axis="y" 
              values={pages} 
              onReorder={reorderPages}
              as="div"
              className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1"
            >
              {pages.map((page, index) => (
                <Reorder.Item 
                  key={page.id}
                  value={page}
                  as="div"
                  className={cn(
                    "group flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer",
                    activeFocusedPageId === page.id
                      ? "bg-minimal-accent/10 border-minimal-accent ring-2 ring-minimal-accent/10"
                      : activePageIds.includes(page.id) 
                        ? "bg-minimal-accent/5 border-minimal-accent/20" 
                        : "bg-minimal-bg border-minimal-border hover:border-minimal-accent/30"
                  )}
                  onClick={() => {
                    if (!activePageIds.includes(page.id)) {
                      togglePageOpen(page.id);
                    }
                    setActiveFocusedPageId(page.id);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-minimal-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold shrink-0",
                      activePageIds.includes(page.id) ? "bg-minimal-accent text-white" : "bg-minimal-sidebar text-minimal-muted"
                    )}>
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-minimal-text truncate">{page.title}</p>
                      <p className="text-[9px] text-minimal-muted uppercase tracking-tight">{page.content.split(/\s+/).filter(Boolean).length} words</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removePage(page.id); }}
                    className="p-1.5 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
