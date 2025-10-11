import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Cpu, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { useAIStore } from '@/store/aiStore';
import { aiService } from '@/lib/ai/aiService';
import { modelManager } from '@/lib/ai/modelManager';
import { AIProvider, AIModel } from '@/types/ai';
import { useAuth } from '@/hooks/auth/useAuth';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

import OpenAILogo from '@/assets/openai.webp';
import AnthropicLogo from '@/assets/anthropic.webp';
import GroqLogo from '@/assets/groq.png';
import DatakitLogoShort from '@/assets/datakitShort.png';
import OllamaLogo from '@/assets/ollama.webp';
import AuthModal from '@/components/auth/AuthModal';

interface ModelSelectorProps {
  compact?: boolean;
}

const PROVIDER_COLORS: Record<AIProvider | 'datakit', string> = {
  datakit: 'primary',
  openai: 'blue',
  anthropic: 'blue',
  groq: 'blue',
  local: 'blue',
  ollama: 'green',
};

const PROVIDER_ICONS: Record<AIProvider | 'datakit', React.ReactNode> = {
  datakit: <img src={DatakitLogoShort} className="h-4 w-4" />,
  openai: <img src={OpenAILogo} className="h-4 w-4" />,
  anthropic: <img src={AnthropicLogo} className="h-4 w-4" />,
  groq: <img src={GroqLogo} className="h-4 w-4" />,
  local: <Cpu className="h-4 w-4" />,
  ollama: <img src={OllamaLogo} className="h-4 w-4" />,
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ compact = false }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [downloadedModels, setDownloadedModels] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>(
    'signup'
  );

  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const {
    activeProvider,
    activeModel,
    availableModels,
    localModels,
    apiKeys,
    setActiveProvider,
    setActiveModel,
    updateOllamaModels,
  } = useAIStore();

  // Load downloaded models and fetch Ollama models
  useEffect(() => {
    const downloaded = modelManager.getDownloadedModels();
    setDownloadedModels(downloaded);

    // Fetch Ollama models if Ollama is connected
    const fetchOllamaModels = async () => {
      try {
        // Check if Ollama provider is available
        if (apiKeys.has('ollama') || activeProvider === 'ollama') {
          const ollamaUrl = apiKeys.get('ollama') || 'http://localhost:11434';
          aiService.setApiKey('ollama', ollamaUrl);

          // Validate connection first
          const isConnected = await aiService.validateApiKey('ollama');
          if (isConnected) {
            // Fetch models from Ollama
            const models = await aiService.getOllamaModels();
            if (models && models.length > 0) {
              // Update the store with fetched models
              updateOllamaModels(models);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch Ollama models:', error);
      }
    };

    fetchOllamaModels();
  }, [isOpen, apiKeys, activeProvider, updateOllamaModels]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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
      const model = models.find((m) => m.id === activeModel);
      if (model) return model;
    }

    return localModels.find((m) => m.id === activeModel) || null;
  };

  const currentModel = getCurrentModel();

  // Check if provider needs API key and has one
  const hasApiKey = (provider: AIProvider | 'datakit') => {
    // All providers now require authentication
    if (!isAuthenticated) return false;

    if (provider === 'local') return isAuthenticated;
    if (provider === 'ollama') return isAuthenticated;
    if (provider === 'datakit') return isAuthenticated; // DataKit requires authentication
    return (
      apiKeys.has(provider as AIProvider) &&
      !!apiKeys.get(provider as AIProvider)
    );
  };

  const handleOpenAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  // Handle model selection
  const handleModelSelect = async (
    provider: AIProvider | 'datakit',
    modelId: string
  ) => {
    // All providers now require authentication
    if (!isAuthenticated) {
      setIsOpen(false);
      handleOpenAuthModal('signup');
      return;
    }

    setActiveProvider(provider as AIProvider);
    setActiveModel(modelId);
    setIsOpen(false);

    // For DataKit models, no special loading needed - handled by backend
    if (provider === 'datakit') {
      // Just set the model, backend will handle the actual AI calls
      return;
    }

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

  const handleSignInClick = () => {
    setIsOpen(false);
    handleOpenAuthModal('signup');
  };

  // Get color class for provider
  const getProviderColorClass = (
    provider: AIProvider | 'datakit',
    type: 'bg' | 'border' | 'text'
  ) => {
    const color = PROVIDER_COLORS[provider];
    switch (type) {
      case 'bg':
        return color === 'primary' ? 'bg-primary/10' : `bg-${color}-500/10`;
      case 'border':
        return color === 'primary'
          ? 'border-primary/30'
          : `border-${color}-500/30`;
      case 'text':
        return color === 'primary' ? 'text-primary' : `text-${color}-500`;
      default:
        return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - Minimal for sidebar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded border transition-all duration-200 text-xs',
          compact 
            ? 'text-xs min-w-0' 
            : 'space-x-2 p-2',
          currentModel && hasApiKey(activeProvider)
            ? 'bg-white/5 border-white/20 text-white/90 hover:bg-white/10'
            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10',
          isOpen && 'ring-1 ring-primary/30'
        )}
      >
        {currentModel ? (
          <>
            <div
              className={cn(
                compact ? 'h-3 w-3' : 'h-4 w-4',
                'rounded flex items-center justify-center flex-shrink-0',
                hasApiKey(activeProvider)
                  ? 'text-white/80'
                  : 'text-white/40'
              )}
            >
              {React.cloneElement(PROVIDER_ICONS[activeProvider] as React.ReactElement, {
                className: compact ? 'h-3 w-3' : 'h-4 w-4'
              })}
            </div>
            <span className={cn(
              'font-medium truncate',
              compact ? 'text-xs max-w-16' : 'text-sm max-w-32'
            )}>
              {compact ? currentModel.name.split(' ')[0] : currentModel.name}
            </span>
          </>
        ) : (
          <>
            <Cpu className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', 'text-white/40 flex-shrink-0')} />
            <span className={compact ? 'text-xs' : 'text-sm'}>
              {compact ? t('ai.modelSelector.model', { defaultValue: 'Model' }) : t('ai.modelSelector.selectModel', { defaultValue: 'Select Model' })}
            </span>
          </>
        )}

        <ChevronDown
          className={cn(
            compact ? 'h-3 w-3' : 'h-4 w-4',
            'text-white/60 transition-transform flex-shrink-0',
            isOpen && 'rotate-180'
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
            className={cn(
              'absolute top-full mt-2 bg-black border border-white/10 rounded-lg shadow-xl shadow-black/30 z-50 max-h-96 overflow-y-auto',
              compact ? 'w-72 right-0' : 'w-80 left-0'
            )}
          >
            <div className={compact ? 'p-2' : 'p-3'}>
              {!compact && (
                <div className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
                  {t('ai.modelSelector.title', { defaultValue: 'Select AI Model' })}
                </div>
              )}

              <div className={compact ? 'space-y-2' : 'space-y-3'}>
                {Array.from(availableModels.entries()).map(
                  ([provider, models]) => (
                    <div key={provider}>
                      <div className={cn(
                        'text-xs font-medium text-white/50 flex items-center',
                        compact ? 'mb-1' : 'mb-2'
                      )}>
                        {React.cloneElement(PROVIDER_ICONS[provider] as React.ReactElement, {
                          className: compact ? 'h-3 w-3' : 'h-4 w-4'
                        })}
                        <span className={compact ? 'ml-1.5 capitalize' : 'ml-2 capitalize'}>
                          {provider === 'datakit' ? t('ai.providers.datakit', { defaultValue: 'DataKit' }) : t(`ai.providers.${provider}`, { defaultValue: provider.charAt(0).toUpperCase() + provider.slice(1) })}
                        </span>
                        {provider === 'datakit' && !compact && (
                          <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                            {t('ai.modelSelector.claudeModels', { defaultValue: 'Claude Models' })}
                          </span>
                        )}
                        {!compact && !isAuthenticated && (
                          <span className="ml-2 text-yellow-500 text-xs">
                            ({t('ai.modelSelector.signInRequired', { defaultValue: 'Sign in required' })})
                          </span>
                        )}
                        {!compact && isAuthenticated &&
                          !hasApiKey(provider) &&
                          provider !== 'local' &&
                          provider !== 'datakit' &&
                          provider !== 'ollama' && (
                            <span className="ml-2 text-yellow-500 text-xs">
                              ({t('ai.modelSelector.apiKeyRequired', { defaultValue: 'API key required' })})
                            </span>
                          )}
                      </div>

                      <div className="space-y-1">
                        {models.map((model) => (
                          <button
                            key={model.id}
                            onClick={() =>
                              handleModelSelect(provider, model.id)
                            }
                            disabled={!isAuthenticated || !hasApiKey(provider)}
                            className={cn(
                              'w-full text-left rounded border transition-all duration-200',
                              compact ? 'p-1.5' : 'p-2',
                              activeModel === model.id
                                ? 'bg-primary/10 border-primary/30'
                                : isAuthenticated && hasApiKey(provider)
                                ? 'border-transparent hover:bg-white/5 hover:border-white/10'
                                : 'border-transparent opacity-50 cursor-not-allowed'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className={cn(
                                  'font-medium text-white',
                                  compact ? 'text-xs' : 'text-sm'
                                )}>
                                  {compact ? model.name.split(' ')[0] : model.name}
                                </div>
                                {!compact && (
                                  <>
                                    <div className="text-xs text-white/60">
                                      {model?.contextWindow &&
                                        `${model?.contextWindow?.toLocaleString?.()} tokens`}
                                      {model?.costPer1kTokens && (
                                        <span className="ml-2">
                                          {provider === 'datakit'
                                            ? t('ai.modelSelector.creditsPerToken', { cost: model.costPer1kTokens.input.toFixed(2), defaultValue: '{{cost}} credits/1K tokens' })
                                            : t('ai.modelSelector.dollarsPerToken', { cost: model.costPer1kTokens.input.toFixed(3), defaultValue: '${{cost}}/1K' })}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-white/40 mt-1">
                                      {provider === 'datakit'
                                        ? model.description
                                        : model.capabilities.join(', ')}
                                    </div>
                                  </>
                                )}
                              </div>

                              {activeModel === model.id && (
                                <Check className={cn(
                                  'text-primary flex-shrink-0',
                                  compact ? 'h-3 w-3' : 'h-4 w-4'
                                )} />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Special sections for DataKit */}
                      {!compact && provider === 'datakit' && !isAuthenticated && (
                        <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="text-sm text-white/70 mb-2">
                            {t('ai.modelSelector.signUpCredits', { defaultValue: 'Sign up to use DataKit credits' })}
                          </div>
                          <div className="text-xs text-white/50 mb-3">
                            {t('ai.modelSelector.noApiKeysNeeded', { defaultValue: 'No API keys needed. Credits included with your account.' })}
                          </div>
                          <button
                            onClick={handleSignInClick}
                            className="w-full px-3 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-sm font-medium text-primary transition-all duration-200"
                          >
                            {t('ai.modelSelector.signUpButton', { defaultValue: 'Sign up to get started' })}
                          </button>
                        </div>
                      )}

                      {!compact && provider === 'datakit' &&
                        isAuthenticated &&
                        user?.credits && (
                          <div className="mt-2 p-2 bg-background/10 border border-white/10 rounded">
                            <div className="text-xs text-white/60">
                              {t('ai.modelSelector.creditsRemaining', { count: user.credits.remaining, defaultValue: 'Credits remaining: {{count}}' })}
                            </div>
                          </div>
                        )}
                    </div>
                  )
                )}

                {/* Local Models Section - Coming Soon */}
                {/* <div>
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
                </div> */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authModalMode}
        onLoginSuccess={() => setActiveProvider('datakit')}
      />
    </div>
  );
};

export default ModelSelector;
