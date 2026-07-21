import React, { useEffect } from "react";
import { History, Plus, X } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { cn } from "@/src/lib/utils";

interface SnapshotsMenuProps {
  pageId: string;
  showSnapshots: boolean;
  setShowSnapshots: (val: boolean) => void;
  takeSnapshot: () => Promise<void>;
  setMarkdown: (content: string) => void;
}

export const SnapshotsMenu: React.FC<SnapshotsMenuProps> = ({
  pageId,
  showSnapshots,
  setShowSnapshots,
  takeSnapshot,
  setMarkdown,
}) => {
  const { pages, setSnapshots, loadSnapshots } = useEditorStore();
  const page = pages.find((p) => p.id === pageId);
  const snapshots = page?.snapshots || [];

  useEffect(() => {
    if (showSnapshots) {
      loadSnapshots(pageId);
    }
  }, [showSnapshots, pageId, loadSnapshots]);

  return (
    <div className="relative">
      <button
        className={cn(
          "flex items-center gap-1.5 p-1.5 px-2 rounded-md transition-all",
          showSnapshots
            ? "bg-minimal-accent text-white"
            : "text-minimal-muted hover:text-minimal-text hover:bg-minimal-sidebar",
        )}
        onClick={() => setShowSnapshots(!showSnapshots)}
        title="Document Snapshots"
      >
        <span className="text-[9px] font-bold uppercase tracking-widest hidden md:inline">
          Snapshots
        </span>
        <History className="w-3.5 h-3.5" />
      </button>

      {showSnapshots && (
        <div className="absolute start-0 top-full mt-2 flex flex-col gap-1 w-48 bg-minimal-bg border border-minimal-border rounded-2xl shadow-2xl p-2 z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-start">
          <div className="px-3 py-1.5 border-b border-minimal-border flex items-center justify-between">
            <span className="text-[9px] font-bold text-minimal-muted uppercase tracking-widest">
              Snapshots
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                takeSnapshot();
              }}
              className="p-1 hover:bg-minimal-accent/10 rounded-lg group/plus"
            >
              <Plus className="w-3 h-3 text-minimal-accent group-hover/plus:rotate-90 transition-transform" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto p-1 py-1.5 space-y-1 custom-scrollbar">
            {snapshots.length === 0 ? (
              <p className="text-[9px] text-center text-minimal-muted/50 py-4 italic font-medium">
                No snapshots yet
              </p>
            ) : (
              snapshots.map((s) => {
                const restore = () => {
                  if (
                    window.confirm(
                      "Restore this version? Your current work will be overwritten.",
                    )
                  ) {
                    setMarkdown(s.content);
                    setShowSnapshots(false);
                  }
                };
                return (
                  <div
                    key={s.id}
                    onClick={restore}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        restore();
                      }
                    }}
                    className="w-full text-left p-2 hover:bg-minimal-sidebar rounded-xl transition-all border border-transparent hover:border-minimal-border group/s cursor-pointer"
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-bold text-minimal-text">
                        {new Date(s.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSnapshots(pageId, (prev) =>
                            prev.filter((snap) => snap.id !== s.id),
                          );
                        }}
                        className="opacity-0 group-hover/s:opacity-100 p-1 hover:text-red-500 transition-all font-bold"
                        aria-label="Delete snapshot"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <p className="text-[8px] text-minimal-muted truncate">
                      {s.content.substring(0, 40)}...
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
