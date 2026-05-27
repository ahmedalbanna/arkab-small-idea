import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bold, Italic, Heading2, Link as LinkIcon, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

interface MobileToolbarProps {
  editorRef: React.RefObject<any>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  insertText: (before: string, after: string) => void;
}

export const MobileToolbar: React.FC<MobileToolbarProps> = ({
  editorRef,
  fileInputRef,
  insertText
}) => {
  const { setAIAssistant } = useUIStore();

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-0 inset-x-0 bg-minimal-bg/90 backdrop-blur border-t border-minimal-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[100] pb-safe"
    >
      <div className="flex items-center justify-around p-3 pb-6 md:pb-3">
        <button onClick={() => editorRef.current?.handleFormat('bold')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors"><Bold className="w-5 h-5" /></button>
        <button onClick={() => editorRef.current?.handleFormat('italic')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors"><Italic className="w-5 h-5" /></button>
        <button onClick={() => editorRef.current?.handleFormat('h2')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors"><Heading2 className="w-5 h-5" /></button>
        <button onClick={() => insertText('[', '](url)')} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors"><LinkIcon className="w-5 h-5" /></button>
        <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-minimal-sidebar rounded-xl text-minimal-muted hover:text-minimal-text transition-colors"><ImageIcon className="w-5 h-5" /></button>
        <div className="w-px h-8 bg-minimal-border mx-1" />
        <button onClick={() => setAIAssistant(true)} className="p-3 bg-minimal-accent/10 rounded-xl text-minimal-accent transition-colors"><Sparkles className="w-5 h-5" /></button>
      </div>
    </motion.div>
  );
};
