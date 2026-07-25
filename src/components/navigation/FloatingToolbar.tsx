import React from "react";
import { motion } from "motion/react";
import { Search, Command, Headset } from "lucide-react";
import { cn } from "../../lib/utils";
import { Z_CLASS } from "../../lib/zIndex";
import { useUIStore } from "../../stores/uiStore";
import { useLayout } from "../layout/LayoutContext";
import type { PluginContext, ToolbarItem } from "../../plugins/types";

interface FloatingToolbarProps {
  direction: "ltr" | "rtl";
  setDirection: (dir: "ltr" | "rtl" | ((prev: "ltr" | "rtl") => "ltr" | "rtl")) => void;
  toolbarItems?: ToolbarItem[];
  pluginContext?: PluginContext | null;
}

function Divider() {
  return <div className="h-px bg-minimal-border/30 mx-3 my-1" />;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  toolbarItems = [],
  pluginContext = null,
}) => {
  const { showSearch, showQuickCommands, setQuickCommands, showTTS, setTTS } = useUIStore();

  const { togglePanel } = useLayout();

  const pluginButtons = toolbarItems.filter((t) => (t.show ? t.show() : true));

  // ── Section 1: Tools ──
  const tools = [
    {
      id: "tts",
      icon: Headset,
      active: showTTS,
      action: () => setTTS(!showTTS),
      title: "Text to Speech",
    },
    {
      id: "search",
      icon: Search,
      active: showSearch,
      action: () => togglePanel("search"),
      title: "Find & Replace",
    },
    {
      id: "commands",
      icon: Command,
      active: showQuickCommands,
      action: () => setQuickCommands(!showQuickCommands),
      title: "Toggle Quick Commands Menu",
    },
  ];

  const renderButton = (
    item: {
      id: string;
      icon: React.ComponentType<{ className?: string }>;
      active: boolean;
      action: () => void;
      title: string;
    },
    idx: number,
  ) => {
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
        aria-label={item.title}
        className={cn(
          "p-3.5 backdrop-blur-md border rounded-full shadow-lg transition-all duration-300",
          item.active
            ? "bg-minimal-accent border-minimal-accent text-white ring-4 ring-minimal-accent/20"
            : "bg-minimal-bg/80 border-minimal-border text-minimal-muted hover:border-minimal-accent/40 hover:text-minimal-text",
        )}
        title={item.title}
      >
        <Icon className="w-5 h-5" />
      </motion.button>
    );
  };

  return (
    <div className={cn("fixed top-8 end-8 flex flex-col gap-3", Z_CLASS.floating)}>
      {tools.map((item, idx) => renderButton(item, idx))}

      {pluginButtons.length > 0 && <Divider />}
      {pluginButtons.map((item, idx) => {
        const Icon = item.icon;
        const active = item.isActive ? item.isActive() : false;
        return (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: active ? 1 : 0.6, x: 0, scale: 1 }}
            whileHover={{ opacity: 1, scale: 1.1, x: -4 }}
            whileTap={{ scale: 0.95 }}
            transition={{ delay: (tools.length + idx) * 0.05, duration: 0.3, ease: "easeOut" }}
            onClick={() => item.onClick(pluginContext as PluginContext)}
            aria-label={item.label}
            className={cn(
              "p-3.5 backdrop-blur-md border rounded-full shadow-lg transition-all duration-300",
              active
                ? "bg-minimal-accent border-minimal-accent text-white ring-4 ring-minimal-accent/20"
                : "bg-minimal-bg/80 border-minimal-border text-minimal-muted hover:border-minimal-accent/40 hover:text-minimal-text",
            )}
            title={item.label}
          >
            <Icon className="w-5 h-5" />
          </motion.button>
        );
      })}
    </div>
  );
};
