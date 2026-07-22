import type { AIProvider } from "./types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { PipelineProvider } from "./pipeline";
import { OllamaProvider } from "./ollama";

export const getProvider = (type: string, config: any): AIProvider => {
  switch (type) {
    case "openai":
      return new OpenAIProvider(config.apiKeys.openai);
    case "anthropic":
      return new AnthropicProvider(config.apiKeys.anthropic);
    case "google":
      return new GoogleProvider(config.apiKeys.google);
    case "pipeline":
      return new PipelineProvider();
    default:
      return new OllamaProvider(config.providerConfigs.ollama.host);
  }
};
