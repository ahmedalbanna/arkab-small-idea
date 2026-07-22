import { ragService } from "./ragService";
import {
  type AIAssistantAction,
  type ChatMessage,
  type AIProvider,
  getProvider,
} from "./providers";
import { actionBucket, chatBucket } from "./rateLimiter";
import { buildSystemPrompt, buildUserPrompt } from "./promptTemplates";
import type { TemplateOverrides } from "./promptTemplates";
import { estimateTokens } from "./tokenMonitor";
import { useAIStore } from "../stores/aiStore";

// Re-export everything from providers for backward compatibility
export type { AIAssistantAction, ChatMessage, AIProvider };
export {
  GoogleProvider,
  PipelineProvider,
  OllamaProvider,
  OpenAIProvider,
  AnthropicProvider,
  getProvider,
} from "./providers";

/**
 * Get the model's max token limit from the store, falling back to a sensible
 * default if the model is unknown.
 */
function getModelMaxTokens(model: string): number {
  const limits = useAIStore.getState().modelTokenLimits;
  return limits[model] ?? 8192;
}

/**
 * Truncate text to fit within a token budget, preserving the beginning and end.
 * Uses rough estimation (chars/4) to avoid expensive encoding.
 */
function truncateToTokenBudget(
  text: string,
  maxTokens: number,
  reserveTokens: number = 512,
): string {
  const budget = maxTokens - reserveTokens;
  if (budget <= 0) return "";
  const estimated = estimateTokens(text);
  if (estimated <= budget) return text;

  // Cut proportionally: remove from the middle if too long
  const ratio = budget / estimated;
  const targetChars = Math.floor(text.length * ratio * 0.9); // 10% safety margin

  if (targetChars <= 100) return text.slice(0, 100);

  // Keep first and last portions, remove from middle
  const keepHead = Math.floor(targetChars * 0.6);
  const keepTail = Math.floor(targetChars * 0.3);
  return text.slice(0, keepHead) + "\n\n[... truncated ...]\n\n" + text.slice(-keepTail);
}

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
    /** Free-form instruction appended to the system prompt. */
    customInstruction?: string;
    /** Prompt template overrides. */
    templateOverrides?: TemplateOverrides;
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
    customInstruction,
    templateOverrides,
  } = options;

  // Build system prompt from templates
  const systemInstruction = buildSystemPrompt(
    action,
    { text, personalInstructions, customInstruction, cursorSection: cursorContext },
    templateOverrides,
    documentContext,
  );

  // Build user prompt from templates
  const prompt = buildUserPrompt(action, { text, customInstruction }, templateOverrides);

  // Use RAG to get broad document context for the specific selection
  let ragContext = "";
  if (documentContext) {
    ragContext = await ragService.getWeightedContext(
      [
        { text, weight: 1.0 },
        { text: cursorContext, weight: 0.5 },
      ],
      3,
    );
  }

  // Check token budget and truncate if needed
  const maxTokens = getModelMaxTokens(model);
  const estimatedPromptTokens = estimateTokens(systemInstruction + prompt + ragContext);

  let finalPrompt = prompt;
  if (estimatedPromptTokens > maxTokens * 0.8) {
    // Truncate the user text to fit
    finalPrompt = truncateToTokenBudget(prompt, maxTokens, 1024);
  }

  let finalSystem = systemInstruction;
  if (ragContext) {
    finalSystem += `\n\n### BROADER DOCUMENT CONTEXT ###\nUse the following relevant document sections to ensure your changes are cohesive with the rest of the work:\n${ragContext}`;
  }

  if (customInstruction && !systemInstruction.includes("{customInstruction}")) {
    finalSystem += ` Additional user instruction for this action: "${customInstruction}".`;
  }

  // Apply client-side rate limiting before making the API call
  if (!actionBucket.tryConsume(1)) {
    throw new Error("Rate limited. Please wait a moment before requesting another AI action.");
  }

  const aiProvider = getProvider(provider, { apiKeys, providerConfigs });
  return await aiProvider.generate(finalPrompt, finalSystem, model, onChunk, signal);
};

