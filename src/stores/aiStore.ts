import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "../lib/idbStorage";
import type { TemplateOverrides } from "../services/promptTemplates";

/** Per-model token limits: maps model name → max total tokens. */
export type ModelTokenLimits = Record<string, number>;

/** Default token limits for known models. */
export const DEFAULT_MODEL_TOKEN_LIMITS: ModelTokenLimits = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-3.5-turbo": 16385,
  "claude-3-5-sonnet-20240620": 200000,
  "claude-3-opus-20240229": 200000,
  "claude-3-haiku-20240307": 200000,
  "gemini-3-flash-preview": 1048576,
  "gemini-1.5-pro": 1048576,
  "gemini-1.5-flash": 1048576,
  "qwen2.5:0.5b": 32768,
  mistral: 8192,
  "llama3.2": 8192,
};

interface AIState {
  personalInstructions: string;
  selectedModel: string;
  availableModels: string[];
  ollamaStatus: {
    loading: boolean;
    connected: boolean;
    model: string;
    error?: string;
  };
  provider: "ollama" | "openai" | "anthropic" | "google" | "pipeline";
  serviceConfigs: {
    chat: { provider: AIState["provider"]; model: string };
    actions: { provider: AIState["provider"]; model: string };
    semantic: { provider: AIState["provider"]; model: string };
    embeddings: { provider: AIState["provider"]; model: string };
  };
  apiKeys: {
    openai: string;
    anthropic: string;
    google: string;
  };
  providerConfigs: {
    ollama: {
      host: string;
    };
    pipeline: {
      model: string;
    };
  };

  /** User-customized prompt template overrides (persisted). */
  promptTemplates: TemplateOverrides;

  /** Per-model token limit overrides (persisted). */
  modelTokenLimits: ModelTokenLimits;

  setServiceProvider: (
    service: keyof AIState["serviceConfigs"],
    provider: AIState["provider"],
  ) => void;
  setServiceModel: (service: keyof AIState["serviceConfigs"], model: string) => void;
  setProvider: (
    provider: AIState["provider"] | ((prev: AIState["provider"]) => AIState["provider"]),
  ) => void;
  setApiKey: (provider: "openai" | "anthropic" | "google", key: string) => void;
  setOllamaHost: (host: string) => void;
  setPersonalInstructions: (instructions: string | ((prev: string) => string)) => void;
  setSelectedModel: (model: string | ((prev: string) => string)) => void;
  setAvailableModels: (models: string[] | ((prev: string[]) => string[])) => void;
  setOllamaStatus: (
    status: AIState["ollamaStatus"] | ((prev: AIState["ollamaStatus"]) => AIState["ollamaStatus"]),
  ) => void;

  /** Update a prompt template override. */
  setPromptTemplate: (
    id: string,
    overrides: Partial<import("../services/promptTemplates").PromptTemplate>,
  ) => void;

  /** Reset a template override to default. */
  resetPromptTemplate: (id: string) => void;

  /** Reset all template overrides. */
  resetAllPromptTemplates: () => void;

  /** Update a per-model token limit. */
  setModelTokenLimit: (model: string, limit: number) => void;
}

/** Embedding options type shared across the app. */
export interface EmbeddingOptions {
  provider?: string;
  apiKey?: string;
  model?: string;
}

/**
 * Read the current embedding configuration from the store.
 * Replaces the copy-pasted `{provider, apiKey, model}` blocks.
 */
export function getEmbeddingOptions(): EmbeddingOptions {
  const { serviceConfigs, apiKeys } = useAIStore.getState();
  return {
    provider: serviceConfigs.embeddings.provider,
    apiKey: apiKeys?.[serviceConfigs.embeddings.provider as keyof typeof apiKeys],
    model: serviceConfigs.embeddings.model,
  };
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      personalInstructions: "",
      selectedModel: "qwen2.5:0.5b",
      availableModels: [] as string[],
      ollamaStatus: {
        loading: false,
        connected: false,
        model: "qwen2.5:0.5b",
      },

      provider: "ollama",
      serviceConfigs: {
        chat: { provider: "ollama", model: "qwen2.5:0.5b" },
        actions: { provider: "ollama", model: "qwen2.5:0.5b" },
        semantic: { provider: "pipeline", model: "Xenova/all-MiniLM-L6-v2" },
        embeddings: { provider: "pipeline", model: "Xenova/all-MiniLM-L6-v2" },
      },
      apiKeys: {
        openai: "",
        anthropic: "",
        google: "",
      },
      providerConfigs: {
        ollama: {
          host: "",
        },
        pipeline: {
          model: "Xenova/all-MiniLM-L6-v2",
        },
      },

      promptTemplates: {} as TemplateOverrides,
      modelTokenLimits: { ...DEFAULT_MODEL_TOKEN_LIMITS },

      setPersonalInstructions: (personalInstructions) =>
        set((state) => ({
          personalInstructions:
            typeof personalInstructions === "function"
              ? personalInstructions(state.personalInstructions)
              : personalInstructions,
        })),
      setSelectedModel: (selectedModel) =>
        set((state) => ({
          selectedModel:
            typeof selectedModel === "function"
              ? selectedModel(state.selectedModel)
              : selectedModel,
        })),
      setAvailableModels: (availableModels) =>
        set((state) => ({
          availableModels:
            typeof availableModels === "function"
              ? availableModels(state.availableModels)
              : availableModels,
        })),
      setOllamaStatus: (ollamaStatus) =>
        set((state) => ({
          ollamaStatus:
            typeof ollamaStatus === "function" ? ollamaStatus(state.ollamaStatus) : ollamaStatus,
        })),
      setProvider: (provider) =>
        set((state) => ({
          provider: typeof provider === "function" ? provider(state.provider) : provider,
        })),
      setServiceProvider: (service, provider) =>
        set((state) => ({
          serviceConfigs: {
            ...state.serviceConfigs,
            [service]: { ...state.serviceConfigs[service], provider },
          },
        })),
      setServiceModel: (service, model) =>
        set((state) => ({
          serviceConfigs: {
            ...state.serviceConfigs,
            [service]: { ...state.serviceConfigs[service], model },
          },
        })),
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),
      setOllamaHost: (host) =>
        set((state) => ({
          providerConfigs: {
            ...state.providerConfigs,
            ollama: { ...state.providerConfigs.ollama, host },
          },
        })),

      setPromptTemplate: (id, overrides) =>
        set((state) => ({
          promptTemplates: {
            ...state.promptTemplates,
            [id]: { ...state.promptTemplates[id], ...overrides },
          },
        })),
      resetPromptTemplate: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.promptTemplates;
          return { promptTemplates: rest };
        }),
      resetAllPromptTemplates: () => set({ promptTemplates: {} }),
      setModelTokenLimit: (model, limit) =>
        set((state) => ({
          modelTokenLimits: { ...state.modelTokenLimits, [model]: limit },
        })),
    }),
    {
      name: "ink-quill-ai-storage",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        personalInstructions: state.personalInstructions,
        selectedModel: state.selectedModel,
        provider: state.provider,
        serviceConfigs: state.serviceConfigs,
        providerConfigs: state.providerConfigs,
        promptTemplates: state.promptTemplates,
        modelTokenLimits: state.modelTokenLimits,
        // apiKeys are intentionally excluded: they are kept in memory only
        // so they cannot be exfiltrated from persisted storage (IndexedDB).
      }),
    },
  ),
);
