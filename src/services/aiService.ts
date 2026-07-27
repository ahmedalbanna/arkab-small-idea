import { getRagServiceSafe } from "./serviceContainer";
import {
  type AIAssistantAction,
  type ChatMessage,
  type AIProvider,
  getProvider,
} from "./providers";
import { actionBucket } from "./rateLimiter";
import { buildSystemPrompt, buildUserPrompt } from "./promptTemplates";
import type { TemplateOverrides } from "./promptTemplates";
import { estimateTokens, tokenTracker } from "./tokenMonitor";
import { buildSmartContext, assembleContextString } from "./smartContextBuilder";

/**
 * The scope of an AI action — determines which text is sent to the model.
 * - `"sel"`:     The current user selection (or collapsed block).
 * - `"section"`: The heading-bounded section the cursor is in.
 * - `"doc"`:     The entire active document.
 */
export type ActionScope = "sel" | "section" | "doc";

/**
 * Human-readable labels for each scope, used in user-facing prompt text.
 */
export const SCOPE_LABELS: Record<ActionScope, string> = {
  sel: "the selected text",
  section: "the current section",
  doc: "the full document",
};

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  warning?: string;
  error?: string;
}

/**
 * Validate AI action inputs before sending to the provider.
 * Returns a result with an optional warning or error.
 * Callers should display the warning to the user and abort on error.
 */
export function validateAIActionInput(
  text: string,
  action: AIAssistantAction,
  scope: ActionScope,
): ValidationResult {
  if (!text.trim()) {
    return { valid: false, error: "No text selected or available to process." };
  }

  if (scope === "doc" && text.length > 50000) {
    return {
      valid: true,
      warning:
        "The document is very large (>50K characters). This action may be slow and expensive in tokens.",
    };
  }

  if (scope === "sel" && text.length > 10000) {
    return {
      valid: true,
      warning:
        "Your selection is large (>10K characters). The result may take time. Consider using a section-level action instead.",
    };
  }

  return { valid: true };
}

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
  /** Per-model token limit overrides (from aiStore; absent = use defaults). */
  modelTokenLimits?: Record<string, number>;
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
    modelTokenLimits,
    documentContext = "",
    cursorContext = "",
    onChunk,
    signal,
    templateOverrides,
  } = params;

  return processAIAction(text, action, {
    modelTokenLimits,
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
 * Default per-model token limits (used when no limits are passed from the
 * caller — keeps the function pure when called without store context).
 */
const DEFAULT_MODEL_LIMITS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-3.5-turbo": 16385,
  "claude-3-5-sonnet-20240620": 200000,
  "gemini-1.5-pro": 1048576,
  "qwen2.5:0.5b": 32768,
  mistral: 8192,
  "llama3.2": 8192,
};

/**
 * Get the model's max token limit, falling back to a sensible default if the
 * model is unknown. Accepts optional overrides so callers can inject their own
 * limits (e.g. from the persisted settings store).
 */
function getModelMaxTokens(model: string, modelTokenLimits?: Record<string, number>): number {
  const limits = modelTokenLimits ?? DEFAULT_MODEL_LIMITS;
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
    modelTokenLimits?: Record<string, number>;
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
    modelTokenLimits,
    onChunk,
    documentContext = "",
    cursorContext = "",
    signal,
    customInstruction,
    templateOverrides,
    scope = "sel",
  } = options;

  const scopeLabel = SCOPE_LABELS[scope];

  // Build system prompt from templates (pass scope for scope-aware templates)
  const systemInstruction = buildSystemPrompt(
    action,
    { text, personalInstructions, customInstruction, cursorSection: cursorContext, scope },
    templateOverrides,
    documentContext,
  );

  // Build user prompt from templates (pass scope for {scope} placeholder)
  const prompt = buildUserPrompt(action, { text, customInstruction, scope }, templateOverrides);

  // -----------------------------------------------------------------------
  // Smart context assembly (three-layer: summary + section + RAG chunks)
  // -----------------------------------------------------------------------
  const maxTokens = getModelMaxTokens(model, modelTokenLimits);
  const estimatedPromptTokens = estimateTokens(systemInstruction + prompt);

  let finalSystem = systemInstruction;
  let finalPrompt = prompt;

  if (scope !== "doc" && documentContext) {
    const ragSvc = getRagServiceSafe();

    const smartContext = await buildSmartContext({
      documentContent: documentContext,
      sectionContent: "",
      actionText: text,
      cursorContext,
      modelMaxTokens: maxTokens,
      estimatedPromptTokens,
      ragService: ragSvc,
      actionTokenLimit: getModelMaxTokens(model, modelTokenLimits),
    });

    // Assemble the context string and append to system prompt
    const contextString = assembleContextString(smartContext);
    if (contextString) {
      finalSystem += `\n\n### DOCUMENT CONTEXT ###\n${contextString}`;
    }

    // Append warning for huge documents
    if (smartContext.warning) {
      finalSystem += `\n\n⚠️ ${smartContext.warning}`;
    }
  }

  // -----------------------------------------------------------------------
  // Token budget check and truncation
  // -----------------------------------------------------------------------
  const estimatedTotalTokens = estimateTokens(finalSystem + finalPrompt);

  if (estimatedTotalTokens > maxTokens * 0.8) {
    // Truncate the user text to fit
    finalPrompt = truncateToTokenBudget(finalPrompt, maxTokens, 1024);
  }

  if (customInstruction && !systemInstruction.includes("{customInstruction}")) {
    finalSystem += ` Additional user instruction for this action: "${customInstruction}".`;
  }

  // Apply client-side rate limiting before making the API call
  if (!actionBucket.tryConsume(1)) {
    throw new Error("Rate limited. Please wait a moment before requesting another AI action.");
  }

  // -----------------------------------------------------------------------
  // Execute the provider call and track token usage
  // -----------------------------------------------------------------------
  const aiProvider = getProvider(provider, { apiKeys, providerConfigs });

  let fullResponse = "";
  const wrappedOnChunk = onChunk
    ? (chunk: string) => {
        fullResponse += chunk;
        onChunk(chunk);
      }
    : undefined;

  try {
    const result = await aiProvider.generate(
      finalPrompt,
      finalSystem,
      model,
      wrappedOnChunk,
      signal,
    );

    // Track token usage per scope type
    const promptTokens = estimateTokens(finalPrompt + finalSystem);
    const completionTokens = estimateTokens(fullResponse || result);
    tokenTracker.reportUsage({
      provider,
      model,
      action: "action",
      promptTokens,
      completionTokens,
      timestamp: new Date().toISOString(),
      scope,
    });

    return result;
  } catch (error) {
    // Track even failed attempts for monitoring
    const promptTokens = estimateTokens(finalPrompt + finalSystem);
    tokenTracker.reportUsage({
      provider,
      model,
      action: "action",
      promptTokens,
      completionTokens: 0,
      timestamp: new Date().toISOString(),
      scope,
    });
    throw error;
  }
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
