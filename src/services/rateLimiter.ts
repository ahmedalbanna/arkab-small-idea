/**
 * Client-side token-bucket rate limiter.
 *
 * Prevents the UI from flooding AI providers with requests. Each service
 * (chat, actions, embeddings) can have its own budget.  Tokens refill at a
 * configurable rate.  When the bucket is empty new requests are queued or
 * rejected depending on the caller's preference.
 */

export interface RateLimiterOptions {
  /** Maximum burst size (consecutive requests before throttling). */
  capacity: number;
  /** Tokens added per intervalMs. */
  refillRate: number;
  /** Refill interval in milliseconds. */
  refillIntervalMs: number;
}

const defaultOptions: RateLimiterOptions = {
  capacity: 10,
  refillRate: 1,
  refillIntervalMs: 1000,
};

export class TokenBucket {
  private capacity: number;
  private tokens: number;
  private refillRate: number;
  private refillIntervalMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private lastRefillTime: number;
  private _stopped: boolean = false;

  constructor(options: Partial<RateLimiterOptions> = {}) {
    const opts = { ...defaultOptions, ...options };
    this.capacity = opts.capacity;
    this.tokens = opts.capacity;
    this.refillRate = opts.refillRate;
    this.refillIntervalMs = opts.refillIntervalMs;
    this.lastRefillTime = Date.now();
  }

  /** Start automatic refill timer. */
  start(): void {
    if (this.timerId) return;
    this.timerId = setInterval(() => this.refill(), this.refillIntervalMs);
    if (typeof this.timerId === "object" && "unref" in this.timerId) {
      (this.timerId as NodeJS.Timeout).unref();
    }
  }

  /** Stop automatic refill and clean up. No further refills will occur. */
  stop(): void {
    this._stopped = true;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   * Idempotent within the same interval window.
   */
  private refill(): void {
    if (this._stopped) return;
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    if (elapsed < this.refillIntervalMs) return; // not yet time
    const intervals = Math.floor(elapsed / this.refillIntervalMs);
    const add = intervals * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + add);
    this.lastRefillTime += intervals * this.refillIntervalMs;
  }

  /**
   * Attempt to consume tokens.  Returns `true` if allowed, `false` if
   * rate-limited.
   */
  tryConsume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  /**
   * Return the number of tokens currently available (refills before returning).
   */
  get remaining(): number {
    this.refill();
    return this.tokens;
  }

  /** Reset the bucket to full capacity. */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTime = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Convenience: per-service rate limiters with sensible defaults
// ---------------------------------------------------------------------------

/** Chat interactions — more generous since they are user-initiated. */
export const chatBucket = new TokenBucket({ capacity: 20, refillRate: 2, refillIntervalMs: 1000 });

/** AI editing actions (improve, summarize, rewrite) — moderate. */
export const actionBucket = new TokenBucket({
  capacity: 10,
  refillRate: 1,
  refillIntervalMs: 1000,
});

/** Embedding / semantic search requests — cheap, higher throughput. */
export const embeddingBucket = new TokenBucket({
  capacity: 30,
  refillRate: 5,
  refillIntervalMs: 1000,
});
