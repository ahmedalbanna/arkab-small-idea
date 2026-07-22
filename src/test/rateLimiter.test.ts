// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TokenBucket, actionBucket } from "../services/rateLimiter";

describe("TokenBucket", () => {
  it("starts with full capacity", () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.remaining).toBe(5);
  });

  it("allows consuming tokens within capacity", () => {
    const bucket = new TokenBucket({ capacity: 3, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.tryConsume(1)).toBe(true);
    expect(bucket.tryConsume(2)).toBe(true);
    expect(bucket.remaining).toBe(0);
  });

  it("rejects when capacity is exhausted", () => {
    const bucket = new TokenBucket({ capacity: 2, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.tryConsume(2)).toBe(true);
    expect(bucket.tryConsume(1)).toBe(false);
    expect(bucket.remaining).toBe(0);
  });

  it("rejects consuming more tokens than capacity", () => {
    const bucket = new TokenBucket({ capacity: 3, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.tryConsume(5)).toBe(false);
    expect(bucket.remaining).toBe(3);
  });

  it("refills tokens over time", async () => {
    const bucket = new TokenBucket({
      capacity: 5,
      refillRate: 2,
      refillIntervalMs: 50, // fast refill for test
    });
    bucket.start();

    // Drain the bucket
    expect(bucket.tryConsume(5)).toBe(true);
    expect(bucket.remaining).toBe(0);

    // Wait for one refill tick
    await new Promise((r) => setTimeout(r, 60));
    expect(bucket.remaining).toBe(2);

    bucket.stop();
  });

  it("does not exceed capacity on refill", async () => {
    const bucket = new TokenBucket({
      capacity: 5,
      refillRate: 10,
      refillIntervalMs: 50,
    });
    bucket.start();

    // Use 1 token, wait for refill, should not exceed capacity
    expect(bucket.tryConsume(1)).toBe(true);
    expect(bucket.remaining).toBe(4);

    await new Promise((r) => setTimeout(r, 60));
    // Should refill back to capacity (5), not exceed it
    expect(bucket.remaining).toBe(5);

    bucket.stop();
  });

  it("can be reset to full capacity", () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, refillIntervalMs: 1000 });
    bucket.tryConsume(4);
    expect(bucket.remaining).toBe(1);
    bucket.reset();
    expect(bucket.remaining).toBe(5);
  });

  it("stop prevents further refills", async () => {
    const bucket = new TokenBucket({
      capacity: 5,
      refillRate: 5,
      refillIntervalMs: 50,
    });
    bucket.start();
    bucket.tryConsume(5);
    expect(bucket.remaining).toBe(0);

    bucket.stop();
    await new Promise((r) => setTimeout(r, 60));
    // Should NOT have refilled after stop
    expect(bucket.remaining).toBe(0);
  });
});

describe("actionBucket (preconfigured)", () => {
  it("has a moderate capacity for AI actions", () => {
    expect(actionBucket.remaining).toBe(10);
  });
});
