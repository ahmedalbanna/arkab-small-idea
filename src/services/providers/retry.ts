/**
 * Retry with exponential backoff and circuit breaker.
 *
 * Provides a `retryWithBackoff` helper that wraps an async function call
 * and retries on transient errors (rate limits, timeouts, overloads).
 * A circuit breaker prevents cascading failures when a provider is down.
 */

import { RateLimitError, OverloadedError, TimeoutError } from "./errors";

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Failures before opening the circuit (default 5). */
  failureThreshold: number;
  /** Milliseconds before attempting a half-open request (default 30s). */
  resetTimeoutMs: number;
  /** Successes in half-open state to close the circuit (default 2). */
  halfOpenSuccessThreshold: number;
}

const DEFAULT_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 2,
};

/**
 * Simple circuit breaker for AI provider calls.
 *
 * State machine:
 *   CLOSED  → normal operation, failures increment a counter
 *   OPEN    → after `failureThreshold` consecutive failures, all calls fail-fast
 *   HALF_OPEN → after `resetTimeoutMs`, one probe request is allowed
 *   If the probe succeeds → CLOSED (counter reset)
 *   If the probe fails → OPEN (counter reset, timer restarts)
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private halfOpenSuccessCount = 0;
  private lastFailureTime = 0;
  private options: CircuitBreakerOptions;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = { ...DEFAULT_CIRCUIT_OPTIONS, ...options };
  }

  /** Get the current state. */
  getState(): CircuitState {
    // Check if it's time to transition from OPEN to HALF_OPEN
    if (this.state === "OPEN" && Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
      this.state = "HALF_OPEN";
      this.halfOpenSuccessCount = 0;
    }
    return this.state;
  }

  /**
   * Call before making a request. Throws if the circuit is open.
   * Use the returned `disposition` to report success/failure.
   */
  call(): { allow: boolean; disposition: (ok: boolean) => void } {
    const state = this.getState();

    if (state === "OPEN") {
      return {
        allow: false,
        disposition: () => {},
      };
    }

    let settled = false;
    return {
      allow: true,
      disposition: (ok: boolean) => {
        if (settled) return;
        settled = true;

        if (ok) {
          this.onSuccess();
        } else {
          this.onFailure();
        }
      },
    };
  }

  /** Reset the circuit breaker (e.g. after changing provider config). */
  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.halfOpenSuccessCount = 0;
    this.lastFailureTime = 0;
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.options.halfOpenSuccessThreshold) {
        this.state = "CLOSED";
        this.failureCount = 0;
      }
    } else {
      // CLOSED — reset failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN" || this.failureCount >= this.options.failureThreshold) {
      this.state = "OPEN";
      this.halfOpenSuccessCount = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of retry attempts (default 3). */
  maxRetries: number;
  /** Initial delay in ms (default 1000). */
  initialDelayMs: number;
  /** Backoff multiplier (default 2). */
  backoffFactor: number;
  /** Maximum delay in ms (default 30_000). */
  maxDelayMs: number;
  /** Whether to add jitter (default true). */
  jitter: boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
  maxDelayMs: 30_000,
  jitter: true,
};

/** Returns `true` if the error is transient and worth retrying. */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return error.retryable;
  if (error instanceof OverloadedError) return error.retryable;
  if (error instanceof TimeoutError) return error.retryable;
  // Generic AIProviderErrors without a specific type are NOT retryable
  // (they may be 400-level client errors)
  return false;
}

/** Calculate delay for a given retry attempt with optional jitter. */
export function calculateDelay(
  attempt: number,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): number {
  const delay = Math.min(
    options.initialDelayMs * Math.pow(options.backoffFactor, attempt),
    options.maxDelayMs,
  );
  if (options.jitter) {
    return Math.round(delay * (0.5 + Math.random() * 0.5));
  }
  return delay;
}

/**
 * Wrap an async function with retry logic.
 *
 * Only retries on errors where `isRetryableError` returns true.
 * Non-retryable errors (AuthError, ModelNotFoundError) propagate immediately.
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => provider.chat(messages, model, onChunk, signal),
 *   { maxRetries: 3 },
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
  onRetry?: (error: unknown, attempt: number) => void,
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Check for Retry-After header in RateLimitErrors
      if (error instanceof RateLimitError && error.retryAfter) {
        const waitMs = Math.max(0, error.retryAfter - Date.now());
        if (waitMs > 0) {
          await sleep(waitMs);
          continue;
        }
      }

      const delay = calculateDelay(attempt, opts);
      onRetry?.(error, attempt + 1);
      await sleep(delay);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
