/**
 * Command Inspector Panel — Dev-only React component for inspecting the
 * editor's command bus and registered commands at runtime.
 *
 * Rendered by the `devtoolsPlugin` overlay. Uses `useEditorCommandBus()` to
 * access the bus and module-level devtools state for the inspector instance.
 *
 * Dev-only: the overlay's `show()` predicate checks `import.meta.env.DEV`, so
 * this component is never rendered in production.
 */
import { useEffect, useState, useCallback } from "react";
import { Bug, X, Search, RefreshCw, Filter } from "lucide-react";
import { useEditorCommandBus } from "../../plugins/editorCommandContext";
import { getInspector, setInspectorOpen } from "../../plugins/devtools";
import type {
  BusSnapshot,
  CommandInfo,
  TraceResult,
} from "../../plugins/devtools/commandInspector";
import type { CommandAuditEntry, CommandSource } from "../../core/commands/auditTrail";
import { PanelSlot } from "../layout/PanelSlot";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often (ms) the panel refreshes its snapshot from the bus. */
const POLL_INTERVAL = 2_000;

/** Colours for the status badge. */
const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  failure: "bg-red-500/10 text-red-600 border-red-500/20",
};

/** Sections in the panel. */
type Tab = "commands" | "dispatches" | "timeline" | "trace";

// ---------------------------------------------------------------------------
// CommandInspectorPanel
// ---------------------------------------------------------------------------

