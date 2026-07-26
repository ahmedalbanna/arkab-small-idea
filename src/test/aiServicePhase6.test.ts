import { describe, expect, it, vi } from "vitest";

// Mock the service container before importing aiService
vi.mock("../services/serviceContainer", () => ({
  getRagServiceSafe: vi.fn().mockReturnValue({
    getWeightedContext: vi.fn().mockResolvedValue(""),
    getGlobalSummary: vi.fn().mockResolvedValue(""),
  }),
}));

// Mock the providers module to return a mock provider
vi.mock("../services/providers", () => ({
  getProvider: vi.fn().mockReturnValue({
    generate: vi.fn().mockResolvedValue("Generated response"),
    chat: vi.fn().mockResolvedValue("Chat response"),
  }),
  GoogleProvider: vi.fn(),
  PipelineProvider: vi.fn(),
  OllamaProvider: vi.fn(),
  OpenAIProvider: vi.fn(),
  AnthropicProvider: vi.fn(),
}));

// Mock the store to return needed config
vi.mock("../stores/aiStore", () => ({
  useAIStore: {
    getState: vi.fn().mockReturnValue({
      modelTokenLimits: { mistral: 8192 },
      promptTemplates: {},
    }),
  },
  getEmbeddingOptions: vi.fn().mockReturnValue({}),
}));

vi.mock("./rateLimiter", () => ({
  actionBucket: { tryConsume: vi.fn().mockReturnValue(true) },
  chatBucket: { tryConsume: vi.fn().mockReturnValue(true) },
}));

describe("aiService — Phase 6 template integration", () => {
  it("processAIAction uses template system for system prompt", async () => {
    const { processAIAction } = await import("../services/aiService");
    const result = await processAIAction("Hello world", "improve", {
      personalInstructions: "Be formal",
    });
    expect(result).toBe("Generated response");
  });

  it("processAIAction applies template overrides", async () => {
    const { processAIAction } = await import("../services/aiService");
    const result = await processAIAction("Hello world", "improve", {
      templateOverrides: {
        improve: {
          systemPrompt: "CUSTOM SYSTEM",
          userPrompt: "CUSTOM USER: {text}",
        },
      },
    });
    expect(result).toBe("Generated response");
  });
});
