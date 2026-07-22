/**
 * Structured error types for AI provider interactions.
 *
 * Provides a discriminated union so that callers can reliably distinguish
 * between transient errors (retryable), auth errors (surface to user), and
 * unexpected failures.
 */

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Base error for all AI provider errors.
 * Carries the original error and the provider name for diagnostics.
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    /** Name of the provider that threw (e.g. "openai", "anthropic"). */
    public readonly provider: string,
    /** The underlying cause, if any. */
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/** Rate limit exceeded (HTTP 429). */
export class RateLimitError extends AIProviderError {
  constructor(
    provider: string,
    /** When the client may retry (ms since epoch), if known. */
    public readonly retryAfter?: number,
    cause?: unknown,
    /** Optional detail message from the provider. */
    public readonly detail?: string,
  ) {
    super(
      detail ? `Rate limited by ${provider}: ${detail}` : `Rate limited by ${provider}`,
      provider,
      cause,
    );
    this.name = "RateLimitError";
  }

  /** Returns `true` — rate limit errors are transient and retryable. */
  get retryable(): boolean {
    return true;
  }
}

/** Authentication / authorization failure (invalid or missing API key). */
export class AuthError extends AIProviderError {
  constructor(provider: string, cause?: unknown) {
    super(
      `Authentication failed for ${provider}. Check your API key in Settings.`,
      provider,
      cause,
    );
    this.name = "AuthError";
  }

  /** Returns `false` — auth errors are not retryable. */
  get retryable(): boolean {
    return false;
  }
}

/** Requested model was not found or is not available. */
export class ModelNotFoundError extends AIProviderError {
  constructor(provider: string, model: string, cause?: unknown) {
    super(`Model "${model}" is not available for ${provider}`, provider, cause);
    this.name = "ModelNotFoundError";
  }

  get retryable(): boolean {
    return false;
  }
}

/** Provider service is overloaded or temporarily unavailable (HTTP 502/503). */
export class OverloadedError extends AIProviderError {
  constructor(provider: string, cause?: unknown) {
    super(`${provider} is temporarily unavailable. Please try again.`, provider, cause);
    this.name = "OverloadedError";
  }

  get retryable(): boolean {
    return true;
  }
}

/** Request timed out. */
export class TimeoutError extends AIProviderError {
  constructor(provider: string, ms: number, cause?: unknown) {
    super(`${provider} request timed out after ${ms}ms`, provider, cause);
    this.name = "TimeoutError";
  }

  get retryable(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Error classifier — parse a raw HTTP error into a structured one
// ---------------------------------------------------------------------------

export interface ProviderErrorInput {
  /** HTTP status code, or 0 for network errors. */
  status: number;
  /** Response body text, if available. */
  body?: string;
  /** Provider name. */
  provider: string;
  /** The model that was requested (for 404/model-not-found). */
  model?: string;
}

/**
 * Classify a provider error response into a structured error type.
 * Callers can then check `error instanceof RateLimitError` etc.
 */
export function classifyProviderError(input: ProviderErrorInput): AIProviderError {
  const { status, provider, model } = input;
  const message = input.body ? extractErrorMessage(input.body) : `HTTP ${status}`;

  switch (status) {
    case 401:
    case 403:
      return new AuthError(provider, new Error(message));
    case 404:
      // Could be "model not found" or "endpoint not found"
      if (model) {
        return new ModelNotFoundError(provider, model, new Error(message));
      }
      return new AIProviderError(`${provider} returned 404: ${message}`, provider);
    case 429:
      return new RateLimitError(
        provider,
        parseRetryAfter(input.body),
        new Error(message),
        extractErrorMessage(input.body || ""),
      );
    case 502:
    case 503:
      return new OverloadedError(provider, new Error(message));
    default:
      if (status >= 500) {
        return new AIProviderError(`${provider} server error (${status}): ${message}`, provider);
      }
      return new AIProviderError(`${provider} error (${status}): ${message}`, provider);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return parsed.error?.message || parsed.error || body;
  } catch {
    return body;
  }
}

function parseRetryAfter(body?: string): number | undefined {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body);
    // OpenAI: error.code = "rate_limit_exceeded", error.message may contain "try again in ..."
    // Anthropic: error.headers["retry-after"] (not in body)
    // Common format: { retry_after: 20 } (seconds)
    if (typeof parsed.retry_after === "number") {
      return Date.now() + parsed.retry_after * 1000;
    }
  } catch {
    // ignore
  }
  return undefined;
}
