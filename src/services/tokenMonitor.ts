/**
 * Token monitoring service.
 *
 * Tracks token usage per request, maintains running totals per session,
 * and enforces configurable budget limits per action type. Usage stats
 * are persisted in localStorage (indexedDB for large volumes in future).
 * API keys are never persisted.
 *
 * Token counting uses a rough estimate (chars / 4) when the provider does
 * not return usage metadata.  Providers that return usage info (e.g. OpenAI,
 * Anthropic) integrate via reportUsage().
 *
 * React components can subscribe via the `subscribe` method or simply
 * re-render on mount by calling getState().
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenUsageEntry {
  /** Provider name (e.g. "openai", "anthropic", "google", "ollama"). */
  provider: string;
  /** Model name used for the request. */
  model: string;
  /** Action type that triggered the request. */
  action: "chat" | "action" | "embedding" | "generate";
  /** Number of prompt (input) tokens. */
  promptTokens: number;
  /** Number of completion (output) tokens. */
  completionTokens: number;
  /** ISO timestamp of the request. */
  timestamp: string;
}

export interface TokenBudget {
  /** Maximum prompt tokens per action type per session (0 = unlimited). */
  maxPromptTokens: number;
  /** Maximum completion tokens per action type per session (0 = unlimited). */
  maxCompletionTokens: number;
}

export interface TokenUsageState {
  /** Running totals per action type for the current session. */
  totals: Record<string, { promptTokens: number; completionTokens: number }>;
  /** Per-request history (last 100 entries kept). */
  history: TokenUsageEntry[];
  /** Budget limits per action type. */
  budgets: Record<string, TokenBudget>;
}

/** Listener type for state change subscriptions. */
type Listener = (state: TokenUsageState) => void;

// ---------------------------------------------------------------------------
// Default budgets
// ---------------------------------------------------------------------------

const DEFAULT_BUDGETS: Record<string, TokenBudget> = {
  chat: { maxPromptTokens: 50000, maxCompletionTokens: 25000 },
  action: { maxPromptTokens: 20000, maxCompletionTokens: 10000 },
  embedding: { maxPromptTokens: 100000, maxCompletionTokens: 0 },
  generate: { maxPromptTokens: 50000, maxCompletionTokens: 25000 },
};

// ---------------------------------------------------------------------------
// Token estimation helpers
// ---------------------------------------------------------------------------

/** Rough token estimate: ~4 characters per token for most languages. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens from a chat message array.
 * Counts both user and model messages.
 */
export function estimateChatMessagesTokens(
  messages: { role: string; parts?: { text: string }[]; content?: string }[],
): number {
  let total = 0;
  for (const msg of messages) {
    if (msg.parts) {
      for (const part of msg.parts) {
        total += estimateTokens(part.text || "");
      }
    } else if (msg.content) {
      total += estimateTokens(msg.content);
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// TokenTracker
// ---------------------------------------------------------------------------

const STORAGE_KEY = "ink-quill-token-usage";

/**
 * Tracks token usage per session, enforces budget limits, and persists
 * usage data in localStorage.
 */
export class TokenTracker {
  private listeners = new Set<Listener>();

  // In-memory fallback when localStorage is unavailable (SSR, workers, tests)
  private memoryState: TokenUsageState | null = null;

  /** Load persisted usage state from localStorage (or in-memory fallback). */
  loadState(): TokenUsageState {
    if (this.memoryState) return this.memoryState;
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.totals === "object" && Array.isArray(parsed.history)) {
            this.memoryState = parsed as TokenUsageState;
            return this.memoryState;
          }
        }
      }
    } catch {
      // Ignore parse errors — start fresh
    }
    this.memoryState = this.defaultState();
    return this.memoryState;
  }

  /** Save usage state to localStorage and notify listeners. */
  private saveState(state: TokenUsageState): void {
    this.memoryState = state;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // Storage full or unavailable — silently degrade
    }
    this.notify(state);
  }

  /** Create a fresh default state. */
  private defaultState(): TokenUsageState {
    return {
      totals: {},
      history: [],
      budgets: { ...DEFAULT_BUDGETS },
    };
  }

  /** Notify all subscribers of the current state. */
  private notify(state: TokenUsageState): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Don't let one bad listener break others
      }
    }
  }

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * The listener is called immediately with the current state.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.loadState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Report token usage after a request completes.
   * Returns the updated running total for the action type.
   */
  reportUsage(entry: TokenUsageEntry): { promptTotal: number; completionTotal: number } {
    const state = this.loadState();
    const action = entry.action;

    // Update running totals
    if (!state.totals[action]) {
      state.totals[action] = { promptTokens: 0, completionTokens: 0 };
    }
    state.totals[action].promptTokens += entry.promptTokens;
    state.totals[action].completionTokens += entry.completionTokens;

    // Append to history (cap at 100)
    state.history.push(entry);
    if (state.history.length > 100) {
      state.history = state.history.slice(-100);
    }

    this.saveState(state);
    return {
      promptTotal: state.totals[action].promptTokens,
      completionTotal: state.totals[action].completionTokens,
    };
  }

  /**
   * Check whether a request would exceed the budget.
   * Throws an error if the budget would be exceeded.
   */
  checkBudget(
    action: TokenUsageEntry["action"],
    estimatedPromptTokens: number,
    estimatedCompletionTokens: number,
  ): void {
    const state = this.loadState();
    const budget = state.budgets[action];
    if (!budget) return;

    const totals = state.totals[action] || { promptTokens: 0, completionTokens: 0 };

    if (
      budget.maxPromptTokens > 0 &&
      totals.promptTokens + estimatedPromptTokens > budget.maxPromptTokens
    ) {
      throw new Error(
        `Token budget exceeded for "${action}". You've used ${totals.promptTokens} of ${budget.maxPromptTokens} prompt tokens.`,
      );
    }

    if (
      budget.maxCompletionTokens > 0 &&
      totals.completionTokens + estimatedCompletionTokens > budget.maxCompletionTokens
    ) {
      throw new Error(
        `Token budget exceeded for "${action}". You've used ${totals.completionTokens} of ${budget.maxCompletionTokens} completion tokens.`,
      );
    }
  }

  /** Get current usage state. */
  getState(): TokenUsageState {
    return this.loadState();
  }

  /** Get running totals for an action type. */
  getTotals(action: string): { promptTokens: number; completionTokens: number } {
    const state = this.loadState();
    return state.totals[action] || { promptTokens: 0, completionTokens: 0 };
  }

  /** Get the last N history entries. */
  getRecentHistory(n: number = 10): TokenUsageEntry[] {
    const state = this.loadState();
    return state.history.slice(-n);
  }

  /** Reset all usage state for a new session. */
  reset(): void {
    this.saveState(this.defaultState());
  }

  /** Update budget limits for an action type. */
  setBudget(action: string, budget: Partial<TokenBudget>): void {
    const state = this.loadState();
    state.budgets[action] = {
      ...(DEFAULT_BUDGETS[action] || { maxPromptTokens: 0, maxCompletionTokens: 0 }),
      ...state.budgets[action],
      ...budget,
    };
    this.saveState(state);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const tokenTracker = new TokenTracker();
