import { describe, expect, it, beforeEach } from "vitest";
import { useAIStore } from "../stores/aiStore";

describe("aiStore — Phase 6 additions", () => {
  beforeEach(() => {
    // Reset store to defaults before each test using the store's own reset methods
    useAIStore.getState().resetAllPromptTemplates();
    useAIStore.getState().resetPromptTemplate("__noop__"); // no-op, just ensures method exists
    // Reset modelTokenLimits by setting a known state
    const state = useAIStore.getState();
    // Clear modelTokenLimits
    state.modelTokenLimits = {};
    state.setShowTokenCounts(false);
  });

  describe("promptTemplates", () => {
    it("starts with empty overrides", () => {
      expect(useAIStore.getState().promptTemplates).toEqual({});
    });

    it("setPromptTemplate adds an override", () => {
      useAIStore.getState().setPromptTemplate("improve", {
        systemPrompt: "Custom system prompt",
      });
      const overrides = useAIStore.getState().promptTemplates;
      expect(overrides.improve).toBeDefined();
      expect(overrides.improve?.systemPrompt).toBe("Custom system prompt");
    });

    it("setPromptTemplate merges with existing override", () => {
      useAIStore.getState().setPromptTemplate("improve", {
        systemPrompt: "Custom system",
      });
      useAIStore.getState().setPromptTemplate("improve", {
        userPrompt: "Custom user",
      });
      const overrides = useAIStore.getState().promptTemplates;
      expect(overrides.improve?.systemPrompt).toBe("Custom system");
      expect(overrides.improve?.userPrompt).toBe("Custom user");
    });

    it("resetPromptTemplate removes a single override", () => {
      useAIStore.getState().setPromptTemplate("improve", { systemPrompt: "test" });
      useAIStore.getState().setPromptTemplate("rewrite", { systemPrompt: "test2" });
      useAIStore.getState().resetPromptTemplate("improve");
      const overrides = useAIStore.getState().promptTemplates;
      expect(overrides.improve).toBeUndefined();
      expect(overrides.rewrite).toBeDefined();
    });

    it("resetAllPromptTemplates clears all overrides", () => {
      useAIStore.getState().setPromptTemplate("improve", { systemPrompt: "test" });
      useAIStore.getState().setPromptTemplate("rewrite", { systemPrompt: "test2" });
      useAIStore.getState().resetAllPromptTemplates();
      expect(useAIStore.getState().promptTemplates).toEqual({});
    });
  });

  describe("modelTokenLimits", () => {
    it("setModelTokenLimit adds a limit", () => {
      useAIStore.getState().setModelTokenLimit("gpt-4o", 128000);
      expect(useAIStore.getState().modelTokenLimits["gpt-4o"]).toBe(128000);
    });

    it("setModelTokenLimit overwrites existing limit", () => {
      useAIStore.getState().setModelTokenLimit("gpt-4o", 128000);
      useAIStore.getState().setModelTokenLimit("gpt-4o", 64000);
      expect(useAIStore.getState().modelTokenLimits["gpt-4o"]).toBe(64000);
    });
  });

  describe("showTokenCounts", () => {
    it("setShowTokenCounts updates the value", () => {
      useAIStore.getState().setShowTokenCounts(true);
      expect(useAIStore.getState().showTokenCounts).toBe(true);
      useAIStore.getState().setShowTokenCounts(false);
      expect(useAIStore.getState().showTokenCounts).toBe(false);
    });
  });
});
