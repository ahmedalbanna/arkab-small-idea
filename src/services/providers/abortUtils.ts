/**
 * Shared abort/timeout utilities for AI providers.
 *
 * Combines a user-provided AbortSignal with a configurable timeout so
 * that requests are cancelled either when the user navigates away /
 * clicks stop, or after a duration threshold.
 */

/**
 * Default timeout per provider (ms).
 */
export const DEFAULT_TIMEOUTS: Record<string, number> = {
  openai: 120_000,
  anthropic: 120_000,
  google: 180_000,
  ollama: 300_000,
};

/**
 * Create an AbortSignal that aborts when EITHER the user signal fires
 * OR the timeout elapses (whichever comes first).
 *
 * The returned signal must be cleaned up with `.abort()` or the controller
 * must be allowed to be GC'd.
 */
export function createTimeoutSignal(
  userSignal?: AbortSignal,
  timeoutMs?: number,
): { signal: AbortSignal; clear: () => void } {
  // If no timeout is specified, just return the user signal (no-op wrapper)
  if (!timeoutMs || timeoutMs <= 0) {
    return {
      signal: userSignal ?? new AbortController().signal,
      clear: () => {},
    };
  }

  const controller = new AbortController();
  const combinedSignal = userSignal
    ? combineSignals(userSignal, controller.signal)
    : controller.signal;

  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );

  if (userSignal) {
    // Also abort if the user signal fires
    const onUserAbort = () => {
      clearTimeout(timer);
      controller.abort(userSignal.reason);
    };
    if (userSignal.aborted) {
      onUserAbort();
    } else {
      userSignal.addEventListener("abort", onUserAbort, { once: true });
    }
  }

  return {
    signal: combinedSignal,
    clear: () => {
      clearTimeout(timer);
      controller.abort(new DOMException("Request cancelled", "AbortError"));
    },
  };
}

/**
 * Combine two AbortSignals into one that aborts when either fires.
 */
function combineSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  if (s1.aborted) return s1;
  if (s2.aborted) return s2;

  const controller = new AbortController();

  const onAbort = () => {
    controller.abort(s1.aborted ? s1.reason : s2.reason);
  };

  s1.addEventListener("abort", onAbort, { once: true });
  s2.addEventListener("abort", onAbort, { once: true });

  return controller.signal;
}

/**
 * Helper to check whether a signal has been aborted and throw if so.
 * Useful inside streaming loops where the SDK does not natively support
 * AbortSignal.
 */
export function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof DOMException
      ? signal.reason
      : new DOMException("Aborted", "AbortError");
  }
}

/**
 * Wrap a promise with a timeout, rejecting with TimeoutError if the
 * timeout elapses before the promise settles.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DOMException(label ? `${label} timed out` : "Request timed out", "TimeoutError"));
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
