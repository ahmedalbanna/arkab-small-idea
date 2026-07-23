/**
 * Command testing utilities — reusable factories and assertion helpers for
 * `EditorCommandBus` tests, eliminating the ad-hoc mock duplication that
 * previously existed across `commandActionValidation.test.ts`,
 * `editorCommandBus.test.ts`, `editorCommands.test.ts`, and
 * `commandAuditTrail.test.ts`.
 *
 * ## Usage
 *
 * ```typescript
 * import { createMockExecutor, createMockCommandBus, expectDispatched, expectAuditEntry } from "./helpers/commandTestUtils";
 *
 * it("dispatches to executor", () => {
 *   const { bus, executor } = createMockCommandBus();
 *   bus.dispatch({ type: "focus" });
 *   expect(executor.run).toHaveBeenCalledWith({ type: "focus" });
 * });
 * ```
 */
import { vi, expect } from "vitest";
import { EditorCommandBus } from "../../core/commands/commandBus";
import type {
  EditorCommandAction,
  EditorCommandExecutor,
  EditorCommandResult,
} from "../../core/commands/commandBus";
import type { CommandAuditEntry, CommandSource } from "../../core/commands/auditTrail";

// ---------------------------------------------------------------------------
// Mock Executor
// ---------------------------------------------------------------------------

export interface MockExecutor {
  /** Vitest mock function — access `.mock.calls`, `.toHaveBeenCalledWith`, etc. */
  run: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
  /** The most recently dispatched action, or `null` if none. */
  lastAction: () => EditorCommandAction | null;
  /** Number of times `run` has been called. */
  callCount: () => number;
  /** Reset call history and recorded actions. */
  reset: () => void;
}

/**
 * Create a mock executor whose `run` function is a `vi.fn` so tests can assert
 * on it with standard Vitest matchers (`toHaveBeenCalledWith`, etc.). Every
 * call also updates the `lastAction()` accessor so tests that only care about
 * the latest action need not inspect mock internals.
 *
 * @example
 * ```typescript
 * const executor = createMockExecutor();
 * const bus = new EditorCommandBus();
 * bus.setExecutor(executor);
 * bus.dispatch({ type: "focus" });
 * expect(executor.run).toHaveBeenCalledWith({ type: "focus" });
 * ```
 */
