import type { AIProvider } from "./types";
import { createTimeoutSignal, DEFAULT_TIMEOUTS } from "./abortUtils";

export class OllamaProvider implements AIProvider {
  constructor(_host?: string) {
    // _host is accepted for API compatibility (passed by factory) but unused
    // client-side — requests proxy through the Ink & Quill server.
    void _host;
  }

  async chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const { signal: timeoutSignal, clear } = createTimeoutSignal(signal, DEFAULT_TIMEOUTS.ollama);
    try {
      const response = await fetch(`/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: timeoutSignal,
        body: JSON.stringify({
          model,
          messages,
          stream: !!onChunk,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || response.statusText);
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
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.message?.content) {
                fullContent += data.message.content;
                onChunk(data.message.content);
              }
            } catch {
              // Silently ignore invalid JSON chunks as they might be partial
            }
          }
        }
        return fullContent;
      } else {
        const data = await response.json();
        return data.message?.content || "";
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
    const { signal: timeoutSignal, clear } = createTimeoutSignal(signal, DEFAULT_TIMEOUTS.ollama);
    try {
      const response = await fetch(`/api/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: timeoutSignal,
        body: JSON.stringify({
          model,
          prompt,
          system,
          stream: !!onChunk,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || response.statusText);
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
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.response) {
                fullContent += data.response;
                onChunk(data.response);
              }
            } catch (e: any) {
              if (
                e.message !== "Unexpected end of JSON input" &&
                !e.message.includes("Unexpected token")
              ) {
                throw e;
              }
            }
          }
        }
        return fullContent;
      } else {
        const data = await response.json();
        return data.response || "";
      }
    } finally {
      clear();
    }
  }
}
