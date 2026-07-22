import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "./types";

export class GoogleProvider implements AIProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Google API key is required. Configure it in the AI settings panel.");
    }
    this.ai = new GoogleGenAI({
      apiKey,
    });
  }

  async chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const formattedMessages = messages.map((m) => {
      const parts: any[] = [];
      if (Array.isArray(m.parts)) {
        parts.push(...m.parts);
      } else {
        parts.push({ text: m.content || m.parts || "" });
      }

      if (m.images && m.images.length > 0) {
        m.images.forEach((img: string) => {
          const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const base64Data = match[2];
            parts.push({
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            });
          }
        });
      }

      return {
        role: m.role === "system" ? "user" : m.role, // Google uses user/model
        parts,
      };
    });

    // For genai SDK, we construct config explicitly. However, genai may not easily support standard abort signals.
    // If it doesn't support them officially via requestOptions.signal yet, it will just ignore it.
    if (onChunk) {
      const response = await this.ai.models.generateContentStream({
        model: model || "gemini-3-flash-preview",
        contents: formattedMessages,
      });

      let fullText = "";
      for await (const chunk of response) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const text = chunk.text || "";
        fullText += text;
        onChunk(text);
      }
      return fullText;
    } else {
      const result = await this.ai.models.generateContent({
        model: model || "gemini-3-flash-preview",
        contents: formattedMessages,
      });
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return result.text || "";
    }
  }

  async generate(
    prompt: string,
    system: string,
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const contents = [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }];

    if (onChunk) {
      const response = await this.ai.models.generateContentStream({
        model: model || "gemini-3-flash-preview",
        contents,
      });

      let fullText = "";
      for await (const chunk of response) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const text = chunk.text || "";
        fullText += text;
        onChunk(text);
      }
      return fullText;
    } else {
      const result = await this.ai.models.generateContent({
        model: model || "gemini-3-flash-preview",
        contents,
      });
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return result.text || "";
    }
  }
}
