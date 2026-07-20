import React from 'react';
import { motion } from 'motion/react';
import { Bold, Italic, Heading2, Link as LinkIcon, Image as ImageIcon, Sparkles, PenTool, Quote, List, Table } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useEditorStore } from '../../stores/editorStore';
import { getEditorRef } from '../../plugins/editorAccess';
import { insertText } from '../../plugins/ai/handlers';
import type { PluginContext, ToolbarItem } from '../../plugins/types';
import { cn } from '../../lib/utils';

interface MobileToolbarProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  /** Plugin-contributed toolbar buttons. */
  toolbarItems?: ToolbarItem[];
  /** The resolved plugin context, passed to `ToolbarItem.onClick`. */
  pluginContext?: PluginContext | null;
}

export const MobileToolbar: React.FC<MobileToolbarProps> = ({
  fileInputRef,
  toolbarItems = [],
  pluginContext = null,
}) => {
  const { setAIAssistant, setTTS, showTTS } = useUIStore();
  const { activeFocusedPageId, pages } = useEditorStore();
  const activePage = pages.find((p) => p.id === activeFocusedPageId) || pages[0];
  const editorRef: any = {
    current: activePage ? getEditorRef(activePage.id) : null,
  };

  const pluginButtons = toolbarItems.filter((t) => (t.show ? t.show() : true));

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-0 inset-x-0 bg-minimal-bg/90 backdrop-blur border-t border-minimal-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[100] pb-safe"
    >
      <div className="flex items-center justify-around p-3 pb-6 md:pb-3 overflow-x-auto custom-scrollbar no-scrollbar scroll-smooth gap-1">
        <button onClick={() => editorRef.current?.handleFormat('bold')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><Bold className="w-5 h-5" /></button>
        <button onClick={() => editorRef.current?.handleFormat('italic')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><Italic className="w-5 h-5" /></button>
        <button onClick={() => editorRef.current?.handleFormat('quote')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><Quote className="w-5 h-5" /></button>
        <button onClick={() => editorRef.current?.handleFormat('tableify')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><Table className="w-5 h-5" /></button>
        <button onClick={() => editorRef.current?.handleFormat('bullet')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><List className="w-5 h-5" /></button>
        <button onClick={() => editorRef.current?.handleFormat('h2')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><Heading2 className="w-5 h-5" /></button>
        <button onClick={() => insertText('[', '](url)')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><LinkIcon className="w-5 h-5" /></button>
        <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><ImageIcon className="w-5 h-5" /></button>
        <button onClick={() => editorRef.current?.insertScribble()} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors shrink-0"><PenTool className="w-5 h-5" /></button>
        <div className="w-px h-8 bg-minimal-border mx-1 shrink-0" />
        <button onClick={() => setAIAssistant(true)} className="p-3 bg-minimal-accent/10 rounded-xl text-minimal-accent transition-colors shrink-0"><Sparkles className="w-5 h-5" /></button>
        {pluginButtons.map((item) => {
          const Icon = item.icon;
          const active = item.isActive ? item.isActive() : false;
          return (
            <button
              key={item.id}
              onClick={() => item.onClick(pluginContext as PluginContext)}
              title={item.label}
              className={cn(
                "p-3 rounded-xl transition-colors shrink-0",
                active
                  ? "bg-minimal-accent/20 text-minimal-accent"
                  : "bg-minimal-sidebar text-minimal-muted hover:text-minimal-text"
              )}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};
