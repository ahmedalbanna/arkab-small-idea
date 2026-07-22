import { describe, expect, it, vi } from "vitest";
import { StreamBuffer } from "../services/streamBuffer";

describe("StreamBuffer", () => {
  describe("push and flush", () => {
    it("accumulates chunks and flushes via onFlush", () => {
      const flushed: string[] = [];
      const buffer = new StreamBuffer({
        intervalMs: 10,
        onFlush: (text) => flushed.push(text),
      });

      buffer.push("Hello");
      buffer.push(" ");
      buffer.push("World");

      // Wait for flush
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(flushed.length).toBeGreaterThan(0);
          const allText = flushed.join("");
          expect(allText).toContain("Hello");
          expect(allText).toContain("World");
          buffer.close();
          resolve(undefined);
        }, 50);
      });
    });

    it("calls onComplete on close with full text", () => {
      const completed: string[] = [];
      const buffer = new StreamBuffer({
        intervalMs: 10,
        onComplete: (text) => completed.push(text),
      });

      buffer.push("chunk1");
      buffer.push("chunk2");

      return new Promise((resolve) => {
        setTimeout(() => {
          buffer.close();
          expect(completed.length).toBe(1);
          expect(completed[0]).toContain("chunk1");
          expect(completed[0]).toContain("chunk2");
          resolve(undefined);
        }, 50);
      });
    });

    it("ignores push after close", () => {
      const flushed: string[] = [];
      const buffer = new StreamBuffer({
        intervalMs: 10,
        onFlush: (text) => flushed.push(text),
      });

      buffer.push("before close");
      buffer.close();
      buffer.push("after close");

      expect(buffer.isClosed).toBe(true);
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(flushed.join("")).toContain("before close");
          expect(flushed.join("")).not.toContain("after close");
          resolve(undefined);
        }, 50);
      });
    });
  });

  describe("flush", () => {
    it("flushes immediately when called", () => {
      const flushed: string[] = [];
      const buffer = new StreamBuffer({
        intervalMs: 1000, // long interval so it won't auto-flush
        onFlush: (text) => flushed.push(text),
      });

      buffer.push("data");
      buffer.flush();

      expect(flushed.length).toBe(1);
      expect(flushed[0]).toBe("data");
      buffer.close();
    });

    it("does not call onFlush when buffer is empty", () => {
      const onFlush = vi.fn();
      const buffer = new StreamBuffer({
        intervalMs: 10,
        onFlush,
      });

      buffer.flush();
      expect(onFlush).not.toHaveBeenCalled();
      buffer.close();
    });
  });

  describe("abort", () => {
    it("discards buffered content without calling onComplete", () => {
      const onFlush = vi.fn();
      const onComplete = vi.fn();
      const buffer = new StreamBuffer({
        intervalMs: 10,
        onFlush,
        onComplete,
      });

      buffer.push("data to discard");
      buffer.abort();

      expect(buffer.isClosed).toBe(true);
      expect(onComplete).not.toHaveBeenCalled();

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(onFlush).not.toHaveBeenCalled();
          resolve(undefined);
        }, 50);
      });
    });
  });

  describe("text property", () => {
    it("returns accumulated buffer text", () => {
      const buffer = new StreamBuffer({
        intervalMs: 1000,
        onFlush: () => {},
      });

      buffer.push("abc");
      buffer.push("def");
      expect(buffer.text).toBe("abcdef");
      buffer.close();
    });
  });

  describe("multiple push cycles", () => {
    it("continues flushing after first flush", () => {
      const flushed: string[] = [];
      const buffer = new StreamBuffer({
        intervalMs: 10,
        onFlush: (text) => flushed.push(text),
      });

      buffer.push("first");
      buffer.flush();
      buffer.push("second");

      return new Promise((resolve) => {
        setTimeout(() => {
          buffer.close();
          expect(flushed).toContain("first");
          expect(flushed).toContain("second");
          resolve(undefined);
        }, 50);
      });
    });
  });
});
