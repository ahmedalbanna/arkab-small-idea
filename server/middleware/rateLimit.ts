/**
 * Server-side rate limiting middleware using a sliding-window token bucket.
 *
 * Each client IP receives a configurable budget of requests per time window.
 * When the budget is exhausted the middleware returns HTTP 429.
 */

import type { Request, Response, NextFunction } from "express";

export interface RateLimitOptions {
  /** Maximum requests per window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** HTTP status code for rate-limited responses. */
  statusCode: number;
  /** Response body for rate-limited requests. */
  message: string;
}

const defaultOptions: RateLimitOptions = {
  maxRequests: 60,
  windowMs: 60_000,
  statusCode: 429,
  message: "Too many requests — please slow down.",
};

interface BucketEntry {
  /** Number of requests remaining in the current window. */
  remaining: number;
  /** Timestamp (epoch ms) when the window started. */
  windowStart: number;
}

/**
 * Create an Express rate-limiting middleware.
 *
 * Uses a simple in-memory map keyed by client IP.  For production with
 * multiple server processes, swap the store for a shared Redis backend.
 */
export function createRateLimiter(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...defaultOptions, ...options };
  const buckets = new Map<string, BucketEntry>();

  // Periodically purge stale entries to avoid memory growth
  const purgeInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now - entry.windowStart > opts.windowMs) {
        buckets.delete(key);
      }
    }
  }, opts.windowMs * 2);

  // Allow the timer to be cleaned up externally
  (purgeInterval as unknown as { unref?: () => void }).unref?.();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now - entry.windowStart >= opts.windowMs) {
      // Start a new window
      entry = { remaining: opts.maxRequests - 1, windowStart: now };
      buckets.set(key, entry);
      res.setHeader("X-RateLimit-Limit", String(opts.maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(entry.remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + opts.windowMs) / 1000)));
      next();
      return;
    }

    if (entry.remaining <= 0) {
      res.status(opts.statusCode).json({ error: opts.message });
      return;
    }

    entry.remaining--;
    res.setHeader("X-RateLimit-Limit", String(opts.maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(entry.remaining));
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil((entry.windowStart + opts.windowMs) / 1000)),
    );
    next();
  };
}
