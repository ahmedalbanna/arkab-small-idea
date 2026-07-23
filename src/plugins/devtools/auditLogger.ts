/**
 * Audit Trail Logger — Dev-only utility for observing, exporting, and
 * analysing the editor's command audit trail in real time.
 *
 * Provides a pub/sub interface (`onCommand`) for live monitoring, two
 * export formats (JSON, CSV), and on-demand statistics (`stats()`).
 *
 * Internally the logger polls the bus's audit log when listeners are
 * registered. This avoids modifying the core `EditorCommandBus` or
 * `CommandAuditTrail` classes — the logger is a pure dev-only consumer
 * that reads the same public API (`getAuditLog`) as any other tool.
 *
 * Dev-only. Never import in production bundles.
 */
import type { EditorCommandBus } from "../editorCommandBus";
import type { CommandAuditEntry, CommandSource } from "../../core/commands/auditTrail";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Interval (ms) at which the logger polls the bus for new entries. */
const POLL_MS = 1_000;

// ---------------------------------------------------------------------------
// AuditLogger
// ---------------------------------------------------------------------------

export class AuditLogger {
  private bus: EditorCommandBus;
  private listeners = new Set<(entry: CommandAuditEntry) => void>();
  private lastSeenCount = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(bus: EditorCommandBus) {
    this.bus = bus;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Register a callback that fires for every new audit entry as it arrives.
   * Returns an unsubscribe function.
   *
   * Polling starts lazily when the first listener is added and stops when
   * the last listener is removed.
   *
   * @example
   * ```typescript
   * const logger = new AuditLogger(bus);
   * const unsub = logger.onCommand((entry) => {
   *   console.log(`[${entry.source}] ${entry.action.type} — ${entry.success ? "OK" : "FAIL"}`);
   * });
   * // later:
   * unsub();
   * ```
   */
  onCommand(callback: (entry: CommandAuditEntry) => void): () => void {
    this.listeners.add(callback);

    // Start polling on first subscriber.
    if (this.listeners.size === 1) {
      this.startPolling();
    }

    return () => {
      this.listeners.delete(callback);
      // Stop polling when no one is listening.
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  /**
   * Export the full audit trail as a formatted JSON string.
   * Each entry includes `id`, `action`, `source`, `timestamp`, `success`,
   * and `duration`.
   */
  exportJSON(): string {
    const log = this.bus.getAuditLog();
    return JSON.stringify(log, null, 2);
  }

  /**
   * Export the audit trail as CSV with columns:
   * `id`, `type`, `source`, `success`, `duration_ms`, `timestamp`.
   */
  exportCSV(): string {
    const log = this.bus.getAuditLog();
    const header = "id,type,source,success,duration_ms,timestamp";
    const rows = log.map((entry) => {
      const type = (entry.action as Record<string, unknown>).type as string;
      // Escape fields containing commas or quotes.
      const safeType = escapeCSV(type);
      const safeSource = escapeCSV(entry.source);
      return `${entry.id},${safeType},${safeSource},${entry.success},${entry.duration ?? ""},${entry.timestamp}`;
    });
    return [header, ...rows].join("\n");
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  /**
   * Compute summary statistics from the current audit trail.
   *
   * Returns counts by source, average execution duration, and failure rate.
   * When the trail is empty all values are zero / empty.
   */
  stats(): {
    totalCommands: number;
    bySource: Record<string, number>;
    avgDuration: number;
    failureRate: number;
  } {
    const log = this.bus.getAuditLog();
    const totalCommands = log.length;

    if (totalCommands === 0) {
      return { totalCommands: 0, bySource: {}, avgDuration: 0, failureRate: 0 };
    }

    // Count by source.
    const bySource: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;
    let failures = 0;

    for (const entry of log) {
      // Source tally.
      bySource[entry.source] = (bySource[entry.source] ?? 0) + 1;

      // Duration (some entries may not have it).
      if (entry.duration !== undefined) {
        totalDuration += entry.duration;
        durationCount++;
      }

      // Failure count.
      if (!entry.success) failures++;
    }

    return {
      totalCommands,
      bySource,
      avgDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      failureRate: failures / totalCommands,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /** Start the polling loop. */
  private startPolling(): void {
    this.lastSeenCount = this.bus.getAuditLog().length;
    this.pollTimer = setInterval(() => this.poll(), POLL_MS);

    // Allow the timer to keep the process alive in Node environments
    // (vitest, SSR, etc.) without preventing shutdown.
    if (typeof this.pollTimer === "object" && "unref" in this.pollTimer) {
      (this.pollTimer as NodeJS.Timeout).unref();
    }
  }

  /** Stop the polling loop. */
  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Check for new entries since the last poll. */
  private poll(): void {
    const log = this.bus.getAuditLog();
    if (log.length <= this.lastSeenCount) return;

    const newEntries = log.slice(this.lastSeenCount);
    this.lastSeenCount = log.length;

    for (const entry of newEntries) {
      for (const fn of this.listeners) {
        try {
          fn(entry);
        } catch {
          // A misbehaving listener must never break the logger.
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape a CSV field value: wrap in double-quotes if it contains a comma,
 * double-quote, or newline; double any embedded double-quotes.
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