export const generateContentFromPrompt = async (
  userInput: string,
  _context: string = "",
  options: {
    personalInstructions?: string;
    model?: string;
    provider?: string;
    apiKeys?: any;
    providerConfigs?: any;
    onChunk?: (chunk: string) => void;
    signal?: AbortSignal;
    templateOverrides?: TemplateOverrides;
  },
): Promise<string> => {
  const {
    personalInstructions = "",
    model = "mistral",
    provider = "ollama",
    apiKeys,
    providerConfigs,
    onChunk,
    signal,
    templateOverrides,
  } = options;

  const systemInstruction = buildSystemPrompt(
    "generate",
    { text: userInput, personalInstructions },
    templateOverrides,
  );

  const prompt = buildUserPrompt("generate", { text: userInput }, templateOverrides);

  if (!chatBucket.tryConsume(1)) {
    throw new Error("Rate limited. Please wait a moment before generating more content.");
  }

  const aiProvider = getProvider(provider, { apiKeys, providerConfigs });
  return await aiProvider.generate(prompt, systemInstruction, model, onChunk, signal);
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
    signal?: AbortSignal;
    templateOverrides?: TemplateOverrides;
  },
): Promise<string> => {
  const {
    personalInstructions = "",
    model = "mistral",
    provider = "ollama",
    apiKeys,
    providerConfigs,
    onChunk,
    cursorContext: _cursorContext = "",
    embeddingOptions,
    signal,
    templateOverrides,
  } = options;

  // Build system prompt from chat template
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.parts[0].text || "";

  let systemInstruction = buildSystemPrompt(
    "chat",
    { text: lastUserMessage, personalInstructions },
    templateOverrides,
    documentContext,
  );

  // Get relevant context from RAG
  const activeEmbeddingOptions = embeddingOptions || {
    provider,
    apiKey: apiKeys?.[provider as keyof typeof apiKeys],
    model: provider === "google" ? "text-embedding-004" : undefined,
  };

  const weightedContext = await ragService.getWeightedContext(
    [{ text: lastUserMessage, weight: 1.0 }],
    5,
    activeEmbeddingOptions,
  );

  const globalSummary = await ragService.getGlobalSummary(documentContext);

  // Token-aware context window management
  const maxTokens = getModelMaxTokens(model);
  let currentTokens = ragService.estimateTokens(systemInstruction);

  // Add structural map (High Priority for orientation)
  if (globalSummary) {
    const summaryText = `\n\n### DOCUMENT HIERARCHY & SUMMARY ###\n${globalSummary}`;
    systemInstruction += summaryText;
    currentTokens += ragService.estimateTokens(summaryText);
  }

  // Budget aware inclusion of semantic chunks vs full doc
  const docTokens = ragService.estimateTokens(documentContext);
  const semanticTokens = weightedContext ? ragService.estimateTokens(weightedContext) : 0;
  const contextBudget = Math.floor(maxTokens * 0.6); // Use up to 60% of model limit for context

  // If doc is small enough to fit alongside semantic clips, include both
  if (docTokens < 1800 && currentTokens + docTokens + semanticTokens < contextBudget) {
    systemInstruction += `\n\n### FULL DOCUMENT REFERENCE ###\n${documentContext}`;
    currentTokens += docTokens;
  }

  // Always include weighted semantic chunks if available, within budget
  if (weightedContext && currentTokens < contextBudget) {
    const available = contextBudget - currentTokens;
    const clipsText = `\n\n### RELEVANT KNOWLEDGE CLIPS (Weighted Retrieval) ###\n${ragService.trimToTokens(weightedContext, available)}`;
    systemInstruction += clipsText;
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

  if (!chatBucket.tryConsume(1)) {
    throw new Error("Rate limited. Please wait a moment before sending another message.");
  }

  const aiProvider = getProvider(provider, { apiKeys, providerConfigs });
  return await aiProvider.chat(formattedMessages, model, onChunk, signal);
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
      selectedModel && models.includes(selectedModel) ? selectedModel : models[0] || "None";

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
