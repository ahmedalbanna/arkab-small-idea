import React from 'react';
import { Sparkles } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useMediaQuery } from '../../lib/utils';
import { PanelSlot } from '../layout/PanelSlot';

interface MobileMenuProps { }

export const MobileMenu: React.FC<MobileMenuProps> = () => {
  const { showMobileMenu, setMobileMenu, setAIAssistant } = useUIStore();
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <PanelSlot
      isOpen={showMobileMenu}
      onClose={() => setMobileMenu(false)}
      side="start"
      title="Navigation"
      width={isMobile ? "100%" : "300px"}
    >
      <div className="p-4 space-y-4">
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
    </PanelSlot>
  );
};
