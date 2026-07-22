// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  TokenTracker,
  estimateTokens,
  estimateChatMessagesTokens,
  type TokenUsageEntry,
} from "../services/tokenMonitor";

describe("tokenMonitor", () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker();
    tracker.reset();
  });

  describe("estimateTokens", () => {
    it("estimates tokens from text length", () => {
      expect(estimateTokens("Hello world")).toBe(3); // 11 chars / 4 = 2.75 → 3
    });

    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("handles empty array", () => {
      expect(estimateChatMessagesTokens([])).toBe(0);
    });

    it("estimates tokens from chat messages with parts", () => {
      const messages = [
        { role: "user", parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: "World" }] },
      ];
      // "Hello" = 5/4=1.25 → 2, "World" = 5/4=1.25 → 2, total = 4
      expect(estimateChatMessagesTokens(messages)).toBe(4);
    });

    it("estimates tokens from chat messages with content field", () => {
      const messages = [{ role: "user", content: "Hello world" }];
      expect(estimateChatMessagesTokens(messages)).toBe(3);
    });
  });

  describe("TokenTracker", () => {
    it("starts with empty totals and history", () => {
      const state = tracker.getState();
      expect(state.totals).toEqual({});
      expect(state.history).toEqual([]);
    });

    it("reports usage and updates running totals", () => {
      const entry: TokenUsageEntry = {
        provider: "openai",
        model: "gpt-4o",
        action: "chat",
        promptTokens: 100,
        completionTokens: 50,
        timestamp: new Date().toISOString(),
      };

      const result = tracker.reportUsage(entry);
      expect(result.promptTotal).toBe(100);
      expect(result.completionTotal).toBe(50);
    });

    it("accumulates totals across multiple reports", () => {
      tracker.reportUsage({
        provider: "openai",
        model: "gpt-4o",
        action: "chat",
        promptTokens: 100,
        completionTokens: 50,
        timestamp: new Date().toISOString(),
      });
      tracker.reportUsage({
        provider: "openai",
        model: "gpt-4o",
        action: "chat",
        promptTokens: 200,
        completionTokens: 100,
        timestamp: new Date().toISOString(),
      });

      const totals = tracker.getTotals("chat");
      expect(totals.promptTokens).toBe(300);
      expect(totals.completionTokens).toBe(150);
    });

    it("tracks different action types separately", () => {
      tracker.reportUsage({
        provider: "openai",
        model: "gpt-4o",
        action: "chat",
        promptTokens: 100,
        completionTokens: 50,
        timestamp: new Date().toISOString(),
      });
      tracker.reportUsage({
        provider: "anthropic",
        model: "claude-3",
        action: "action",
        promptTokens: 50,
        completionTokens: 30,
        timestamp: new Date().toISOString(),
      });

      expect(tracker.getTotals("chat").promptTokens).toBe(100);
      expect(tracker.getTotals("action").promptTokens).toBe(50);
    });

    it("enforces budget limits — throws when exceeded", () => {
      // Default budget for "action" is 20000 prompt tokens
      tracker.reportUsage({
        provider: "test",
        model: "test",
        action: "action",
        promptTokens: 19990,
        completionTokens: 0,
        timestamp: new Date().toISOString(),
      });

      // This should be within budget (19990 + 20 = 20010 > 20000)
      expect(() => tracker.checkBudget("action", 20, 0)).toThrow("Token budget exceeded");
    });

    it("allows requests within budget", () => {
      tracker.checkBudget("action", 100, 50);
      // Should not throw
      expect(true).toBe(true);
    });

    it("caps history at 100 entries", () => {
      for (let i = 0; i < 150; i++) {
        tracker.reportUsage({
          provider: "test",
          model: "test",
          action: "chat",
          promptTokens: 1,
          completionTokens: 0,
          timestamp: new Date().toISOString(),
        });
      }

      expect(tracker.getState().history.length).toBeLessThanOrEqual(100);
    });

    it("reset clears all usage data", () => {
      tracker.reportUsage({
        provider: "openai",
        model: "gpt-4o",
        action: "chat",
        promptTokens: 100,
        completionTokens: 50,
        timestamp: new Date().toISOString(),
      });
      tracker.reset();

      const state = tracker.getState();
      expect(state.totals).toEqual({});
      expect(state.history).toEqual([]);
    });

    it("setBudget updates budget for an action type", () => {
      tracker.setBudget("chat", { maxPromptTokens: 1000 });

      const state = tracker.getState();
      expect(state.budgets.chat.maxPromptTokens).toBe(1000);
      // Default completion budget should still be present
      expect(state.budgets.chat.maxCompletionTokens).toBe(25000);
    });

    it("getRecentHistory returns the last N entries", () => {
      for (let i = 0; i < 5; i++) {
        tracker.reportUsage({
          provider: "test",
          model: "test",
          action: "chat",
          promptTokens: 1,
          completionTokens: 0,
          timestamp: new Date().toISOString(),
        });
      }

      const recent = tracker.getRecentHistory(3);
      expect(recent).toHaveLength(3);
    });

    it("loadState returns default state when store has no saved data", () => {
      // Reset ensures clean state
      tracker.reset();
      const state = tracker.loadState();
      expect(state.totals).toEqual({});
      expect(state.history).toEqual([]);
      expect(state.budgets).toBeDefined();
      expect(state.budgets.chat).toBeDefined();
    });
  });
});