export function CommandInspectorPanel() {
  const bus = useEditorCommandBus();
  const inspector = getInspector();

  const [snapshot, setSnapshot] = useState<BusSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dispatches");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<CommandSource | "all">("all");
  const [traceInput, setTraceInput] = useState("");
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);

  // ---------- Poll snapshot ----------
  const refresh = useCallback(() => {
    if (!inspector) return;
    setSnapshot(inspector.snapshot());
  }, [inspector]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  // ---------- Trace handler ----------
  const handleTrace = () => {
    if (!inspector || !traceInput.trim()) return;
    try {
      const action = JSON.parse(traceInput.trim()) as Record<string, unknown>;
      // Ensure `type` is present
      if (typeof action.type !== "string") {
        setTraceResult({ valid: false, issues: ["Missing or invalid 'type' field"] });
        return;
      }
      setTraceResult(inspector.traceDispatch(action as never));
    } catch {
      setTraceResult({ valid: false, issues: ["Invalid JSON"] });
    }
  };

  // ---------- Derived data ----------
  const filteredCommands = snapshot
    ? snapshot.commands.filter((cmd) => {
        if (sourceFilter !== "all" && cmd.source !== sourceFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            cmd.id.toLowerCase().includes(q) ||
            cmd.label?.toLowerCase().includes(q) ||
            cmd.key?.toLowerCase().includes(q)
          );
        }
        return true;
      })
    : [];

  // Unique sources for the filter dropdown.
  const availableSources: string[] = snapshot
    ? [...new Set(snapshot.commands.map((c) => c.source).filter(Boolean))]
    : [];

  // ---------- Render ----------
  return (
    <PanelSlot
      isOpen={true}
      onClose={() => setInspectorOpen(false)}
      side="end"
      width="520px"
      title="Command Inspector"
      zLevel="panel"
    >
      <div className="flex flex-col h-full text-[13px]">
        {/* ── Tab bar ── */}
        <div className="flex border-b border-minimal-border bg-minimal-sidebar/50 shrink-0">
          {(
            [
              ["dispatches", "Dispatches"],
              ["commands", "Commands"],
              ["timeline", "Timeline"],
              ["trace", "Trace"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === id
                  ? "text-minimal-accent border-b-2 border-minimal-accent"
                  : "text-minimal-muted hover:text-minimal-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* ──── Tab: Dispatches ──── */}
          {activeTab === "dispatches" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">
                  Recent Dispatches
                </h4>
                <button
                  onClick={refresh}
                  className="p-1 hover:bg-minimal-border rounded text-minimal-muted"
                  aria-label="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Source filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-3 h-3 text-minimal-muted" />
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as CommandSource | "all")}
                  className="flex-1 bg-minimal-sidebar border border-minimal-border rounded-lg px-2 py-1 text-[11px] font-medium outline-none focus:border-minimal-accent"
                >
                  <option value="all">All sources</option>
                  {availableSources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Summary row */}
              {snapshot && (
                <div className="flex gap-3 text-[10px] font-medium text-minimal-muted">
                  <span>Total: {snapshot.auditSize}</span>
                  <span>Executor: {snapshot.executorAttached ? "✔" : "✘"}</span>
                </div>
              )}

              {/* Dispatches table */}
              {(!snapshot || snapshot.recentDispatches.length === 0) && (
                <p className="text-minimal-muted text-[11px] italic py-4 text-center">
                  No commands dispatched yet. Use the editor to see entries here.
                </p>
              )}
              {snapshot && snapshot.recentDispatches.length > 0 && (
                <div className="space-y-1">
                  {snapshot.recentDispatches.map((entry) => (
                    <DispatchRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ──── Tab: Commands ──── */}
          {activeTab === "commands" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">
                  Registered Commands
                </h4>
                <span className="text-[10px] text-minimal-muted">
                  {snapshot?.commands.length ?? 0} total
                </span>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 bg-minimal-sidebar border border-minimal-border rounded-lg px-3 py-1.5 focus-within:border-minimal-accent transition-colors">
                <Search className="w-3.5 h-3.5 text-minimal-muted" />
                <input
                  type="text"
                  placeholder="Search commands by id, label or key..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-[12px] flex-1 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-minimal-muted hover:text-minimal-text"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Commands table */}
              {filteredCommands.length === 0 && (
                <p className="text-minimal-muted text-[11px] italic py-4 text-center">
                  {searchQuery ? "No commands match your search." : "No commands registered yet."}
                </p>
              )}
              {filteredCommands.length > 0 && (
                <div className="space-y-1">
                  {filteredCommands.map((cmd) => (
                    <CommandRow key={cmd.id} cmd={cmd} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ──── Tab: Timeline ──── */}
          {activeTab === "timeline" && (
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">
                Audit Trail Timeline
              </h4>

              {!snapshot || snapshot.recentDispatches.length === 0 ? (
                <p className="text-minimal-muted text-[11px] italic py-4 text-center">
                  No audit entries yet.
                </p>
              ) : (
                <div className="relative pl-4 space-y-0">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-minimal-border" />

                  {[...snapshot.recentDispatches].reverse().map((entry) => (
                    <TimelineEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ──── Tab: Trace ──── */}
          {activeTab === "trace" && (
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">
                Trace Dispatch
              </h4>
              <p className="text-[11px] text-minimal-muted">
                Paste a JSON action to validate and look up in the audit trail.
              </p>

              <textarea
                value={traceInput}
                onChange={(e) => setTraceInput(e.target.value)}
                placeholder='{"type": "format", "format": "bold"}'
                rows={4}
                className="w-full bg-minimal-sidebar border border-minimal-border rounded-lg px-3 py-2 text-[11px] font-mono outline-none focus:border-minimal-accent resize-none"
              />

              <button
                onClick={handleTrace}
                className="px-4 py-1.5 bg-minimal-accent/10 hover:bg-minimal-accent/20 text-minimal-accent text-[11px] font-bold rounded-lg transition-colors"
              >
                Trace
              </button>

              {/* Trace result */}
              {traceResult && (
                <div className="space-y-2 p-3 bg-minimal-sidebar rounded-xl border border-minimal-border">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        traceResult.valid
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      {traceResult.valid ? "VALID" : "INVALID"}
                    </span>
                    {traceResult.source && (
                      <span className="text-[10px] text-minimal-muted">
                        Source: {traceResult.source}
                      </span>
                    )}
                  </div>

                  {traceResult.issues && traceResult.issues.length > 0 && (
                    <div className="space-y-1">
                      {traceResult.issues.map((issue, i) => (
                        <p key={i} className="text-[11px] text-red-500 font-medium">
                          {issue}
                        </p>
                      ))}
                    </div>
                  )}

                  {traceResult.entry && (
                    <div className="text-[10px] text-minimal-muted space-y-0.5">
                      <p>Duration: {(traceResult.entry.duration ?? 0).toFixed(2)}ms</p>
                      <p>Timestamp: {new Date(traceResult.entry.timestamp).toISOString()}</p>
                    </div>
                  )}

                  {!traceResult.valid && !traceResult.entry && (
                    <p className="text-[11px] text-minimal-muted italic">
                      Action not found in audit trail (may not have been dispatched yet).
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Footer stats ── */}
        {snapshot && (
          <div className="shrink-0 px-4 py-2 border-t border-minimal-border bg-minimal-sidebar/30 flex items-center gap-4 text-[9px] font-bold text-minimal-muted uppercase tracking-wider">
            <Bug className="w-3 h-3" />
            <span>{snapshot.commands.length} commands</span>
            <span>{snapshot.auditSize} audit entries</span>
            <span className="flex-1" />
            <span className="normal-case font-medium">{new Date().toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </PanelSlot>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single row in the dispatches table. */
function DispatchRow({ entry }: { entry: CommandAuditEntry }) {
  const actionType = (entry.action as Record<string, unknown>).type as string;
  const statusLabel = entry.success ? "success" : "failure";
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-minimal-sidebar/30 hover:bg-minimal-sidebar/60 transition-colors">
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          entry.success ? "bg-emerald-500" : "bg-red-500"
        }`}
      />

      {/* Action type */}
      <code className="text-[11px] font-mono font-bold text-minimal-text flex-1 truncate">
        {actionType}
      </code>

      {/* Source badge */}
      <span className="text-[9px] font-bold text-minimal-muted bg-minimal-border/30 px-1.5 py-0.5 rounded uppercase">
        {entry.source}
      </span>

      {/* Duration */}
      {entry.duration !== undefined && (
        <span className="text-[10px] text-minimal-muted font-mono tabular-nums">
          {entry.duration.toFixed(1)}ms
        </span>
      )}

      {/* Status badge */}
      <span
        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
          STATUS_COLORS[statusLabel] ?? ""
        }`}
      >
        {statusLabel}
      </span>
    </div>
  );
}

/** A single row in the commands table. */
function CommandRow({ cmd }: { cmd: CommandInfo }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-minimal-sidebar/30 hover:bg-minimal-sidebar/60 transition-colors">
      {/* ID */}
      <code className="text-[11px] font-mono font-bold text-minimal-text flex-1 truncate">
        {cmd.id}
      </code>

      {/* Label (if different from id) */}
      {cmd.label && cmd.label !== cmd.id && (
        <span className="text-[10px] text-minimal-muted truncate max-w-[120px]">{cmd.label}</span>
      )}

      {/* Keybinding */}
      {cmd.key && (
        <kbd className="text-[9px] font-bold text-minimal-accent bg-minimal-accent/10 border border-minimal-accent/20 px-1.5 py-0.5 rounded">
          {cmd.key}
        </kbd>
      )}

      {/* Source */}
      {cmd.source && cmd.source !== "unknown" && (
        <span className="text-[9px] font-bold text-minimal-muted bg-minimal-border/30 px-1.5 py-0.5 rounded uppercase">
          {cmd.source}
        </span>
      )}

      {/* Slash indicator */}
      {cmd.slash && (
        <span className="text-[9px] font-bold text-indigo-500/80 bg-indigo-500/10 px-1.5 py-0.5 rounded">
          slash
        </span>
      )}
    </div>
  );
}

/** A single entry in the timeline view. */
function TimelineEntry({ entry }: { entry: CommandAuditEntry }) {
  const actionType = (entry.action as Record<string, unknown>).type as string;
  return (
    <div className="relative pb-4 pl-4 last:pb-0 group">
      {/* Dot on the timeline */}
      <div
        className={`absolute left-0 top-1.5 w-[14px] h-[14px] rounded-full border-2 bg-minimal-bg flex items-center justify-center ${
          entry.success
            ? "border-emerald-500 group-hover:bg-emerald-500/10"
            : "border-red-500 group-hover:bg-red-500/10"
        } transition-colors`}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${entry.success ? "bg-emerald-500" : "bg-red-500"}`}
        />
      </div>

      <div className="flex items-center gap-2">
        <code className="text-[11px] font-mono font-bold text-minimal-text">{actionType}</code>
        <span className="text-[9px] text-minimal-muted bg-minimal-border/30 px-1.5 py-0.5 rounded uppercase">
          {entry.source}
        </span>
      </div>
      {entry.duration !== undefined && (
        <p className="text-[9px] text-minimal-muted mt-0.5">
          {entry.duration.toFixed(1)}ms
          {!entry.success && " — failed"}
        </p>
      )}
    </div>
  );
}
