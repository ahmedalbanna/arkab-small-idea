import React from "react";
import { Keyboard, X } from "lucide-react";
import { ModalSlot } from "../layout/ModalSlot";

interface ShortcutsHelpProps {
  showShortcuts: boolean;
  setShowShortcuts: (val: boolean) => void;
}

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({
  showShortcuts,
  setShowShortcuts,
}) => {
  return (
    <ModalSlot
      isOpen={showShortcuts}
      onClose={() => setShowShortcuts(false)}
      hideCloseButton={true}
      maxWidth="max-w-lg"
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-minimal-border flex items-center justify-between bg-minimal-sidebar/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-minimal-accent/10 flex items-center justify-center text-minimal-accent">
              <Keyboard className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-minimal-text uppercase tracking-widest">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={() => setShowShortcuts(false)}
            className="p-2 hover:bg-minimal-border rounded-full transition-colors"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4 text-minimal-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-0">
          {/* Editor Formatting */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">
              Formatting
            </h4>
            <div className="space-y-1.5">
              {[
                { keys: "Ctrl + B", desc: "Bold" },
                { keys: "Ctrl + I", desc: "Italic" },
                { keys: "Ctrl + K", desc: "Insert Link" },
                { keys: "Ctrl + `", desc: "Inline Code" },
                { keys: "Ctrl + Z", desc: "Undo" },
                { keys: "Ctrl + Shift + Z", desc: "Redo" },
              ].map((s) => (
                <div
                  key={s.keys}
                  className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-minimal-sidebar/50 transition-colors"
                >
                  <span className="text-xs font-medium text-minimal-text">{s.desc}</span>
                  <kbd className="text-[10px] font-bold text-minimal-accent bg-minimal-accent/10 border border-minimal-accent/20 px-2.5 py-1 rounded-lg tracking-wide">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* Navigation & Modes */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">
              Navigation & Modes
            </h4>
            <div className="space-y-1.5">
              {[
                { keys: "Ctrl + F", desc: "Find & Replace" },

                { keys: "Ctrl + /", desc: "Show Shortcuts (this dialog)" },
              ].map((s) => (
                <div
                  key={s.keys + s.desc}
                  className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-minimal-sidebar/50 transition-colors"
                >
                  <span className="text-xs font-medium text-minimal-text">{s.desc}</span>
                  <kbd className="text-[10px] font-bold text-minimal-accent bg-minimal-accent/10 border border-minimal-accent/20 px-2.5 py-1 rounded-lg tracking-wide">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* AI & Editor */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">
              AI & Commands
            </h4>
            <div className="space-y-1.5">
              {[
                { keys: "/", desc: "Slash Commands (in editor)" },
                { keys: "Ctrl + Enter", desc: "Send AI Chat Message" },
              ].map((s) => (
                <div
                  key={s.keys + s.desc}
                  className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-minimal-sidebar/50 transition-colors"
                >
                  <span className="text-xs font-medium text-minimal-text">{s.desc}</span>
                  <kbd className="text-[10px] font-bold text-minimal-accent bg-minimal-accent/10 border border-minimal-accent/20 px-2.5 py-1 rounded-lg tracking-wide">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-4 bg-minimal-sidebar/30 border-t border-minimal-border text-center shrink-0">
          <p className="text-[8px] font-bold text-minimal-muted uppercase tracking-[0.2em]">
            Press Ctrl + / to toggle this dialog
          </p>
        </div>
      </div>
    </ModalSlot>
  );
};
