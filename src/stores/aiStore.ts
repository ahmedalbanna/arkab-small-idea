import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type ChatMessage } from "../services/aiService";
import { idbStorage } from "../lib/idbStorage";

interface AIState {
  chatHistory: ChatMessage[];
  personalInstructions: string;
  selectedModel: string;
  availableModels: string[];
  isGenerating: boolean;
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
  addMessage: (msg: ChatMessage) => void;
  setChatHistory: (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  setPersonalInstructions: (instructions: string | ((prev: string) => string)) => void;
  setSelectedModel: (model: string | ((prev: string) => string)) => void;
  setAvailableModels: (models: string[] | ((prev: string[]) => string[])) => void;
  setGenerating: (isGenerating: boolean | ((prev: boolean) => boolean)) => void;
  setOllamaStatus: (
    status: AIState["ollamaStatus"] | ((prev: AIState["ollamaStatus"]) => AIState["ollamaStatus"]),
  ) => void;
  clearChatHistory: () => void;
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
      chatHistory: [] as ChatMessage[],
      personalInstructions: "",
      selectedModel: "qwen2.5:0.5b",
      availableModels: [] as string[],
      isGenerating: false,
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

      addMessage: (msg) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, msg].slice(-100),
        })),
      setChatHistory: (chatHistory) =>
        set((state) => {
          const nextHistory =
            typeof chatHistory === "function" ? chatHistory(state.chatHistory) : chatHistory;
          return {
            chatHistory: nextHistory.slice(-100),
          };
        }),
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
      setGenerating: (isGenerating) =>
        set((state) => ({
          isGenerating:
            typeof isGenerating === "function" ? isGenerating(state.isGenerating) : isGenerating,
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
      clearChatHistory: () => set({ chatHistory: [] }),
    }),
    {
      name: "ink-quill-ai-storage",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        personalInstructions: state.personalInstructions,
        selectedModel: state.selectedModel,
        chatHistory: state.chatHistory,
        provider: state.provider,
        serviceConfigs: state.serviceConfigs,
        providerConfigs: state.providerConfigs,
        // apiKeys are intentionally excluded: they are kept in memory only
        // so they cannot be exfiltrated from persisted storage (IndexedDB).
      }),
    },
  ),
);
