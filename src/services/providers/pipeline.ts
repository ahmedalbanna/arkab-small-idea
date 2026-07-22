import type { AIProvider } from "./types";

export class PipelineProvider implements AIProvider {
  async chat(): Promise<string> {
    return "Local chat is not yet supported in pipeline mode. Please switch to an API provider (Google, OpenAI, Anthropic, or Ollama) in settings.";
  }
  async generate(prompt: string): Promise<string> {
    // If it's a cluster labeling request, provide a simple generic response
    if (prompt.includes("concise folder name") && prompt.includes("JSON")) {
      return '{ "name": "Semantic Group", "summary": "Automatically grouped by similarity." }';
    }
    return "Local text generation is not yet supported in pipeline mode. Please switch to an API provider in settings.";
  }
}
