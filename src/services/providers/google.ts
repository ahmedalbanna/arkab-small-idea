import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "./types";
import { createTimeoutSignal, checkAborted, withTimeout, DEFAULT_TIMEOUTS } from "./abortUtils";

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

  /** Default model for this provider. */
  private getModel(model: string): string {
    return model || "gemini-3-flash-preview";
  }

  /** Format chat messages for the Google GenAI SDK. */
  private formatMessages(messages: any[]): { role: string; parts: any[] }[] {
    return messages.map((m) => {
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
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        });
      }

      return {
        // Google uses "user" / "model" roles
        role: m.role === "system" ? "user" : m.role,
        parts,
      };
    });
  }

  /**
   * The @google/genai SDK does not natively support AbortSignal for
   * streaming requests.  We handle cancellation by checking the signal
   * after each yielded chunk.  A timeout signal is layered on top so
   * that long-running requests still abort even if the stream hangs.
   */
  private async streamContent(
    params: { model: string; contents: any[] },
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const { signal: timeoutSignal, clear } = createTimeoutSignal(
      signal,
      signal ? undefined : DEFAULT_TIMEOUTS.google,
    );

    try {
      checkAborted(timeoutSignal);
      const response = await this.ai.models.generateContentStream(params);

      let fullText = "";
      for await (const chunk of response) {
        checkAborted(timeoutSignal);
        const text = chunk.text || "";
        fullText += text;
        onChunk?.(text);
      }
      return fullText;
    } finally {
      clear();
    }
  }

  private async nonStreamContent(
    params: { model: string; contents: any[] },
    signal?: AbortSignal,
  ): Promise<string> {
    const timeout = DEFAULT_TIMEOUTS.google;
    return withTimeout(
      (async () => {
        checkAborted(signal);
        const result = await this.ai.models.generateContent(params);
        checkAborted(signal);
        return result.text || "";
      })(),
      timeout,
      "Google AI request",
    );
  }

  async chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const formattedMessages = this.formatMessages(messages);
    const params = { model: this.getModel(model), contents: formattedMessages };

    return onChunk
      ? this.streamContent(params, onChunk, signal)
      : this.nonStreamContent(params, signal);
  }

  async generate(
    prompt: string,
    system: string,
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const contents = [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }];
    const params = { model: this.getModel(model), contents };

    return onChunk
      ? this.streamContent(params, onChunk, signal)
      : this.nonStreamContent(params, signal);
  }
}
