/**
 * Structured logging for the plugin system.
 *
 * Every plugin lifecycle event (register / init / destroy / enable / disable /
 * leak) and every `loadPlugins` run is emitted as a single, structured entry
 * (`PluginLogEntry`) so debugging plugin behavior is a matter of filtering by
 * `plugin`, `event` or `level` rather than reading ad-hoc `console.log`s.
 *
 * Entries are delivered to:
 * - any registered sink (used by tests and by tooling that wants to observe
 *   plugin events programmatically), and
 * - the browser/dev console, except in test mode (to keep test output clean).
 *
 * `debug` entries are emitted only in development builds; `info`/`warn`/`error`
 * always reach the console so real failures are visible in production too.
 */
export type PluginLogLevel = "debug" | "info" | "warn" | "error";

export interface PluginLogEntry {
  /** Epoch milliseconds when the event occurred. */
  ts: number;
  level: PluginLogLevel;
  /** Plugin id, or `"*"` for registry/load-wide events. */
  plugin: string;
  /** Stable event name, e.g. `init:start`, `load:done`, `leak`. */
  event: string;
  message: string;
  /** Optional structured context (counts, ids, error messages, timings). */
  meta?: Record<string, unknown>;
}

export type PluginLogSink = (entry: PluginLogEntry) => void;

const sinks = new Set<PluginLogSink>();

/** Subscribe to plugin log entries. Returns an unsubscribe function. */
export function addPluginLogSink(sink: PluginLogSink): () => void {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

// `MODE` is "test" under vitest, "development" under `vite dev`, "production"
// in a build. We suppress console output during tests (sinks still fire) and
// suppress `debug` entirely outside development.
const isTest = import.meta.env.MODE === "test";
const isDev = import.meta.env.DEV;

function emit(
  level: PluginLogLevel,
  plugin: string,
  event: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry: PluginLogEntry = {
    ts: Date.now(),
    level,
    plugin,
    event,
    message,
    ...(meta ? { meta } : {}),
  };

  for (const sink of sinks) {
    try {
      sink(entry);
    } catch {
      // A misbehaving sink must never break the host flow.
    }
  }

  if (isTest) return; // console output omitted during tests
  if (level === "debug" && !isDev) return; // verbose logs are dev-only

  const tag = `[plugin:${plugin}] ${event}`;
  const extra = meta ?? "";
  switch (level) {
    case "error":
      // eslint-disable-next-line no-console
      console.error(tag, message, extra);
      break;
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(tag, message, extra);
      break;
    case "info":
      // eslint-disable-next-line no-console
      console.info(tag, message, extra);
      break;
    default:
      // eslint-disable-next-line no-console
      console.debug(tag, message, extra);
  }
}

export const pluginLogger = {
  debug: (
    plugin: string,
    event: string,
    message: string,
    meta?: Record<string, unknown>,
  ) => emit("debug", plugin, event, message, meta),
  info: (
    plugin: string,
    event: string,
    message: string,
    meta?: Record<string, unknown>,
  ) => emit("info", plugin, event, message, meta),
  warn: (
    plugin: string,
    event: string,
    message: string,
    meta?: Record<string, unknown>,
  ) => emit("warn", plugin, event, message, meta),
  error: (
    plugin: string,
    event: string,
    message: string,
    meta?: Record<string, unknown>,
  ) => emit("error", plugin, event, message, meta),
};
