import { ragService } from "./ragService";
import {
  type AIAssistantAction,
  type ChatMessage,
  type AIProvider,
  getProvider,
} from "./providers";

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
  } = options;

  let systemInstruction =
    "You are a precise writing assistant integrated into Ink & Quill. Your goal is to help the user refine their document. ";
  if (personalInstructions) {
    systemInstruction += `The user has specified these stylistic preferences: "${personalInstructions}". Please adhere to them while performing the action. `;
  }
  if (customInstruction) {
    systemInstruction += `Additional user instruction for this action: "${customInstruction}". `;
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

  let prompt: string;

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
      systemInstruction += "Make the following text more concise without losing key information.";
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
    cursorContext: _cursorContext = "",
    embeddingOptions,
    signal,
  } = options;

  let systemInstruction =
    "You are a helpful AI writing partner in Ink & Quill. You help users refine their documents through conversation.";
  if (personalInstructions) {
    systemInstruction += ` Always follow these style preferences: "${personalInstructions}".`;
  }

  // Get relevant context from RAG
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.parts[0].text || "";

  // 1. Fetch contexts with refined weighting
  // Use passed embeddingOptions if available, otherwise fallback to chat provider (though better to pass)
  const activeEmbeddingOptions = embeddingOptions || {
    provider,
    apiKey: apiKeys?.[provider as keyof typeof apiKeys],
    model: provider === "google" ? "text-embedding-004" : undefined,
  };

  // Weights: Current Query (1.0) - Removed cursor area and recent conversation per user request
  const weightedContext = await ragService.getWeightedContext(
    [{ text: lastUserMessage, weight: 1.0 }],
    5,
    activeEmbeddingOptions,
  );

  const globalSummary = await ragService.getGlobalSummary(documentContext);

  let currentTokens = ragService.estimateTokens(systemInstruction);

  // Add structural map (High Priority for orientation)
  if (globalSummary) {
    const summaryText = `\n\n### DOCUMENT HIERARCHY & SUMMARY ###\n${globalSummary}`;
    systemInstruction += summaryText;
    currentTokens += ragService.estimateTokens(summaryText);
  }

  // Cursor focus section intentionally removed per user request

  const MAX_TOKENS = 4000;

  // 2. Budget aware inclusion of semantic chunks vs full doc
  const docTokens = ragService.estimateTokens(documentContext);
  const semanticTokens = weightedContext ? ragService.estimateTokens(weightedContext) : 0;

  // Decide whether to include full document or just semantic clips
  // If doc is small enough to fit alongside semantic clips, include both for maximum coherence
  if (docTokens < 1800 && currentTokens + docTokens + semanticTokens < MAX_TOKENS) {
    systemInstruction += `\n\n### FULL DOCUMENT REFERENCE ###\n${documentContext}`;
    currentTokens += docTokens;
  }

  // Always include weighted semantic chunks if available, as they represent the multi-dimensional "hit"
  if (weightedContext && currentTokens < MAX_TOKENS) {
    const available = MAX_TOKENS - currentTokens;
    const clipsText = `\n\n### RELEVANT KNOWLEDGE CLIPS (Weighted Retrieval) ###\n${ragService.trimToTokens(weightedContext, available)}`;
    systemInstruction += clipsText;
  }

  // Episodic memory intentionally removed per user request

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
