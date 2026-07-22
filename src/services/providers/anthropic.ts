import type { AIProvider } from "./types";
import { createTimeoutSignal, DEFAULT_TIMEOUTS } from "./abortUtils";

const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const system = messages.find((m) => m.role === "system")?.content || "";
    const chatMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        if (m.images && m.images.length > 0) {
          const contentParts: any[] = [{ type: "text", text: m.content || "" }];
          m.images.forEach((img: string) => {
            const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (match) {
              const mimeType = match[1];
              const base64Data = match[2];
              contentParts.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: base64Data,
                },
              });
            }
          });
          return {
            role: m.role === "assistant" ? "assistant" : "user",
            content: contentParts,
          };
        }
        return {
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        };
      });

    const { signal: timeoutSignal, clear } = createTimeoutSignal(
      signal,
      DEFAULT_TIMEOUTS.anthropic,
    );
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "dangerously-allow-browser": "true",
        },
        signal: timeoutSignal,
        body: JSON.stringify({
          model: model || "claude-3-5-sonnet-20240620",
          system,
          messages: chatMessages,
          max_tokens: 4096,
          stream: !!onChunk,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || response.statusText);
      }

      if (onChunk) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const cleanLine = line.replace(/^data: /, "").trim();
            try {
              const data = JSON.parse(cleanLine);
              if (data.type === "content_block_delta") {
                const content = data.delta?.text;
                if (content) {
                  fullContent += content;
                  onChunk(content);
                }
              }
            } catch {
              // Silently ignore invalid JSON chunks as they might be partial
            }
          }
        }
        return fullContent;
      } else {
        const data = await response.json();
        return data.content[0]?.text || "";
      }
    } finally {
      clear();
    }
  }

  async generate(
    prompt: string,
    system: string,
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.chat(
      [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      model,
      onChunk,
      signal,
    );
  }
}
