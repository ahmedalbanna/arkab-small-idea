import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trash2, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

interface MobileMenuProps {}

export const MobileMenu: React.FC<MobileMenuProps> = () => {
  const { showMobileMenu, setMobileMenu, setAIAssistant } = useUIStore();

  return (
    <AnimatePresence>
      {showMobileMenu && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenu(false)}
            className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm z-[80]"
          />
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="fixed top-0 start-0 bottom-0 w-[280px] bg-minimal-bg border-e border-minimal-border z-[90] shadow-2xl flex flex-col"
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
