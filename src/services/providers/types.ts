export type AIAssistantAction =
  | "improve"
  | "fix-grammar"
  | "shorten"
  | "expand"
  | "generate-outline"
  | "expand-outline"
  | "summarize"
  | "suggest-title"
  | "draft-topic"
  | "rewrite"
  | "complete-text";

export interface ChatMessage {
  role: "user" | "model" | "system";
  parts: { text: string }[];
  images?: string[];
}

export interface AIProvider {
  chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string>;
  generate(
    prompt: string,
    system: string,
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string>;
}