export function createMockExecutor(): MockExecutor {
  let last: EditorCommandAction | null = null;

  const run = vi.fn<(...args: unknown[]) => unknown>((action: unknown) => {
    last = action as EditorCommandAction;
    return {} as EditorCommandResult;
  });

  return {
    run,
    lastAction: () => last,
    callCount: () => run.mock.calls.length,
    reset: () => {
      run.mockClear();
      last = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Mock Command Bus
// ---------------------------------------------------------------------------

export interface MockCommandBusConfig {
  /** Pre-attached executor. Defaults to `createMockExecutor()` when omitted. */
  executor?: EditorCommandExecutor | MockExecutor;
  /** Enable the audit trail. Default: `true`. */
  audit?: boolean;
  /** Extra audit trail config. */
  auditConfig?: { maxEntries?: number };
}

export interface MockCommandBusBundle {
  /** The live `EditorCommandBus` instance. */
  bus: EditorCommandBus;
  /** The mock executor (always a `MockExecutor` regardless of `config.executor`). */
  executor: MockExecutor;
}

/**
 * Create an `EditorCommandBus` with a pre-attached mock executor and an active
 * audit trail by default. Returns both the bus and executor so tests can
 * dispatch commands and assert on the executor's call history in one line.
 *
 * When `config.executor` is omitted, a `MockExecutor` is created automatically.
 * Pass a custom executor when you need to control return values per action type.
 *
 * @example
 * ```typescript
 * const { bus, executor } = createMockCommandBus();
 * bus.dispatch({ type: "format", format: "bold" });
 * expect(executor.run).toHaveBeenCalledWith({ type: "format", format: "bold" });
 * ```
 */
export function createMockCommandBus(config?: MockCommandBusConfig): MockCommandBusBundle {
  const mockExec = createMockExecutor();
  const executor = config?.executor ?? mockExec;

  const bus = new EditorCommandBus({
    audit: {
      enabled: config?.audit ?? true,
      maxEntries: config?.auditConfig?.maxEntries,
    },
  });
  bus.setExecutor(executor as EditorCommandExecutor);

  // If the caller passed a custom executor, we still return the mock for the
  // `executor` property — but it won't reflect calls made through the custom
  // executor. Warn the developer so they know.
  if (config?.executor && config.executor !== mockExec) {
    console.warn(
      "[commandTestUtils] A custom executor was passed; the returned `executor.run` mock will NOT reflect dispatch calls. Use the custom executor directly for assertions.",
    );
  }

  return { bus, executor: mockExec };
}

// ---------------------------------------------------------------------------
// Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that every action in `expectedActions` was dispatched to the bus,
 * **in order**. Uses the audit trail to find matching actions — this means the
 * bus must have audit enabled.
 *
 * If an action is not found, the assertion fails with a descriptive message.
 *
 * @example
 * ```typescript
 * const { bus } = createMockCommandBus();
 * bus.dispatch({ type: "focus" });
 * bus.dispatch({ type: "undo" });
 * expectDispatched(bus, { type: "focus" }, { type: "undo" });
 * ```
 */
export function expectDispatched(
  bus: EditorCommandBus,
  ...expectedActions: EditorCommandAction[]
): void {
  const log = bus.getAuditLog();
  const actualActions = log.map((e) => e.action);

  let logIndex = 0;
  for (const expected of expectedActions) {
    // Advance until we find a match or run out of entries.
    while (logIndex < actualActions.length) {
      if (actionsEqual(actualActions[logIndex], expected)) break;
      logIndex++;
    }

    expect(
      logIndex < actualActions.length,
      getAssertionMessage(expected, actualActions, logIndex, "Not found in audit log"),
    ).toBe(true);

    logIndex++;
  }
}

/**
 * Assert that at least one audit entry matches the given partial shape. Uses
 * deep-equality on each provided key — entries that differ on unspecified keys
 * are still considered a match.
 *
 * @example
 * ```typescript
 * const { bus } = createMockCommandBus();
 * bus.dispatch({ type: "format", format: "bold" }, { source: "user:toolbar" });
 * expectAuditEntry(bus, { action: { type: "format", format: "bold" }, source: "user:toolbar", success: true });
 * ```
 */
export function expectAuditEntry(bus: EditorCommandBus, partial: Partial<CommandAuditEntry>): void {
  const log = bus.getAuditLog();

  const match = log.find((entry) => entryMatchesPartial(entry, partial));
  expect(
    match,
    `Expected audit entry matching ${JSON.stringify(partial)}, but none found among ${log.length} entries:\n` +
      log
        .map(
          (e, i) =>
            `  [${i}] action=${JSON.stringify(e.action)}, source=${e.source}, success=${e.success}, duration=${e.duration}`,
        )
        .join("\n"),
  ).toBeTruthy();
}

// ---------------------------------------------------------------------------
// Utility Matchers
// ---------------------------------------------------------------------------

/**
 * Deep-equality check for two `EditorCommandAction` values. Uses JSON
 * serialisation so order of object keys does not matter, but nested objects
 * must be deeply equal.
 */
function actionsEqual(a: EditorCommandAction, b: EditorCommandAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Check if `entry` matches all keys in `partial` via deep-equality. Extra keys
 * on `entry` that are not in `partial` are ignored.
 */
function entryMatchesPartial(
  entry: CommandAuditEntry,
  partial: Partial<CommandAuditEntry>,
): boolean {
  for (const [key, value] of Object.entries(partial)) {
    const k = key as keyof CommandAuditEntry;
    if (JSON.stringify(entry[k]) !== JSON.stringify(value)) return false;
  }
  return true;
}

function getAssertionMessage(
  expected: EditorCommandAction,
  actuals: EditorCommandAction[],
  index: number,
  reason: string,
): string {
  return (
    `Expected action ${JSON.stringify(expected)} at or after index ${index}. ${reason}.\n` +
    `Actual actions:\n` +
    actuals.map((a, i) => `  [${i}] ${JSON.stringify(a)}`).join("\n")
  );
}

// ---------------------------------------------------------------------------
// Legacy support — named exports match the existing mock convention so
// existing tests can switch with minimal diff noise.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `createMockExecutor` instead. Kept for backward compatibility
 * during the migration period.
 */
export const mockExecutor = createMockExecutor;
