/**
 * Command Inspector — Dev-only introspection utility for the editor's command
 * bus and registered commands.
 *
 * Provides a structured snapshot of the current bus state (audit trail, attached
 * commands) plus search / filter / trace helpers so developers can diagnose
 * command routing issues without scattering `console.log` calls.
 *
 * The inspector is **dev-only** — it should never be instantiated or imported
 * in production bundles. All consumers guard with `import.meta.env.DEV`.
 */
import type { EditorCommandAction } from "../editorCommandBus";
import { EditorCommandBus } from "../editorCommandBus";
import { EditorCommandActionSchema, formatZodIssues } from "../../core/commands/actionSchema";
import type { CommandAuditEntry, CommandSource } from "../../core/commands/auditTrail";
import type { EditorCommand } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Display-friendly metadata for a registered editor command. */
export interface CommandInfo {
  id: string;
  /** Keyboard shortcut, e.g. "Mod-b". */
  key?: string;
  /** Human-readable label. */
  label?: string;
  /** Origin of the command registration. */
  source: string;
  /** Whether the command appears in the slash menu. */
  slash?: boolean;
  /** Whether a keybinding is configured. */
  hasKeybinding: boolean;
}

/** A point-in-time snapshot of the command bus and its registered commands. */
export interface BusSnapshot {
  /** All registered commands (with display-friendly metadata). */
  commands: CommandInfo[];
  /** The 10 most recent audit trail entries. */
  recentDispatches: CommandAuditEntry[];
  /** Whether the bus currently has an executor attached. */
  executorAttached: boolean;
  /** Total number of entries in the audit trail. */
  auditSize: number;
}

/** Result of tracing a single dispatch through validation + audit lookup. */
export interface TraceResult {
  /** Whether the action passes Zod validation. */
  valid: boolean;
  /** Validation issues (present when `valid` is false). */
  issues?: string[];
  /** The source tag from the matching audit entry, if found. */
  source?: CommandSource;
  /** The full audit entry, if found. */
  entry?: CommandAuditEntry;
}

// ---------------------------------------------------------------------------
// CommandInspector
// ---------------------------------------------------------------------------

/**
 * Dev-only inspector for the editor's command bus. Wraps a bus and a list of
 * registered commands (populated after plugins initialise) to produce
 * structured snapshots for the devtools UI.
 *
 * The inspector is dev-only. Never import or instantiate in production bundles.
 */
export class CommandInspector {
  private bus: EditorCommandBus;
  private registeredCommands: EditorCommand[] = [];
  private commandSources = new Map<string, string>();

  constructor(bus: EditorCommandBus, commands?: EditorCommand[]) {
    this.bus = bus;
    if (commands) this.registeredCommands = commands;
  }

  // -----------------------------------------------------------------------
  // Snapshot
  // -----------------------------------------------------------------------

  /** Build a point-in-time snapshot of the bus and its commands. */
  snapshot(): BusSnapshot {
    const recentDispatches = this.bus.getAuditLog(10);
    return {
      commands: this.registeredCommands.map((cmd) => ({
        id: cmd.id,
        key: cmd.key,
        label: cmd.label,
        source: this.commandSources.get(cmd.id) ?? "unknown",
        slash: cmd.slash,
        hasKeybinding: !!cmd.key,
      })),
      recentDispatches,
      executorAttached: recentDispatches.length > 0,
      auditSize: this.bus.getAuditLog().length,
    };
  }

  /**
   * Replace the registered command list. Called after plugins initialise when
   * the full command set becomes available.
   */
  updateCommands(commands: EditorCommand[], sources?: Map<string, string>): void {
    this.registeredCommands = commands;
    if (sources) this.commandSources = sources;
  }

  /**
   * Register a source mapping for a command id. Used by the devtools plugin
   * to tag commands with their origin (core, plugin, ai, etc.).
   */
  setCommandSource(commandId: string, source: string): void {
    this.commandSources.set(commandId, source);
  }

  // -----------------------------------------------------------------------
  // Search / Filter
  // -----------------------------------------------------------------------

  /**
   * Search registered commands by id, label or key. Case-insensitive,
   * partial match.
   */
  search(query: string): CommandInfo[] {
    const q = query.toLowerCase();
    return this.registeredCommands
      .filter((cmd) => {
        if (cmd.id.toLowerCase().includes(q)) return true;
        if (cmd.label?.toLowerCase().includes(q)) return true;
        if (cmd.key?.toLowerCase().includes(q)) return true;
        return false;
      })
      .map((cmd) => ({
        id: cmd.id,
        key: cmd.key,
        label: cmd.label,
        source: this.commandSources.get(cmd.id) ?? "unknown",
        slash: cmd.slash,
        hasKeybinding: !!cmd.key,
      }));
  }

  /**
   * Filter audit trail entries by source. Returns unique action types
   * dispatched from that source as `CommandInfo[]`.
   */
  filterBySource(source: CommandSource): CommandInfo[] {
    return this.bus
      .getAuditLog()
      .filter((entry) => entry.source === source)
      .map((entry) => ({
        id: (entry.action as Record<string, unknown>).type as string,
        source: entry.source,
        hasKeybinding: false,
      }))
      .filter((info, index, self) => self.findIndex((i) => i.id === info.id) === index);
  }

  // -----------------------------------------------------------------------
  // Trace
  // -----------------------------------------------------------------------

  /**
   * Trace a dispatch: validate the action against the Zod schema, then look
   * it up in the audit trail. Returns validation status, any issues, and
   * the matching audit entry (if found).
   */
  traceDispatch(action: EditorCommandAction): TraceResult {
    // 1. Validate against the Zod schema.
    const validation = EditorCommandActionSchema.safeParse(action);
    const issues: string[] = [];

    if (!validation.success) {
      issues.push(
        ...formatZodIssues(validation.error.issues).map((i) => `${i.path}: ${i.message}`),
      );
    }

    // 2. Look up in the audit trail (most recent match).
    const log = this.bus.getAuditLog();
    const entry = log.find((e) => actionsEqual(e.action, action));

    return {
      valid: validation.success,
      ...(issues.length > 0 ? { issues } : {}),
      ...(entry ? { source: entry.source, entry } : {}),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionsEqual(a: EditorCommandAction, b: EditorCommandAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
