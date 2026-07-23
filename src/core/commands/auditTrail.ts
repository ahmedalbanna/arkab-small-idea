/**
 * Command audit trail — records every dispatched action for debugging and
 * observability in dev / test mode.
 *
 * Each entry captures the action, its source (which part of the UI or system
 * triggered it), a timestamp, success/failure, and execution duration.
 *
 * The trail is bounded by `maxEntries` (default 100) so it never leaks memory
 * during long editing sessions.
 */
import type { EditorCommandAction } from "./commandBus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Identifies which part of the system triggered a command, making it possible
 * to filter the audit log by origin.
 */
export type CommandSource =
  | "user:keyboard" // Keyboard shortcut (e.g. Mod-b for bold)
  | "user:toolbar" // Toolbar / formatting bar button
  | "user:slash" // Slash-menu selection
  | "user:context" // Context menu
  | "user:palette" // Command palette
  | "plugin" // Registered plugin
  | "ai" // AI assistant (streaming, rewrite, etc.)
  | "system"; // Internal (TTS, collab, core internals)

/** A single recorded command execution. */
export interface CommandAuditEntry {
  /** Unique, monotonically increasing identifier. */
  id: string;
  /** The action that was dispatched. */
  action: EditorCommandAction;
  /** Where the action originated. */
  source: CommandSource;
  /** High-resolution timestamp (`performance.now()`). */
  timestamp: number;
  /** Whether the executor completed without throwing. */
  success: boolean;
  /** Execution duration in milliseconds (optional). */
  duration?: number;
}

export interface AuditTrailConfig {
  /** Maximum number of entries kept in memory (default: 100). */
  maxEntries?: number;
  /** Whether recording is active (default: true in dev/test). */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ENTRIES = 100;

// ---------------------------------------------------------------------------
// CommandAuditTrail
// ---------------------------------------------------------------------------

export class CommandAuditTrail {
  private entries: CommandAuditEntry[] = [];
  private config: Required<AuditTrailConfig>;
  private nextId = 1;

  constructor(config?: AuditTrailConfig) {
    this.config = {
      maxEntries: config?.maxEntries ?? DEFAULT_MAX_ENTRIES,
      enabled: config?.enabled ?? true,
    };
  }

  /**
   * Record a new entry. Returns the fully-formed entry with generated `id`
   * and `timestamp`. If the trail is disabled this is a no-op.
   */
  record(partial: Omit<CommandAuditEntry, "id" | "timestamp">): CommandAuditEntry | null {
    if (!this.config.enabled) return null;

    const entry: CommandAuditEntry = {
      id: String(this.nextId++),
      timestamp: performance.now(),
      ...partial,
    };

    this.entries.push(entry);

    // Enforce the max-entries bound by discarding the oldest entries.
    if (this.entries.length > this.config.maxEntries) {
      this.entries.splice(0, this.entries.length - this.config.maxEntries);
    }

    return entry;
  }

  /** Return the `count` most recent entries (defaults to all). */
  getRecent(count?: number): CommandAuditEntry[] {
    if (count === undefined || count >= this.entries.length) {
      return [...this.entries];
    }
    return this.entries.slice(this.entries.length - count);
  }

  /** Return entries whose source matches the given value. */
  getBySource(source: CommandSource): CommandAuditEntry[] {
    return this.entries.filter((e) => e.source === source);
  }

  /** Clear all recorded entries. */
  clear(): void {
    this.entries = [];
    this.nextId = 1;
  }

  /** Total number of recorded entries. */
  get size(): number {
    return this.entries.length;
  }
}
