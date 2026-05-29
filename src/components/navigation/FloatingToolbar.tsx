import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, FileText, Cpu, Search, FolderRoot, Type, Target, Settings, Trash2, Languages, Zap, Command, Headset, List } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/uiStore';

interface FloatingToolbarProps {
  direction: 'ltr' | 'rtl';
  setDirection: (dir: 'ltr' | 'rtl' | ((prev: 'ltr' | 'rtl') => 'ltr' | 'rtl')) => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  direction,
  setDirection
}) => {
  const {
    showAIAssistant, setAIAssistant,
    showPages, setPagesMenu,
    showAiSettings, setAiSettings,
    showSearch, setSearch,
    showSemanticFolders, setSemanticFolders,
    showSettings, setSettings,
    showQuickCommands, setQuickCommands,
    showTTS, setTTS,
    showTOC, setTOC
  } = useUIStore();

  return (
    <div className="fixed top-8 right-8 z-[60] flex flex-col gap-3">
      {[
        { id: 'ai', icon: Sparkles, active: showAIAssistant, action: () => setAIAssistant(!showAIAssistant), title: 'AI Assistant' },
        { id: 'tts', icon: Headset, active: showTTS, action: () => setTTS(!showTTS), title: 'Text to Speech' },
        { id: 'toc', icon: List, active: showTOC, action: () => setTOC(!showTOC), title: 'Table of Contents' },
        { id: 'pages', icon: FileText, active: showPages, action: () => setPagesMenu(!showPages), title: 'Pages Manager' },
        { id: 'cpu', icon: Cpu, active: showAiSettings, action: () => setAiSettings(!showAiSettings), title: 'AI Provider Settings' },
        { id: 'search', icon: Search, active: showSearch, action: () => setSearch(!showSearch), title: 'Find & Replace' },
        { id: 'commands', icon: Command, active: showQuickCommands, action: () => setQuickCommands(!showQuickCommands), title: 'Toggle Quick Commands Menu' },
        { id: 'divider1', type: 'divider' },
        { id: 'semantic', icon: FolderRoot, active: showSemanticFolders, action: () => setSemanticFolders(!showSemanticFolders), title: 'Semantic Folders' },
        { id: 'lang', icon: Languages, active: false, action: () => setDirection(prev => prev === 'ltr' ? 'rtl' : 'ltr'), title: `Switch to ${direction === 'ltr' ? 'RTL' : 'LTR'}` },
        { id: 'divider2', type: 'divider' },
        { id: 'settings', icon: Settings, active: showSettings, action: () => setSettings(!showSettings), title: 'Global Settings' },
      ].map((item, idx) => {
        if (item.type === 'divider') return <div key={item.id} className="h-px bg-minimal-border/30 mx-3 my-1" />;
        
        const Icon = item.icon;
        return (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: item.active ? 1 : 0.6, x: 0, scale: 1 }}
            whileHover={{ opacity: 1, scale: 1.1, x: -4 }}
            whileTap={{ scale: 0.95 }}
            transition={{ delay: idx * 0.05, duration: 0.3, ease: "easeOut" }}
            onClick={item.action}
            className={cn(
              "p-3.5 backdrop-blur-md border rounded-full shadow-lg transition-all duration-300",
              item.active 
                ? "bg-minimal-accent border-minimal-accent text-white ring-4 ring-minimal-accent/20" 
                : "bg-minimal-bg/80 border-minimal-border text-minimal-muted hover:border-minimal-accent/40 hover:text-minimal-text"
            )}
            title={item.title}
          >
            <Icon className="w-5 h-5" />
          </motion.button>
        );
      })}
    </div>
  );
};
