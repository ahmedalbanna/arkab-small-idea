import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Wand2,
  Layout,
  FileText,
  Heading1,
  Heading2,
  List,
  Quote,
  Code,
  Image as ImageIcon,
  CheckCheck,
  Zap,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layout as JustifyIcon,
  PenTool,
  Table
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { EditorCommand } from '../plugins/types';

interface SlashMenuItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  action: string;
}

const ITEMS: SlashMenuItem[] = [
  { id: 'h1', label: 'Heading 1', description: 'Large section heading', icon: Heading1, action: 'h1' },
  { id: 'h2', label: 'Heading 2', description: 'Medium section heading', icon: Heading2, action: 'h2' },
  { id: 'align-left', label: 'Align Left', description: 'Left aligned text', icon: AlignLeft, action: 'align-left' },
  { id: 'align-center', label: 'Align Center', description: 'Centered text', icon: AlignCenter, action: 'align-center' },
  { id: 'align-right', label: 'Align Right', description: 'Right aligned text', icon: AlignRight, action: 'align-right' },
  { id: 'align-justify', label: 'Justify', description: 'Full width text', icon: JustifyIcon, action: 'align-justify' },
  { id: 'bullet', label: 'Bullet List', description: 'Simple bulleted list', icon: List, action: 'bullet' },
  { id: 'todo-h', label: 'High Priority Task', description: '- [ ] (H) Urgent items', icon: CheckCheck, action: 'todo-high' },
  { id: 'todo-m', label: 'Medium Priority Task', description: '- [ ] (M) Normal items', icon: CheckCheck, action: 'todo-medium' },
  { id: 'todo-l', label: 'Low Priority Task', description: '- [ ] (L) Optional items', icon: CheckCheck, action: 'todo-low' },
  { id: 'quote', label: 'Quote', description: 'Emphasize as evaluation or reference', icon: Quote, action: 'quote' },
  { id: 'code', label: 'Code Block', description: 'Code with syntax highlighting', icon: Code, action: 'code' },
  { id: 'image', label: 'Image', description: 'Insert or upload an image', icon: ImageIcon, action: 'image' },
  { id: 'scribble', label: 'Scribble', description: 'Draw with finger or pen', icon: PenTool, action: 'scribble' },
  { id: 'gallery', label: 'Gallery', description: 'Create an image gallery', icon: Layout, action: 'gallery' },
  { id: 'tableify', label: 'Convert to Table', description: 'Convert paragraphs to table', icon: Table, action: 'tableify' },
  { id: 'ai-improve', label: 'AI Improve', description: 'Rewrite the paragraph', icon: Wand2, action: 'ai-improve' },
  { id: 'ai-outline', label: 'AI Outline', description: 'Generate structure', icon: Layout, action: 'ai-outline' },
  { id: 'ai-summarize', label: 'AI Summarize', description: 'Sum up selection', icon: FileText, action: 'summarize' },
  { id: 'ai-rewrite', label: 'AI Rewrite', description: 'Rephrase selection', icon: RotateCcw, action: 'rewrite' },
  { id: 'ai-complete', label: 'AI Auto-complete', description: 'Continue writing', icon: Zap, action: 'complete-text' },
];

/** A unified menu entry: either a built-in action or a plugin-contributed command. */
type MenuEntry = {
  id: string;
  label: string;
  description: string;
  icon: any;
  onChoose: () => void;
};

interface Props {
  x: number;
  y: number;
  query?: string;
  isAbsolute?: boolean;
  /** Plugin commands that opted into the slash menu. */
  pluginCommands?: EditorCommand[];
  onSelect: (action: string) => void;
  /** Called when a plugin command entry is chosen. */
  onPluginCommand?: (cmd: EditorCommand) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<Props> = ({
  x,
  y,
  query = '',
  isAbsolute = false,
  pluginCommands = [],
  onSelect,
  onPluginCommand,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const entries: MenuEntry[] = [
    ...ITEMS.map((it) => ({
      id: it.id,
      label: it.label,
      description: it.description,
      icon: it.icon,
      onChoose: () => onSelect(it.action),
    })),
    ...pluginCommands
      .filter((c) => c.slash)
      .map((c) => ({
        id: c.id,
        label: c.label ?? c.id,
        description: c.label ? 'Plugin command' : c.id,
        icon: Wand2,
        onChoose: () => onPluginCommand?.(c),
      })),
  ];

  const filteredItems = entries.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filteredItems[selectedIndex].onChoose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedIndex, onClose, filteredItems]);

  if (filteredItems.length === 0) return null;

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      style={{
        position: isAbsolute ? 'absolute' : 'fixed',
        left: x,
        top: y,
      }}
      className="z-[200] w-64 bg-minimal-bg border border-minimal-border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden"
    >
      <div className="p-2 border-b border-minimal-border bg-minimal-sidebar/50">
        <span className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest px-2">Actions</span>
      </div>
      <div className="max-h-80 overflow-y-auto p-1 custom-scrollbar">
        {filteredItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => item.onChoose()}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left",
              index === selectedIndex ? "bg-minimal-accent text-white shadow-lg shadow-minimal-accent/20" : "hover:bg-minimal-sidebar"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg",
              index === selectedIndex ? "bg-white/20" : "bg-minimal-sidebar border border-minimal-border"
            )}>
              <item.icon className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold truncate">{item.label}</span>
              <span className={cn(
                "text-[10px] truncate",
                index === selectedIndex ? "text-white/70" : "text-minimal-muted"
              )}>{item.description}</span>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};
