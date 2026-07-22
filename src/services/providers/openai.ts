import type { AIProvider } from "./types";
import { createTimeoutSignal, DEFAULT_TIMEOUTS } from "./abortUtils";

export class OpenAIProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const { signal: timeoutSignal, clear } = createTimeoutSignal(signal, DEFAULT_TIMEOUTS.openai);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: timeoutSignal,
        body: JSON.stringify({
          model: model || "gpt-4o",
          messages: messages.map((m) => {
            if (m.images && m.images.length > 0) {
              const contentParts: any[] = [{ type: "text", text: m.content || "" }];
              m.images.forEach((img: string) => {
                contentParts.push({
                  type: "image_url",
                  image_url: { url: img },
                });
              });
              return {
                role: m.role === "assistant" ? "assistant" : m.role,
                content: contentParts,
              };
            }
            return {
              role: m.role === "assistant" ? "assistant" : m.role,
              content: m.content,
            };
          }),
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
            const cleanLine = line.replace(/^data: /, "").trim();
            if (!cleanLine || cleanLine === "[DONE]") continue;
            try {
              const data = JSON.parse(cleanLine);
              const content = data.choices[0]?.delta?.content;
              if (content) {
                fullContent += content;
                onChunk(content);
              }
            } catch {
              // Silently ignore malformed chunks
            }
          }
        }
        return fullContent;
      } else {
        const data = await response.json();
        return data.choices[0]?.message?.content || "";
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
