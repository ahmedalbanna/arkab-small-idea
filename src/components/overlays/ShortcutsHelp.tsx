import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Keyboard, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

interface ShortcutsHelpProps {
  showShortcuts: boolean;
  setShowShortcuts: (val: boolean) => void;
}

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({
  showShortcuts,
  setShowShortcuts
}) => {
  return (
    <AnimatePresence>
      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShortcuts(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-minimal-bg border border-minimal-border rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-minimal-border flex items-center justify-between bg-minimal-sidebar/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-minimal-accent/10 flex items-center justify-center text-minimal-accent">
                  <Keyboard className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-minimal-text uppercase tracking-widest">Keyboard Shortcuts</h3>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="p-2 hover:bg-minimal-border rounded-full transition-colors">
                <X className="w-4 h-4 text-minimal-muted" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Editor Formatting */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Formatting</h4>
                <div className="space-y-1.5">
                  {[
                    { keys: 'Ctrl + B', desc: 'Bold' },
                    { keys: 'Ctrl + I', desc: 'Italic' },
                    { keys: 'Ctrl + K', desc: 'Insert Link' },
                    { keys: 'Ctrl + `', desc: 'Inline Code' },
                    { keys: 'Ctrl + Z', desc: 'Undo' },
                    { keys: 'Ctrl + Shift + Z', desc: 'Redo' },
                  ].map(s => (
                    <div key={s.keys} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-minimal-sidebar/50 transition-colors">
                      <span className="text-xs font-medium text-minimal-text">{s.desc}</span>
                      <kbd className="text-[10px] font-bold text-minimal-accent bg-minimal-accent/10 border border-minimal-accent/20 px-2.5 py-1 rounded-lg tracking-wide">{s.keys}</kbd>
                    </div>
                  ))}
                </div>
              </section>

              {/* Navigation & Modes */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Navigation & Modes</h4>
                <div className="space-y-1.5">
                  {[
                    { keys: 'Ctrl + F', desc: 'Find & Replace' },
                    
                    { keys: 'Ctrl + Shift + T', desc: 'Toggle Typewriter Mode' },
                    { keys: 'Ctrl + /', desc: 'Show Shortcuts (this dialog)' },
                  ].map(s => (
                    <div key={s.keys + s.desc} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-minimal-sidebar/50 transition-colors">
                      <span className="text-xs font-medium text-minimal-text">{s.desc}</span>
                      <kbd className="text-[10px] font-bold text-minimal-accent bg-minimal-accent/10 border border-minimal-accent/20 px-2.5 py-1 rounded-lg tracking-wide">{s.keys}</kbd>
                    </div>
                  ))}
                </div>
              </section>

              {/* AI & Editor */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">AI & Commands</h4>
                <div className="space-y-1.5">
                  {[
                    { keys: '/', desc: 'Slash Commands (in editor)' },
                    { keys: 'Ctrl + Enter', desc: 'Send AI Chat Message' },
                  ].map(s => (
                    <div key={s.keys + s.desc} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-minimal-sidebar/50 transition-colors">
                      <span className="text-xs font-medium text-minimal-text">{s.desc}</span>
                      <kbd className="text-[10px] font-bold text-minimal-accent bg-minimal-accent/10 border border-minimal-accent/20 px-2.5 py-1 rounded-lg tracking-wide">{s.keys}</kbd>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-4 bg-minimal-sidebar/30 border-t border-minimal-border text-center">
              <p className="text-[8px] font-bold text-minimal-muted uppercase tracking-[0.2em]">Press Ctrl + / to toggle this dialog</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
