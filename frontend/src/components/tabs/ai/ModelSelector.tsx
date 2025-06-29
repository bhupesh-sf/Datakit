import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Cpu, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useAIStore } from "@/store/aiStore";
import { aiService } from "@/lib/ai/aiService";
import { modelManager } from "@/lib/ai/modelManager";
import { AIProvider, AIModel } from "@/types/ai";
import { cn } from "@/lib/utils";

import OpenAILogo from '@/assets/openai.webp';
import AnthropicLogo  from '@/assets/anthropic.webp';


interface ModelSelectorProps {
  compact?: boolean;
}

const PROVIDER_COLORS: Record<AIProvider, string> = {
  openai: 'blue',
  anthropic: 'blue', 
  local: 'blue',
  custom: 'purple',
};

const PROVIDER_ICONS: Record<AIProvider, React.ReactNode> = {
  openai: <img src={OpenAILogo} className="h-4 w-4" />,
  anthropic: <img src={AnthropicLogo} className="h-4 w-4" />,
  local: <Cpu className="h-4 w-4" />,
  custom: <Download className="h-4 w-4" />,
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [downloadedModels, setDownloadedModels] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    activeProvider,
    activeModel,
    availableModels,
    localModels,
    apiKeys,
    setActiveProvider,
    setActiveModel,
  } = useAIStore();

  // Load downloaded models
  useEffect(() => {
    const downloaded = modelManager.getDownloadedModels();
    setDownloadedModels(downloaded);
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get current active model details
  const getCurrentModel = (): AIModel | null => {
    if (!activeModel) return null;
    
    for (const [provider, models] of availableModels) {
      const model = models.find(m => m.id === activeModel);
      if (model) return model;
    }
    
    return localModels.find(m => m.id === activeModel) || null;
  };

  const currentModel = getCurrentModel();

  // Check if provider needs API key and has one
  const hasApiKey = (provider: AIProvider) => {
    if (provider === 'local') return true;
    return apiKeys.has(provider) && !!apiKeys.get(provider);
  };

  // Handle model selection
  const handleModelSelect = async (provider: AIProvider, modelId: string) => {
    setActiveProvider(provider);
    setActiveModel(modelId);
    setIsOpen(false);

    // For local models, ensure the model is loaded
    if (provider === 'local') {
      try {
        const currentLoaded = aiService.getLoadedLocalModel();
        if (currentLoaded !== modelId) {
          // Load the model if not already loaded
          await aiService.loadLocalModel(modelId);
          modelManager.markModelUsed(modelId);
        }
      } catch (error) {
        console.error('Failed to load local model:', error);
        // TODO: Show error notification
      }
    }
  };

  // Get color class for provider
  const getProviderColorClass = (provider: AIProvider, type: 'bg' | 'border' | 'text') => {
    const color = PROVIDER_COLORS[provider];
    switch (type) {
      case 'bg':
        return `bg-${color}-500/10`;
      case 'border':
        return `border-${color}-500/30`;
      case 'text':
        return `text-${color}-500`;
      default:
        return '';
    }
  };

  const ModelBadge = ({ model, provider }: { model: AIModel; provider: AIProvider }) => (
    <div className={cn(
      "flex items-center space-x-2 p-2 rounded-lg border",
      hasApiKey(provider) 
        ? `${getProviderColorClass(provider, 'bg')} ${getProviderColorClass(provider, 'border')}` 
        : "bg-white/5 border-white/10 opacity-50"
    )}>
      <div className={cn(
        "h-6 w-6 rounded-md flex items-center justify-center border",
        hasApiKey(provider)
          ? `${getProviderColorClass(provider, 'border')} ${getProviderColorClass(provider, 'text')}`
          : "border-white/10 text-white/40"
      )}>
        {PROVIDER_ICONS[provider]}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {model.name}
        </div>
        {!compact && (
          <div className="text-xs text-white/60 truncate">
            {provider === 'local' ? 'Local' : provider.charAt(0).toUpperCase() + provider.slice(1)}
            {model.costPer1kTokens && (
              <span className="ml-2">
                ${model.costPer1kTokens.input.toFixed(3)}/1K tokens
              </span>
            )}
          </div>
        )}
      </div>
      
      {!hasApiKey(provider) && provider !== 'local' && (
        <div className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
          No Key
        </div>
      )}
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center space-x-2 p-2 rounded-lg border transition-all duration-200",
          currentModel && hasApiKey(activeProvider)
            ? `${getProviderColorClass(activeProvider, 'bg')} ${getProviderColorClass(activeProvider, 'border')} hover:bg-opacity-80`
            : "bg-white/5 border-white/10 hover:bg-white/10",
          isOpen && "ring-2 ring-primary/50"
        )}
      >
        {currentModel ? (
          <>
            <div className={cn(
              "h-5 w-5 rounded flex items-center justify-center",
              hasApiKey(activeProvider) ? getProviderColorClass(activeProvider, 'text') : "text-white/40"
            )}>
              {PROVIDER_ICONS[activeProvider]}
            </div>
            <span className="text-sm font-medium text-white truncate max-w-32">
              {currentModel.name}
            </span>
          </>
        ) : (
          <>
            <Cpu className="h-5 w-5 text-white/40" />
            <span className="text-sm text-white/60">Select Model</span>
          </>
        )}
        
        <ChevronDown 
          className={cn(
            "h-4 w-4 text-white/60 transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 w-80 bg-darkNav border border-white/10 rounded-lg shadow-xl shadow-black/30 z-50 max-h-96 overflow-y-auto"
          >
            <div className="p-3">
              <div className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
                Select AI Model
              </div>

              <div className="space-y-3">
                {Array.from(availableModels.entries()).map(([provider, models]) => (
                  <div key={provider}>
                    <div className="text-xs font-medium text-white/50 mb-2 flex items-center">
                      {PROVIDER_ICONS[provider]}
                      <span className="ml-2 capitalize">{provider}</span>
                      {!hasApiKey(provider) && provider !== 'local' && (
                        <span className="ml-2 text-yellow-500">(API key required)</span>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(provider, model.id)}
                          disabled={!hasApiKey(provider)}
                          className={cn(
                            "w-full text-left p-2 rounded-lg border transition-all duration-200",
                            activeModel === model.id
                              ? `${getProviderColorClass(provider, 'bg')} ${getProviderColorClass(provider, 'border')}`
                              : hasApiKey(provider)
                              ? "border-transparent hover:bg-white/5 hover:border-white/10"
                              : "border-transparent opacity-50 cursor-not-allowed",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white">
                                {model.name}
                              </div>
                              <div className="text-xs text-white/60">
                                {model.contextWindow.toLocaleString()} tokens
                                {model.costPer1kTokens && (
                                  <span className="ml-2">
                                    ${model.costPer1kTokens.input.toFixed(3)}/1K
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-white/40 mt-1">
                                {model.capabilities.join(', ')}
                              </div>
                            </div>
                            
                            {activeModel === model.id && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Local Models Section - Coming Soon */}
                <div>
                  <div className="text-xs font-medium text-white/50 mb-2 flex items-center">
                    <Cpu className="h-4 w-4" />
                    <span className="ml-2">Local Models</span>
                    <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                      Coming Soon
                    </span>
                  </div>
                  
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    <div className="text-sm text-white/70 mb-2">
                      Privacy-first AI models
                    </div>
                    <div className="text-xs text-white/50">
                      Run AI models directly in your browser with complete privacy. No data leaves your device.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModelSelector;