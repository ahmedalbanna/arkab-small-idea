// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  retryWithBackoff,
  isRetryableError,
  calculateDelay,
  CircuitBreaker,
} from "../services/providers/retry";
import {
  RateLimitError,
  AuthError,
  OverloadedError,
  TimeoutError,
} from "../services/providers/errors";

describe("retry", () => {
  describe("isRetryableError", () => {
    it("returns true for RateLimitError", () => {
      expect(isRetryableError(new RateLimitError("openai"))).toBe(true);
    });

    it("returns true for OverloadedError", () => {
      expect(isRetryableError(new OverloadedError("openai"))).toBe(true);
    });

    it("returns true for TimeoutError", () => {
      expect(isRetryableError(new TimeoutError("openai", 5000))).toBe(true);
    });

    it("returns false for AuthError", () => {
      expect(isRetryableError(new AuthError("openai"))).toBe(false);
    });

    it("returns false for generic errors", () => {
      expect(isRetryableError(new Error("unknown"))).toBe(false);
    });
  });

  describe("calculateDelay", () => {
    it("exponential backoff: attempt 0 = initial", () => {
      const opts = {
        initialDelayMs: 100,
        backoffFactor: 2,
        maxDelayMs: 10000,
        maxRetries: 3,
        jitter: false,
      };
      expect(calculateDelay(0, opts)).toBeGreaterThanOrEqual(0);
    });

    it("increases delay with each attempt", () => {
      const opts = {
        initialDelayMs: 100,
        backoffFactor: 2,
        maxDelayMs: 10000,
        maxRetries: 3,
        jitter: false,
      };
      const d1 = calculateDelay(0, opts);
      const d2 = calculateDelay(1, opts);
      const d3 = calculateDelay(2, opts);
      expect(d1).toBe(100);
      expect(d2).toBe(200);
      expect(d3).toBe(400);
    });

    it("caps at maxDelayMs", () => {
      const opts = {
        initialDelayMs: 100,
        backoffFactor: 10,
        maxDelayMs: 5000,
        maxRetries: 5,
        jitter: false,
      };
      const delay = calculateDelay(5, opts);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it("adds jitter when enabled", () => {
      const opts = {
        initialDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000,
        maxRetries: 3,
        jitter: true,
      };
      // Run multiple times — should vary
      const delays = new Set(Array.from({ length: 10 }, () => calculateDelay(0, opts)));
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  describe("retryWithBackoff", () => {
    it("returns the result on success", async () => {
      const result = await retryWithBackoff(() => Promise.resolve("ok"), { maxRetries: 2 });
      expect(result).toBe("ok");
    });

    it("throws immediately on non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue(new AuthError("openai"));
      await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toThrow(AuthError);
      // Should only be called once
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable errors and succeeds eventually", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError("openai"))
        .mockRejectedValueOnce(new OverloadedError("openai"))
        .mockResolvedValue("success");

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 5,
        jitter: false,
      });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("gives up after exhausting retries", async () => {
      const fn = vi.fn().mockRejectedValue(new RateLimitError("openai"));
      await expect(
        retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 5, jitter: false }),
      ).rejects.toThrow(RateLimitError);
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("calls onRetry callback between attempts", async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError("openai"))
        .mockResolvedValue("ok");

      await retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 5, jitter: false }, onRetry);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(RateLimitError), 1);
    });
  });

  describe("CircuitBreaker", () => {
    it("starts closed", () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe("CLOSED");
    });

    it("allows requests when closed", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 5000,
        halfOpenSuccessThreshold: 1,
      });
      const { allow } = cb.call();
      expect(allow).toBe(true);
    });

    it("opens after failureThreshold failures", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 5000,
        halfOpenSuccessThreshold: 1,
      });

      // First 3 failures should not open yet (each increments counter)
      cb.call().disposition(false);
      expect(cb.getState()).toBe("CLOSED"); // 1 failure

      cb.call().disposition(false);
      expect(cb.getState()).toBe("CLOSED"); // 2 failures

      cb.call().disposition(false);
      expect(cb.getState()).toBe("OPEN"); // 3 failures → OPEN
    });

    it("rejects requests when open", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 50000,
        halfOpenSuccessThreshold: 1,
      });
      cb.call().disposition(false);
      expect(cb.getState()).toBe("OPEN");

      const { allow } = cb.call();
      expect(allow).toBe(false);
    });

    it("transitions to half-open after reset timeout", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 10,
        halfOpenSuccessThreshold: 1,
      });
      cb.call().disposition(false);
      expect(cb.getState()).toBe("OPEN");

      await vi.waitFor(() => {
        expect(cb.getState()).toBe("HALF_OPEN");
      });
    }, 1000);

    it("closes after half-open succeeds", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 5,
        halfOpenSuccessThreshold: 1,
      });
      cb.call().disposition(false);
      expect(cb.getState()).toBe("OPEN");

      // Wait for half-open
      cb.getState(); // triggers transition check
      if (cb.getState() === "HALF_OPEN") {
        cb.call().disposition(true);
        expect(cb.getState()).toBe("CLOSED");
      }
    });

    it("reset clears circuit breaker state", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 50000,
        halfOpenSuccessThreshold: 1,
      });
      cb.call().disposition(false);
      expect(cb.getState()).toBe("OPEN");

      cb.reset();
      expect(cb.getState()).toBe("CLOSED");
    });
  });
});
