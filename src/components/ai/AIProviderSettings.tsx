import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';

import { STATIC_MODELS } from '../../constants';

interface AIProviderSettingsProps {
  aiSettingsTab: 'chat' | 'actions' | 'semantic' | 'embeddings';
  setAiSettingsTab: React.Dispatch<React.SetStateAction<'chat' | 'actions' | 'semantic' | 'embeddings'>>;
}

export const AIProviderSettings: React.FC<AIProviderSettingsProps> = ({
  aiSettingsTab,
  setAiSettingsTab
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
    setPersonalInstructions: setAiPersonalInstructions
  } = useAIStore();

  return (
    <AnimatePresence>
      {showAiSettings && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAiSettings(false)}
            className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm z-[60]"
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
                  <h2 className="text-sm font-bold text-minimal-text uppercase tracking-widest leading-none">AI Provider Settings</h2>
                  <p className="text-[9px] text-minimal-muted font-bold uppercase tracking-tight mt-1">Multi-service Engine Config</p>
                </div>
              </div>
              <button
                onClick={() => setAiSettings(false)}
                className="p-2 hover:bg-minimal-border rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-minimal-muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
              {/* Service Tabs */}
              <div className="flex bg-minimal-sidebar rounded-xl p-1 gap-1">
                {(['chat', 'actions', 'semantic', 'embeddings'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAiSettingsTab(tab)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all tracking-tight",
                      aiSettingsTab === tab 
                        ? "bg-minimal-bg text-minimal-accent shadow-sm"
                        : "text-minimal-muted hover:text-minimal-text"
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
                    {(['ollama', 'openai', 'anthropic', 'google', 'pipeline'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => {
                          setServiceProvider(aiSettingsTab, p);
                          // Auto-select a default model for the provider
                          const defaultModel = STATIC_MODELS[p]?.[0] || (p === 'ollama' ? 'mistral' : '');
                          if (defaultModel) setServiceModel(aiSettingsTab, defaultModel);
                        }}
                        className={cn(
                          "py-2 px-1 rounded-xl border text-[9px] font-bold uppercase transition-all",
                          serviceConfigs[aiSettingsTab].provider === p
                            ? "bg-minimal-accent border-minimal-accent text-white shadow-lg shadow-minimal-accent/20"
                            : "bg-minimal-sidebar border-minimal-border text-minimal-muted hover:border-minimal-accent/30"
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
                      className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-bold text-minimal-text outline-none focus:border-minimal-accent appearance-none cursor-pointer group-hover/model:border-minimal-accent/50 transition-all uppercase tracking-wide px-4"
                    >
                      {serviceConfigs[aiSettingsTab].provider === 'ollama' ? (
                        availableModels.length > 0 ? (
                          availableModels.map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))
                        ) : (
                          <option value={serviceConfigs[aiSettingsTab].model}>{serviceConfigs[aiSettingsTab].model} (Loading...)</option>
                        )
                      ) : (
                        STATIC_MODELS[serviceConfigs[aiSettingsTab].provider]?.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))
                      )}
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-minimal-muted">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* API Keys (Global per provider, but shown here for context) */}
                <div className="pt-2">
                  {serviceConfigs[aiSettingsTab].provider === 'ollama' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">Ollama Host (Proxy)</h3>
                      <input
                        type="text"
                        value={providerConfigs.ollama.host || '/api/ai'}
                        onChange={(e) => setOllamaHost(e.target.value)}
                        placeholder="/api/ai"
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none focus:border-minimal-accent transition-all"
                      />
                    </div>
                  )}

                  {serviceConfigs[aiSettingsTab].provider === 'openai' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">OpenAI API Key</h3>
                      <input
                        type="password"
                        value={apiKeys.openai}
                        onChange={(e) => setApiKey('openai', e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none focus:border-minimal-accent transition-all"
                      />
                    </div>
                  )}

                  {serviceConfigs[aiSettingsTab].provider === 'anthropic' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">Anthropic API Key</h3>
                      <input
                        type="password"
                        value={apiKeys.anthropic}
                        onChange={(e) => setApiKey('anthropic', e.target.value)}
                        placeholder="x-api-key..."
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none focus:border-minimal-accent transition-all"
                      />
                    </div>
                  )}

                  {serviceConfigs[aiSettingsTab].provider === 'google' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">Google Gemini API Key</h3>
                      <input
                        type="password"
                        value={apiKeys.google}
                        onChange={(e) => setApiKey('google', e.target.value)}
                        placeholder="AIza..."
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl p-3 text-xs font-medium text-minimal-text outline-none focus:border-minimal-accent transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-minimal-border">
                <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-wider">Writer Identity</h3>
                <button
                  onClick={() => setAiPersonalInstructions("")}
                  className="text-[9px] font-bold text-minimal-muted hover:text-red-500 transition-colors uppercase"
                >
                  Reset
                </button>
              </div>
              <div className="bg-minimal-accent/5 border border-minimal-accent/20 rounded-2xl p-4">
                <p className="text-[10px] text-minimal-accent font-bold mb-2 uppercase tracking-wide">Writing Voice Profile</p>
                <textarea
                  value={aiPersonalInstructions}
                  onChange={(e) => setAiPersonalInstructions(e.target.value)}
                  placeholder="Specify your style preferences (e.g., 'Formal tone', 'Short paragraphs')..."
                  className="w-full h-32 bg-transparent border-none p-0 text-xs focus:ring-0 outline-none transition-all resize-none font-medium leading-relaxed text-minimal-text placeholder:text-minimal-muted/40"
                />
                <div className="mt-2 flex items-center gap-2 border-t border-minimal-accent/10 pt-2">
                  <div className="w-2 h-2 rounded-full bg-minimal-accent animate-pulse" />
                  <span className="text-[9px] font-bold text-minimal-accent/70 uppercase">Global Style Overlay Active</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
