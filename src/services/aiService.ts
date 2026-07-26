import { ragService } from "./ragService";
import {
  type AIAssistantAction,
  type ChatMessage,
  type AIProvider,
  getProvider,
} from "./providers";
import { actionBucket } from "./rateLimiter";
import { buildSystemPrompt, buildUserPrompt } from "./promptTemplates";
import type { TemplateOverrides } from "./promptTemplates";
import { estimateTokens } from "./tokenMonitor";
import { useAIStore } from "../stores/aiStore";

/**
 * The scope of an AI action — determines which text is sent to the model.
 * - `"sel"`:     The current user selection (or collapsed block).
 * - `"section"`: The heading-bounded section the cursor is in.
 * - `"doc"`:     The entire active document.
 */
export type ActionScope = "sel" | "section" | "doc";

/**
 * Unified parameters for the single entry point `executeAIAction`.
 * All AI action paths (keymaps, command palette, toolbar, bubble menu, context
 * menu) converge here.
 */
export interface ExecuteAIActionParams {
  /** The text content to operate on. */
  text: string;
  /** The action to perform (improve, fix-grammar, rewrite, etc.). */
  action: AIAssistantAction;
  /** Which portion of the document this text represents. */
  scope: ActionScope;
  /** Optional user instruction appended to the prompt. */
  customInstruction?: string;
  /** Free-form personal instructions from the user's settings. */
  personalInstructions?: string;
  /** AI model identifier (e.g. "mistral", "gpt-4"). */
  model?: string;
  /** Provider name (e.g. "ollama", "openai", "anthropic", "gemini"). */
  provider?: string;
  /** API keys keyed by provider. */
  apiKeys?: Record<string, string>;
  /** Provider-specific config overrides. */
  providerConfigs?: Record<string, any>;
  /** Full document markdown (used for RAG context + structure extraction). */
  documentContext?: string;
  /** Cursor / heading path context. */
  cursorContext?: string;
  /** Called incrementally with each streamed token. */
  onChunk?: (chunk: string) => void;
  /** Abort signal to cancel the request. */
  signal?: AbortSignal;
  /** Prompt template overrides. */
  templateOverrides?: TemplateOverrides;
}

/**
 * SINGLE UNIFIED ENTRY POINT for all AI editing actions.
 *
 * All five entry paths (keyboard shortcuts, command palette, floating toolbar,
 * bubble menu, context menu) converge here. Previously each path built its own
 * parameter set with subtle differences in scope handling; this function
 * provides a consistent contract:
 *
 *  1. Build the system + user prompts via promptTemplates.
 *  2. Retrieve optional RAG context for awareness.
 *  3. Enforce token budget (truncate if needed).
 *  4. Apply client-side rate limiting.
 *  5. Call the configured AI provider with streaming support.
 *  6. Return the full response text.
 *
 * @returns The complete AI-generated text.
 * @throws If rate-limited (Error), aborted (AbortError), or provider fails.
 */
export async function executeAIAction(params: ExecuteAIActionParams): Promise<string> {
  const {
    text,
    action,
    scope,
    customInstruction,
    personalInstructions = "",
    model = "mistral",
    provider = "ollama",
    apiKeys,
    providerConfigs,
    documentContext = "",
    cursorContext = "",
    onChunk,
    signal,
    templateOverrides,
  } = params;

  return processAIAction(text, action, {
    personalInstructions,
    model,
    provider,
    apiKeys,
    providerConfigs,
    onChunk,
    documentContext,
    cursorContext,
    signal,
    customInstruction,
    templateOverrides,
    scope,
  });
}

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
    /** Scope of the action (sel / section / doc). */
    scope?: ActionScope;
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
    finalSystem += `\n\n### REFERENCE CONTEXT (for awareness only) ###\nThe following sections from the document are provided for context awareness only. Do NOT reference or incorporate content from these sections into your response. Only modify the selected text.\n\n${ragContext}`;
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
