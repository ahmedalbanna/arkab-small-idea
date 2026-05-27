import { GoogleGenAI } from "@google/genai";
import { ragService } from "./ragService";

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

export class GoogleProvider implements AIProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({
      apiKey: apiKey || process.env.GEMINI_API_KEY || "",
    });
  }

  async chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const formattedMessages = messages.map((m) => ({
      role: m.role === "system" ? "user" : m.role, // Google uses user/model
      parts: Array.isArray(m.parts)
        ? m.parts
        : [{ text: m.content || m.parts || "" }],
    }));

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
    const contents = [
      { role: "user", parts: [{ text: `${system}\n\n${prompt}` }] },
    ];

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

export class OllamaProvider implements AIProvider {
  constructor(private host: string = "") {}

  async chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await fetch(`/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
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
          } catch (e: any) {
            // Silently ignore invalid JSON chunks as they might be partial
          }
        }
      }
      return fullContent;
    } else {
      const data = await response.json();
      return data.message?.content || "";
    }
  }

  async generate(
    prompt: string,
    system: string,
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await fetch(`/api/ai/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
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
  }
}

export class OpenAIProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async chat(
    messages: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages: messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : m.role,
          content: m.content,
        })),
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
          } catch (e) {}
        }
      }
      return fullContent;
    } else {
      const data = await response.json();
      return data.choices[0]?.message?.content || "";
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
      signal
    );
  }
}

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
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "dangerously-allow-browser": "true",
      },
      signal,
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
          } catch (e) {
            // Silently ignore invalid JSON chunks as they might be partial
          }
        }
      }
      return fullContent;
    } else {
      const data = await response.json();
      return data.content[0]?.text || "";
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
      signal
    );
  }
}

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

export const processAIAction = async (
  text: string,
  action: AIAssistantAction,
  options: {
    personalInstructions?: string;
    model?: string;
    provider?: string;
    apiKeys?: any;
    providerConfigs?: any;
    onChunk?: (chunk: string) => void;
    documentContext?: string;
    cursorContext?: string;
    signal?: AbortSignal;
  },
): Promise<string> => {
  const {
    personalInstructions = "",
    model = "mistral",
    provider = "ollama",
    apiKeys,
    providerConfigs,
    onChunk,
    documentContext = "",
    cursorContext = "",
    signal,
  } = options;

  let systemInstruction =
    "You are a precise writing assistant integrated into Ink & Quill. Your goal is to help the user refine their document. ";
  if (personalInstructions) {
    systemInstruction += `The user has specified these stylistic preferences: "${personalInstructions}". Please adhere to them while performing the action. `;
  }

  // Use RAG to get broad document context for the specific selection
  let ragContext = "";
  if (documentContext) {
    ragContext = await ragService.getWeightedContext(
      [
        { text, weight: 1.0 },
        { text: cursorContext, weight: 0.5 },
      ],
      3,
    ); // Fetch a few relevant clips
  }

  if (ragContext) {
    systemInstruction += `\n\n### BROADER DOCUMENT CONTEXT ###\nUse the following relevant document sections to ensure your changes are cohesive with the rest of the work:\n${ragContext}`;
  }

  let prompt = "";

  switch (action) {
    case "improve":
      systemInstruction +=
        "Improve the quality of the following text while keeping its meaning and general structure.";
      prompt = `Improve this text:\n\n${text}`;
      break;
    case "draft-topic":
      systemInstruction +=
        "Take the following topic or snippet and draft a detailed, well-structured, and engaging piece of content around it.";
      prompt = `Draft a detailed piece about this topic:\n\n${text}`;
      break;
    case "fix-grammar":
      systemInstruction +=
        "Fix any grammar, spelling, or punctuation errors in the following text. Do not change the meaning.";
      prompt = `Fix grammar in this text:\n\n${text}`;
      break;
    case "shorten":
      systemInstruction +=
        "Make the following text more concise without losing key information.";
      prompt = `Shorten this text:\n\n${text}`;
      break;
    case "summarize":
      systemInstruction +=
        "Summarize the following text into a concise one-sentence description or a few key bullet points.";
      prompt = `Summarize this text:\n\n${text}`;
      break;
    case "expand":
      systemInstruction +=
        "Expand on the following text with relevant details and richer language.";
      prompt = `Expand on this text:\n\n${text}`;
      break;
    case "generate-outline":
      systemInstruction +=
        "Generate a clear, high-level structural outline for the following text. Use Markdown headings and bullet points.";
      prompt = `Generate an outline for this text:\n\n${text}`;
      break;
    case "expand-outline":
      systemInstruction +=
        "You are a master writer. Your task is to take a Markdown outline (headings and bullet points) and expand it into a full, detailed, and well-written draft. Use the outline structure as your guide but write in a natural, cohesive prose style. Maintain any existing Markdown formatting like bolding or italics if present in the outline.";
      prompt = `Convert this outline into a full draft section:\n\n${text}`;
      break;
    case "suggest-title":
      systemInstruction +=
        "Suggest three punchy and relevant titles for the following text. Return only the three titles as a list.";
      prompt = `Suggest titles for this text:\n\n${text}`;
      break;
    case "rewrite":
      systemInstruction +=
        "Rewrite the following text from scratch while preserving all key information and the core message. Focus on better flow, clearer phrasing, and more engaging language.";
      prompt = `Rewrite this text completely:\n\n${text}`;
      break;
    case "complete-text":
      systemInstruction +=
        "You are a writing assistant. Based on the provided text context, continue the writing in the same style and tone. Provide a natural continuation of about 1-3 sentences. Do not repeat the input.";
      prompt = `Continue this text:\n\n${text}`;
      break;
    default:
      prompt = text;
  }

  const aiProvider = getProvider(provider, { apiKeys, providerConfigs });
  return await aiProvider.generate(prompt, systemInstruction, model, onChunk, signal);
};

