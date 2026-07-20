import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { cn, useMediaQuery } from '../../lib/utils';

interface MobileMenuProps { }

export const MobileMenu: React.FC<MobileMenuProps> = () => {
  const { showMobileMenu, setMobileMenu, setAIAssistant, direction } = useUIStore();
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <AnimatePresence>
      {showMobileMenu && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenu(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[120]"
          />
          <motion.div
            initial={{ x: direction === 'rtl' ? 300 : -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction === 'rtl' ? 300 : -300, opacity: 0 }}
            className={cn(
              "fixed top-0 bottom-0 bg-minimal-bg z-[130] shadow-2xl flex flex-col transition-all duration-300",
              direction === 'rtl' ? "right-0 border-s" : "left-0 border-e",
              isMobile ? "w-full" : "w-[300px]",
              "border-minimal-border"
            )}
          >
            <div className="p-4 border-b border-minimal-border flex justify-between items-center bg-minimal-sidebar">
              <span className="text-xs font-bold text-minimal-muted uppercase tracking-widest">Navigation</span>
              <button onClick={() => setMobileMenu(false)} className="p-1 hover:bg-minimal-border rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <button
                onClick={() => { setAIAssistant(true); setMobileMenu(false); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-minimal-accent text-white shadow-lg transition-transform active:scale-95"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-black uppercase tracking-widest">AI Assistant</span>
              </button>


              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-minimal-muted uppercase tracking-wider mb-2">Editor Options</p>
                <div className="px-3 py-2 text-xs text-minimal-muted leading-relaxed">
                  Per-page actions are now available directly in each editor's header.
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
