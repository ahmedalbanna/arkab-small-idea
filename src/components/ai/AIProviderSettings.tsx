import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Cpu, X, ChevronDown, Edit3, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAIStore } from "../../stores/aiStore";
import { useUIStore } from "../../stores/uiStore";

import { STATIC_MODELS } from "../../constants";
import { getDefaultTemplates } from "../../services/promptTemplates";
import type { PromptTemplate } from "../../services/promptTemplates";

interface AIProviderSettingsProps {
  aiSettingsTab: "actions" | "semantic" | "embeddings";
  setAiSettingsTab: React.Dispatch<React.SetStateAction<"actions" | "semantic" | "embeddings">>;
}

export const AIProviderSettings: React.FC<AIProviderSettingsProps> = ({
  aiSettingsTab,
  setAiSettingsTab,
}) => {
  const { showAiSettings, setAiSettings } = useUIStore();
  const {
    serviceConfigs,
    setServiceProvider,
    setServiceModel,
    availableModels,
    apiKeys,
    setApiKey,
    providerConfigs,
    setOllamaHost,
    personalInstructions: aiPersonalInstructions,
    setPersonalInstructions: setAiPersonalInstructions,
    promptTemplates,
    setPromptTemplate,
    resetPromptTemplate,
    resetAllPromptTemplates,
  } = useAIStore();

  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  // Build the effective template list (defaults merged with user overrides)
  const defaultTemplates = getDefaultTemplates();
  const effectiveTemplates = defaultTemplates.map((tpl) => {
    const override = promptTemplates[tpl.id];
    if (!override) return tpl;
    return { ...tpl, ...override };
  });

  const handleEditTemplate = (tpl: PromptTemplate) => {
    setEditingTemplate({ ...tpl });
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    setPromptTemplate(editingTemplate.id, {
      systemPrompt: editingTemplate.systemPrompt,
      userPrompt: editingTemplate.userPrompt,
    });
    setEditingTemplate(null);
  };

  const handleResetTemplate = (id: string) => {
    resetPromptTemplate(id);
  };

  const handleResetAll = () => {
    if (window.confirm("Reset all prompt templates to defaults? This cannot be undone.")) {
      resetAllPromptTemplates();
    }
  };

  return (
    <AnimatePresence>
      {showAiSettings && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAiSettings(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed top-0 end-0 bottom-0 w-full md:w-[400px] bg-minimal-bg border-s border-minimal-border z-[70] shadow-2xl flex flex-col"
          >
            <div className="p-4 md:p-6 border-b border-minimal-border flex justify-between items-center bg-minimal-sidebar">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-minimal-accent flex items-center justify-center text-white shadow-lg">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-minimal-text uppercase tracking-widest leading-none">
                    AI Provider Settings
                  </h2>
                  <p className="text-[9px] text-minimal-muted font-bold uppercase tracking-tight mt-1">
                    Multi-service Engine Config
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAiSettings(false)}
                aria-label="Close AI settings"
                className="rounded-full p-2 text-minimal-muted transition-colors hover:bg-minimal-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
              {/* Service Tabs */}
              <div className="flex bg-minimal-sidebar rounded-xl p-1 gap-1">
                {(["actions", "semantic", "embeddings"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAiSettingsTab(tab)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[9px] font-bold uppercase transition-all tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
                      aiSettingsTab === tab
                        ? "bg-minimal-bg text-minimal-accent shadow-sm"
                        : "text-minimal-muted hover:text-minimal-text",
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Provider Selection for Active Tab */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">
                    {aiSettingsTab.toUpperCase()} Provider
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(["ollama", "openai", "anthropic", "google", "pipeline"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setServiceProvider(aiSettingsTab, p);
                          // Auto-select a default model for the provider
                          const defaultModel =
                            STATIC_MODELS[p]?.[0] || (p === "ollama" ? "mistral" : "");
                          if (defaultModel) setServiceModel(aiSettingsTab, defaultModel);
                        }}
                        className={cn(
                          "rounded-xl border px-1 py-2 text-[9px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent",
                          serviceConfigs[aiSettingsTab].provider === p
                            ? "border-minimal-accent bg-minimal-accent text-white shadow-lg shadow-minimal-accent/20"
                            : "border-minimal-border bg-minimal-sidebar text-minimal-muted hover:border-minimal-accent/30",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Selection for Active Tab */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">
                    {aiSettingsTab.toUpperCase()} Model
                  </h3>
                  <div className="relative group/model">
                    <select
                      value={serviceConfigs[aiSettingsTab].model}
                      onChange={(e) => setServiceModel(aiSettingsTab, e.target.value)}
                      className="w-full appearance-none rounded-xl border border-minimal-border bg-minimal-sidebar px-4 py-3 text-xs font-bold uppercase tracking-wide text-minimal-text outline-none transition-all focus:border-minimal-accent focus-visible:ring-2 focus-visible:ring-minimal-accent cursor-pointer group-hover/model:border-minimal-accent/50"
                    >
                      {serviceConfigs[aiSettingsTab].provider === "ollama" ? (
                        availableModels.length > 0 ? (
                          availableModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))
                        ) : (
                          <option value={serviceConfigs[aiSettingsTab].model}>
                            {serviceConfigs[aiSettingsTab].model} (Loading...)
                          </option>
                        )
                      ) : (
                        STATIC_MODELS[serviceConfigs[aiSettingsTab].provider]?.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-minimal-muted">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* API Keys (Global per provider, but shown here for context) */}
                <div className="pt-2">
                  {serviceConfigs[aiSettingsTab].provider === "ollama" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">
                        Ollama Host (Proxy)
                      </h3>
                      <input
                        type="text"
                        value={providerConfigs.ollama.host || "/api/ai"}
                        onChange={(e) => setOllamaHost(e.target.value)}
                        placeholder="/api/ai"
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none transition-all focus:border-minimal-accent focus-visible:ring-2 focus-visible:ring-minimal-accent"
                      />
                    </div>
                  )}

                  {serviceConfigs[aiSettingsTab].provider === "openai" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">
                        OpenAI API Key
                      </h3>
                      <input
                        type="password"
                        value={apiKeys.openai}
                        onChange={(e) => setApiKey("openai", e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none transition-all focus:border-minimal-accent focus-visible:ring-2 focus-visible:ring-minimal-accent"
                      />
                    </div>
                  )}

                  {serviceConfigs[aiSettingsTab].provider === "anthropic" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">
                        Anthropic API Key
                      </h3>
                      <input
                        type="password"
                        value={apiKeys.anthropic}
                        onChange={(e) => setApiKey("anthropic", e.target.value)}
                        placeholder="x-api-key..."
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none transition-all focus:border-minimal-accent focus-visible:ring-2 focus-visible:ring-minimal-accent"
                      />
                    </div>
                  )}

                  {serviceConfigs[aiSettingsTab].provider === "google" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">
                        Google Gemini API Key
                      </h3>
                      <input
                        type="password"
                        value={apiKeys.google}
                        onChange={(e) => setApiKey("google", e.target.value)}
                        placeholder="AIza..."
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none transition-all focus:border-minimal-accent focus-visible:ring-2 focus-visible:ring-minimal-accent"
                      />
                    </div>
                  )}

                  <p className="text-[9px] text-minimal-muted mt-2">
                    Keys are kept in memory only and are never saved or synced. Re-enter them after
                    refreshing the page.
                  </p>
                </div>
              </div>

              {/* Prompt Templates Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">
                    Prompt Templates
                  </h3>
                  <button
                    onClick={handleResetAll}
                    className="text-[9px] font-bold text-minimal-muted hover:text-red-500 transition-colors uppercase"
                  >
                    Reset All
                  </button>
                </div>

                <p className="text-[9px] text-minimal-muted">
                  Customize system and user prompts per action. Placeholders:
                  {"{text}"}, {"{personalInstructions}"}, {"{customInstruction}"}
                </p>

                <div className="space-y-2">
                  {effectiveTemplates.map((tpl) => {
                    const isCustomized = !!promptTemplates[tpl.id];
                    return (
                      <div
                        key={tpl.id}
                        className="rounded-xl border border-minimal-border bg-minimal-sidebar p-2.5"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <span className="text-xs font-bold text-minimal-text">{tpl.label}</span>
                            <span className="text-[9px] text-minimal-muted/60 ml-1">
                              ({tpl.id})
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {isCustomized && (
                              <span className="text-[8px] text-minimal-accent font-bold">
                                CUSTOM
                              </span>
                            )}
                            <button
                              onClick={() => handleEditTemplate(tpl)}
                              aria-label={`Edit ${tpl.label} template`}
                              className="rounded-lg p-1 text-minimal-muted transition-colors hover:bg-minimal-border hover:text-minimal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            {isCustomized && (
                              <button
                                onClick={() => handleResetTemplate(tpl.id)}
                                aria-label={`Reset ${tpl.label} template`}
                                className="rounded-lg p-1 text-minimal-muted transition-colors hover:bg-minimal-border hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimal-accent"
                                title="Reset to default"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-[9px] text-minimal-muted/60 truncate">
                          {tpl.systemPrompt.slice(0, 80)}...
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-minimal-border">
              <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">
                Writer Identity
              </h3>
              <button
                onClick={() => setAiPersonalInstructions("")}
                className="text-[9px] font-bold text-minimal-muted hover:text-red-500 transition-colors uppercase"
              >
                Reset
              </button>
            </div>
            <div className="bg-minimal-accent/5 border border-minimal-accent/20 rounded-2xl p-4">
              <p className="text-[10px] text-minimal-accent font-bold mb-2 uppercase tracking-wide">
                Writing Voice Profile
              </p>
              <textarea
                value={aiPersonalInstructions}
                onChange={(e) => setAiPersonalInstructions(e.target.value)}
                placeholder="Specify your style preferences (e.g., 'Formal tone', 'Short paragraphs')..."
                className="w-full h-32 bg-transparent border-none p-0 text-xs focus:ring-0 outline-none transition-all resize-none font-medium leading-relaxed text-minimal-text placeholder:text-minimal-muted/40"
              />
              <div className="mt-2 flex items-center gap-2 border-t border-minimal-accent/10 pt-2">
                <div className="w-2 h-2 rounded-full bg-minimal-accent animate-pulse" />
                <span className="text-[9px] font-bold text-minimal-accent/70 uppercase">
                  Global Style Overlay Active
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Template Editor Modal */}
      <AnimatePresence>
        {editingTemplate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTemplate(null)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            >
              <div className="w-full max-w-2xl bg-minimal-bg border border-minimal-border rounded-2xl shadow-2xl">
                <div className="p-4 border-b border-minimal-border flex justify-between items-center">
                  <h3 className="text-sm font-bold text-minimal-text uppercase tracking-wider">
                    Edit: {editingTemplate.label}
                  </h3>
                  <button
                    onClick={() => setEditingTemplate(null)}
                    className="rounded-full p-1 text-minimal-muted hover:bg-minimal-border focus-visible:ring-2 focus-visible:ring-minimal-accent"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4 custom-scrollbar overflow-y-auto max-h-[60vh]">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-minimal-muted uppercase tracking-wider">
                      System Prompt
                    </label>
                    <textarea
                      value={editingTemplate.systemPrompt}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, systemPrompt: e.target.value })
                      }
                      className="w-full h-32 bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none transition-all focus:border-minimal-accent focus-visible:ring-2 focus-visible:ring-minimal-accent resize-none"
                      placeholder="Enter system prompt..."
                    />
                    <p className="text-[8px] text-minimal-muted/60">
                      Available placeholders: {"{personalInstructionsSegment}"}, {"{text}"},{" "}
                      {"{customInstruction}"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-minimal-muted uppercase tracking-wider">
                      User Prompt
                    </label>
                    <textarea
                      value={editingTemplate.userPrompt}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, userPrompt: e.target.value })
                      }
                      className="w-full h-24 bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none transition-all focus:border-minimal-accent focus-visible:ring-2 focus-visible:ring-minimal-accent resize-none"
                      placeholder="Enter user prompt template..."
                    />
                    <p className="text-[8px] text-minimal-muted/60">
                      Available placeholders: {"{text}"}, {"{customInstruction}"}, {"{context}"}
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-minimal-border flex justify-end gap-2">
                  <button
                    onClick={() => setEditingTemplate(null)}
                    className="px-3 py-1.5 text-xs font-bold text-minimal-muted hover:text-minimal-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-minimal-accent rounded-xl hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-minimal-accent"
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};