export const generateContentFromPrompt = async (
  userInput: string,
  context: string = "",
  options: {
    personalInstructions?: string;
    model?: string;
    provider?: string;
    apiKeys?: any;
    providerConfigs?: any;
    onChunk?: (chunk: string) => void;
  },
): Promise<string> => {
  const {
    personalInstructions = "",
    model = "mistral",
    provider = "ollama",
    apiKeys,
    providerConfigs,
    onChunk,
  } = options;

  let systemInstruction =
    "You are an expert content creator. Generate high-quality Markdown content based on the user's prompt. If context is provided, ensure your response fits naturally within it.";
  if (personalInstructions) {
    systemInstruction += ` Important User Preferences to follow: "${personalInstructions}".`;
  }

  const prompt = `
User requested: ${userInput}
Existing context: ${context}

Generate only the markdown content.
`;

  const aiProvider = getProvider(provider, { apiKeys, providerConfigs });
  return await aiProvider.generate(prompt, systemInstruction, model, onChunk);
};

export const chatWithAI = async (
  messages: ChatMessage[],
  documentContext: string,
  options: {
    personalInstructions?: string;
    model?: string;
    provider?: string;
    apiKeys?: any;
    providerConfigs?: any;
    onChunk?: (chunk: string) => void;
    cursorContext?: string;
    embeddingOptions?: { provider?: string; apiKey?: string; model?: string };
  },
): Promise<string> => {
  const {
    personalInstructions = "",
    model = "mistral",
    provider = "ollama",
    apiKeys,
    providerConfigs,
    onChunk,
    cursorContext = "",
    embeddingOptions,
  } = options;

  let systemInstruction =
    "You are a helpful AI writing partner in Ink & Quill. You help users refine their documents through conversation.";
  if (personalInstructions) {
    systemInstruction += ` Always follow these style preferences: "${personalInstructions}".`;
  }

  // Get relevant context from RAG
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.parts[0].text || "";
  const recentChatContext = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.parts[0].text)
    .join(" ");

  // 1. Fetch contexts with refined weighting
  // Use passed embeddingOptions if available, otherwise fallback to chat provider (though better to pass)
  const activeEmbeddingOptions = embeddingOptions || {
    provider,
    apiKey: apiKeys?.[provider as keyof typeof apiKeys],
    model: provider === "google" ? "text-embedding-004" : undefined,
  };

  // Weights: Current Query (1.0) - Removed cursor area and recent conversation per user request
  const weightedContext = await ragService.getWeightedContext(
    [
      { text: lastUserMessage, weight: 1.0 },
    ],
    5,
    activeEmbeddingOptions,
  );

  const globalSummary = await ragService.getGlobalSummary(documentContext);
  const cursorSection = await ragService.getCursorSectionInfo(
    documentContext,
    cursorContext,
  );
  const relevantEpisodes = await ragService.getRelevantEpisodes(
    lastUserMessage,
    3,
    activeEmbeddingOptions,
  );

  // Token budget estimation (rough: 4 chars per token)
  const MAX_TOKENS = 4000;
  let currentTokens = ragService.estimateTokens(systemInstruction);

  // Add structural map (High Priority for orientation)
  if (globalSummary) {
    const summaryText = `\n\n### DOCUMENT HIERARCHY & SUMMARY ###\n${globalSummary}`;
    systemInstruction += summaryText;
    currentTokens += ragService.estimateTokens(summaryText);
  }

  // Removed explicit focus markers per user request for no cursor position
  if (false && cursorContext) {
    const focusHeader = cursorSection
      ? `[Currently in Section: "${cursorSection}"]`
      : "";
    const focusSection = `\n\n### CURRENT WRITING FOCUS ${focusHeader} ###\n${cursorContext}\n\n[INSTRUCTION: The user is currently editing or writing near the text above. Prioritize this area for immediate contextual relevance.]`;
    systemInstruction += focusSection;
    currentTokens += ragService.estimateTokens(focusSection);
  }

  // 2. Budget aware inclusion of semantic chunks vs full doc
  const docTokens = ragService.estimateTokens(documentContext);
  const semanticTokens = weightedContext
    ? ragService.estimateTokens(weightedContext)
    : 0;

  // Decide whether to include full document or just semantic clips
  // If doc is small enough to fit alongside semantic clips, include both for maximum coherence
  if (
    docTokens < 1800 &&
    currentTokens + docTokens + semanticTokens < MAX_TOKENS
  ) {
    systemInstruction += `\n\n### FULL DOCUMENT REFERENCE ###\n${documentContext}`;
    currentTokens += docTokens;
  }

  // Always include weighted semantic chunks if available, as they represent the multi-dimensional "hit"
  if (weightedContext && currentTokens < MAX_TOKENS) {
    const available = MAX_TOKENS - currentTokens;
    const clipsText = `\n\n### RELEVANT KNOWLEDGE CLIPS (Weighted Retrieval) ###\n${ragService.trimToTokens(weightedContext, available)}`;
    systemInstruction += clipsText;
    currentTokens += ragService.estimateTokens(clipsText);
  }

  // 3. Episodic Memory (lowest priority) - Removed per user request to not include recent chat history
  if (false && relevantEpisodes && currentTokens < MAX_TOKENS) {
    const available = MAX_TOKENS - currentTokens;
    if (available > 100) {
      const epSection = `\n\n### CORRELATED PAST DISCUSSIONS ###\n${ragService.trimToTokens(relevantEpisodes, available)}`;
      systemInstruction += epSection;
    }
  }

  systemInstruction += `\n\n### FINAL DIRECTIVE ###\nYou are an embedded writing partner. Act as if you are looking at the document alongside the user. Refer to specific sections by name when possible. If the context is insufficient, ask clarifying questions rather than hallucinating facts.`;

  const formattedMessages = [
    { role: "system", content: systemInstruction },
    ...messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "model" ? "assistant" : m.role,
        content: m.parts[0].text,
        images: m.images,
      })),
  ];

  const aiProvider = getProvider(provider, { apiKeys, providerConfigs });
  return await aiProvider.chat(formattedMessages, model, onChunk);
};

export const checkOllamaConnection = async (
  selectedModel?: string,
): Promise<{
  success: boolean;
  model?: string;
  allModels: string[];
  error?: string;
}> => {
  try {
    const response = await fetch(`/api/ai/tags`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];
    const modelToUse =
      selectedModel && models.includes(selectedModel)
        ? selectedModel
        : models[0] || "None";

    return {
      success: true,
      model: modelToUse,
      allModels: models,
    };
  } catch (error) {
    return {
      success: false,
      allModels: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
