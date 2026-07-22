/**
 * StreamBuffer — Batches streaming chunks into timed intervals for smoother UI updates.
 *
 * Instead of re-rendering on every tiny chunk (which can cause jank), the buffer
 * collects chunks and flushes at a fixed interval (default 50ms). It uses
 * requestAnimationFrame when available for aligned frame updates.
 */

export interface StreamBufferOptions {
  /** Interval in ms between flushes (default: 50). */
  intervalMs?: number;
  /** Called on each flush with accumulated text. */
  onFlush?: (accumulated: string) => void;
  /** Called when the buffer is closed with the final text. */
  onComplete?: (fullText: string) => void;
}

export class StreamBuffer {
  private buffer = "";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private closed = false;
  private intervalMs: number;
  private onFlush: ((text: string) => void) | null;
  private onComplete: ((text: string) => void) | null;

  constructor(options?: StreamBufferOptions) {
    this.intervalMs = options?.intervalMs ?? 50;
    this.onFlush = options?.onFlush ?? null;
    this.onComplete = options?.onComplete ?? null;
  }

  /** Append a chunk to the buffer. Starts the flush timer on first chunk. */
  push(chunk: string): void {
    if (this.closed) return;
    this.buffer += chunk;

    if (!this.timer) {
      this.scheduleFlush();
    }
  }

  /** Flush pending content immediately. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.buffer && this.onFlush) {
      this.onFlush(this.buffer);
      this.buffer = "";
    }
  }

  /**
   * Close the buffer, flushing any remaining content and firing onComplete.
   * After close, push() is a no-op.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.flush();

    if (this.onComplete) {
      this.onComplete(this.buffer);
    }
    this.buffer = "";
    this.detach();
  }

  /** Abort without firing onComplete. Remaining buffered content is discarded. */
  abort(): void {
    this.closed = true;
    this.buffer = "";
    this.detach();
  }

  /** Get the full accumulated text so far. */
  get text(): string {
    return this.buffer;
  }

  /** Whether the buffer has been closed. */
  get isClosed(): boolean {
    return this.closed;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private scheduleFlush(): void {
    // Use requestAnimationFrame for visual alignment, with setTimeout fallback
    if (typeof requestAnimationFrame !== "undefined") {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.flush();
        if (!this.closed && this.buffer) {
          this.scheduleFlush();
        }
      });
    } else {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
        if (!this.closed && this.buffer) {
          this.scheduleFlush();
        }
      }, this.intervalMs);
    }
  }

  private detach(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
