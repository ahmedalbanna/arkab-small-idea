// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  createTimeoutSignal,
  checkAborted,
  withTimeout,
  DEFAULT_TIMEOUTS,
} from "../services/providers/abortUtils";

describe("abortUtils", () => {
  describe("createTimeoutSignal", () => {
    it("returns a signal that does not start aborted", () => {
      const { signal, clear } = createTimeoutSignal(undefined, 5000);
      expect(signal.aborted).toBe(false);
      clear();
    });

    it("aborts after the timeout elapses", async () => {
      const { signal, clear } = createTimeoutSignal(undefined, 10);
      await vi.waitFor(() => {
        expect(signal.aborted).toBe(true);
      });
      clear();
    }, 1000);

    it("aborts when the user signal fires", () => {
      const userController = new AbortController();
      const { signal, clear } = createTimeoutSignal(userController.signal, 5000);
      expect(signal.aborted).toBe(false);
      userController.abort();
      expect(signal.aborted).toBe(true);
      clear();
    });

    it("aborts immediately if user signal is already aborted", () => {
      const userController = new AbortController();
      userController.abort(new DOMException("Cancelled", "AbortError"));
      const { signal, clear } = createTimeoutSignal(userController.signal, 5000);
      expect(signal.aborted).toBe(true);
      clear();
    });

    it("clear cancels the timeout and aborts", () => {
      const { signal, clear } = createTimeoutSignal(undefined, 50000);
      clear();
      expect(signal.aborted).toBe(true);
    });

    it("returns a non-aborting signal when no timeout given", () => {
      const { signal, clear } = createTimeoutSignal(undefined, undefined);
      expect(signal.aborted).toBe(false);
      clear();
    });
  });

  describe("checkAborted", () => {
    it("does not throw when signal is undefined", () => {
      expect(() => checkAborted(undefined)).not.toThrow();
    });

    it("does not throw when signal is not aborted", () => {
      const controller = new AbortController();
      expect(() => checkAborted(controller.signal)).not.toThrow();
    });

    it("throws DOMException AbortError when signal is aborted", () => {
      const controller = new AbortController();
      controller.abort();
      expect(() => checkAborted(controller.signal)).toThrow(DOMException);
      expect(() => checkAborted(controller.signal)).toThrow("Aborted");
    });
  });

  describe("withTimeout", () => {
    it("resolves normally when promise completes before timeout", async () => {
      const result = await withTimeout(Promise.resolve("ok"), 1000);
      expect(result).toBe("ok");
    });

    it("rejects with TimeoutError when promise takes too long", async () => {
      await expect(
        withTimeout(new Promise((r) => setTimeout(r, 50000)), 10, "test"),
      ).rejects.toThrow("test timed out");
    }, 1000);

    it("rejects with original error when promise fails before timeout", async () => {
      await expect(withTimeout(Promise.reject(new Error("Original")), 1000)).rejects.toThrow(
        "Original",
      );
    });
  });

  describe("DEFAULT_TIMEOUTS", () => {
    it("defines timeouts for all known providers", () => {
      expect(DEFAULT_TIMEOUTS.openai).toBeGreaterThan(0);
      expect(DEFAULT_TIMEOUTS.anthropic).toBeGreaterThan(0);
      expect(DEFAULT_TIMEOUTS.google).toBeGreaterThan(0);
      expect(DEFAULT_TIMEOUTS.ollama).toBeGreaterThan(0);
    });
  });
});
