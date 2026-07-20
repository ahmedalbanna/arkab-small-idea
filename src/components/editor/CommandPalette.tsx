import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import type { EditorCommand } from "../../plugins/types";

interface CommandPaletteProps {
  commands: EditorCommand[];
  onRun: (cmd: EditorCommand) => void;
  onClose: () => void;
}

function commandMatches(query: string, cmd: EditorCommand): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${cmd.label ?? ""} ${cmd.id} ${cmd.key ?? ""}`.toLowerCase();
  return haystack.includes(q);
}

/**
 * A searchable, keyboard-driven palette that surfaces every registered editor
 * command (core formatting, AI actions, and plugin-contributed commands). The
 * command set is derived from the live plugin context, so it always reflects the
 * currently loaded plugins. Selecting a command runs it through the plugin
 * context; the parent is responsible for closing the palette.
 */
export function CommandPalette({ commands, onRun, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => commands.filter((c) => commandMatches(query, c)),
    [commands, query],
  );

  // Keep the highlighted index within bounds as the result set changes.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runActive = () => {
    const cmd = filtered[active];
    if (cmd) onRun(cmd);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-[560px] max-w-[90vw] overflow-hidden rounded-xl border border-minimal-border bg-minimal-bg shadow-2xl ring-1 ring-minimal-border"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-minimal-border px-3 py-2.5">
          <Search className="h-4 w-4 text-minimal-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-sm text-minimal-text outline-none placeholder:text-minimal-muted"
          />
          <kbd className="rounded bg-minimal-sidebar px-1.5 py-0.5 text-[10px] text-minimal-muted">
            Esc
          </kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-minimal-muted">
              No commands found
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => onRun(cmd)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
                  i === active
                    ? "bg-minimal-accent/20"
                    : "hover:bg-white/5",
                )}
              >
                <span className="text-sm text-minimal-text">
                  {cmd.label ?? cmd.id}
                </span>
                {cmd.key && (
                  <kbd className="rounded bg-minimal-sidebar px-1.5 py-0.5 text-[10px] text-minimal-muted">
                    {cmd.key}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
