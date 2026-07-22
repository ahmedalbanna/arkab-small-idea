// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AIProviderError,
  RateLimitError,
  AuthError,
  ModelNotFoundError,
  OverloadedError,
  TimeoutError,
  classifyProviderError,
} from "../services/providers/errors";

describe("provider errors", () => {
  describe("RateLimitError", () => {
    it("creates a rate limit error", () => {
      const err = new RateLimitError("openai", Date.now() + 5000);
      expect(err).toBeInstanceOf(AIProviderError);
      expect(err.name).toBe("RateLimitError");
      expect(err.provider).toBe("openai");
      expect(err.retryable).toBe(true);
      expect(err.message).toContain("Rate limited");
    });

    it("sets retryAfter when provided", () => {
      const retryAt = Date.now() + 10000;
      const err = new RateLimitError("openai", retryAt);
      expect(err.retryAfter).toBe(retryAt);
    });
  });

  describe("AuthError", () => {
    it("creates an auth error", () => {
      const err = new AuthError("anthropic");
      expect(err.name).toBe("AuthError");
      expect(err.provider).toBe("anthropic");
      expect(err.retryable).toBe(false);
      expect(err.message).toContain("Authentication failed");
      expect(err.message).toContain("anthropic");
    });
  });

  describe("ModelNotFoundError", () => {
    it("creates a model-not-found error", () => {
      const err = new ModelNotFoundError("openai", "gpt-5");
      expect(err.name).toBe("ModelNotFoundError");
      expect(err.provider).toBe("openai");
      expect(err.retryable).toBe(false);
      expect(err.message).toContain("gpt-5");
    });
  });

  describe("OverloadedError", () => {
    it("creates an overloaded error", () => {
      const err = new OverloadedError("google");
      expect(err.name).toBe("OverloadedError");
      expect(err.retryable).toBe(true);
      expect(err.message).toContain("temporarily unavailable");
    });
  });

  describe("TimeoutError", () => {
    it("creates a timeout error", () => {
      const err = new TimeoutError("ollama", 30000);
      expect(err.name).toBe("TimeoutError");
      expect(err.retryable).toBe(true);
      expect(err.message).toContain("30000ms");
    });
  });

  describe("classifyProviderError", () => {
    it("classifies 401 as AuthError", () => {
      const err = classifyProviderError({ status: 401, provider: "openai" });
      expect(err).toBeInstanceOf(AuthError);
    });

    it("classifies 403 as AuthError", () => {
      const err = classifyProviderError({ status: 403, provider: "anthropic" });
      expect(err).toBeInstanceOf(AuthError);
    });

    it("classifies 404 with model as ModelNotFoundError", () => {
      const err = classifyProviderError({ status: 404, provider: "openai", model: "gpt-5" });
      expect(err).toBeInstanceOf(ModelNotFoundError);
    });

    it("classifies 404 without model as generic error", () => {
      const err = classifyProviderError({ status: 404, provider: "openai" });
      expect(err).toBeInstanceOf(AIProviderError);
      expect(err).not.toBeInstanceOf(ModelNotFoundError);
    });

    it("classifies 429 as RateLimitError", () => {
      const err = classifyProviderError({ status: 429, provider: "openai" });
      expect(err).toBeInstanceOf(RateLimitError);
    });

    it("classifies 503 as OverloadedError", () => {
      const err = classifyProviderError({ status: 503, provider: "anthropic" });
      expect(err).toBeInstanceOf(OverloadedError);
    });

    it("classifies 500 as generic provider error", () => {
      const err = classifyProviderError({ status: 500, provider: "google" });
      expect(err).toBeInstanceOf(AIProviderError);
      expect(err).not.toBeInstanceOf(OverloadedError);
    });

    it("extracts error message from JSON body", () => {
      const body = JSON.stringify({ error: { message: "Insufficient quota" } });
      const err = classifyProviderError({ status: 429, provider: "openai", body });
      expect(err.message).toContain("Insufficient quota");
    });

    it("parses retry_after from response body", () => {
      const body = JSON.stringify({ retry_after: 20 });
      const err = classifyProviderError({
        status: 429,
        provider: "openai",
        body,
      }) as RateLimitError;
      expect(err.retryAfter).toBeGreaterThan(Date.now());
    });
  });
});
