import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Server,
  Trash2,
  RefreshCw,
  Circle,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useAIStore } from "@/store/aiStore";
import { aiService } from "@/lib/ai/aiService";

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaModelManagerProps {
  baseUrl?: string;
  onModelSelect?: (modelName: string) => void;
  selectedModel?: string;
}

// Popular models that users might want to install
const POPULAR_MODELS = [
  {
    name: "llama3.2",
    displayName: "Llama 3.2",
    description: "Latest Llama model - Great for general tasks",
    size: "2.0GB",
  },
  {
    name: "llama3.2:1b",
    displayName: "Llama 3.2 1B",
    description: "Smaller, faster version - Good for simple tasks",
    size: "1.3GB",
  },
  {
    name: "gpt-oss",
    displayName: "GPT-OSS",
    description: "Open-source GPT model for general AI tasks",
    size: "3.8GB",
  },
  {
    name: "mistral",
    displayName: "Mistral",
    description: "Fast and efficient model",
    size: "4.1GB",
  },
  {
    name: "codellama",
    displayName: "Code Llama",
    description: "Specialized for code and SQL generation",
    size: "3.8GB",
  },
  {
    name: "qwen2.5:7b",
    displayName: "Qwen 2.5 7B",
    description: "Excellent multilingual model",
    size: "4.4GB",
  },
  {
    name: "phi3",
    displayName: "Phi-3",
    description: "Microsoft's small but powerful model",
    size: "2.3GB",
  },
  {
    name: "gemma2",
    displayName: "Gemma 2",
    description: "Google's efficient open model",
    size: "5.5GB",
  },
];

const OllamaModelManager: React.FC<OllamaModelManagerProps> = ({
  baseUrl = "http://localhost:11434",
  onModelSelect,
  selectedModel,
}) => {
  const { t } = useTranslation();
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pullingModels, setPullingModels] = useState<Set<string>>(new Set());
  const [pullProgress, setPullProgress] = useState<Map<string, number>>(new Map());
  const [showPopularModels, setShowPopularModels] = useState(false);

  const { apiKeys, setApiKey } = useAIStore();

  // Test connection and load models
  useEffect(() => {
    checkConnectionAndLoadModels();
  }, [baseUrl]);

  const checkConnectionAndLoadModels = async () => {
    setIsLoading(true);
    setConnectionError(null);
    
    try {
      // Initialize Ollama provider with current base URL
      setApiKey('ollama', baseUrl);
      
      // Test connection
      const isConnectedResult = await aiService.validateApiKey('ollama');
      setIsConnected(isConnectedResult);
      
      if (isConnectedResult) {
        // Load installed models
        const models = await aiService.getOllamaModels();
        setInstalledModels(models);
      } else {
        setConnectionError(t('ai.ollama.connectionFailed', { defaultValue: `Cannot connect to Ollama at ${baseUrl}. Make sure Ollama is running.`, baseUrl }));
      }
    } catch (error) {
      console.error('Failed to connect to Ollama:', error);
      setIsConnected(false);
      setConnectionError(
        error instanceof Error 
          ? error.message 
          : `Failed to connect to Ollama at ${baseUrl}`
      );
      setInstalledModels([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullModel = async (modelName: string) => {
    if (pullingModels.has(modelName)) return;

    setPullingModels(prev => new Set([...prev, modelName]));
    setPullProgress(prev => new Map(prev.set(modelName, 0)));

    try {
      await aiService.pullOllamaModel(modelName, (progress) => {
        setPullProgress(prev => new Map(prev.set(modelName, progress)));
      });

      // Refresh models list after successful pull
      const models = await aiService.getOllamaModels();
      setInstalledModels(models);
      
      // Auto-select the newly pulled model
      if (onModelSelect) {
        onModelSelect(modelName);
      }
    } catch (error) {
      console.error(`Failed to pull model ${modelName}:`, error);
    } finally {
      setPullingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
      setPullProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(modelName);
        return newMap;
      });
    }
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1) + " GB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isModelInstalled = (modelName: string) => {
    return installedModels.some(model => model.name === modelName || model.model === modelName);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-white/70">{t('ai.ollama.connecting', { defaultValue: 'Connecting to Ollama...' })}</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{t('ai.ollama.connectionFailedTitle', { defaultValue: 'Connection Failed' })}</p>
            <p className="text-xs text-white/70 mt-1">
              {connectionError || t('ai.ollama.cannotConnect', { defaultValue: 'Cannot connect to Ollama' })}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-white">{t('ai.ollama.howToFix', { defaultValue: 'How to fix this:' })}</h4>
          <ul className="text-xs text-white/70 space-y-2">
            <li className="flex items-start gap-2">
              <Circle className="h-1 w-1 mt-1.5 flex-shrink-0" />
              <span>{t('ai.ollama.installStep', { defaultValue: 'Install Ollama from' })} <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ollama.com</a></span>
            </li>
            <li className="flex items-start gap-2">
              <Circle className="h-1 w-1 mt-1.5 flex-shrink-0" />
              <code className="bg-white/10 px-1 rounded">{t('ai.ollama.runCommand', { defaultValue: 'Run' })}</code><span> {t('ai.ollama.inTerminal', { defaultValue: 'in terminal' })}</span>
            </li>
            <li className="flex items-start gap-2">
              <Circle className="h-1 w-1 mt-1.5 flex-shrink-0" />
              <span>{t('ai.ollama.makeSureRunning', { defaultValue: 'Make sure it\'s running on {baseUrl}', baseUrl })}</span>
            </li>
          </ul>
          
          <div className="mt-3 p-2 rounded-lg">
            <p className="text-xs font-medium mb-1">{t('ai.ollama.browserCompatibility', { defaultValue: 'Browser Compatibility Note:' })}</p>
            <a
              href="https://firefox.com"
              target="_blank"
              rel="noopener noreferrer"
            >
            <p className="text-xs text-white/60">
              {t('ai.ollama.firefoxNote', { defaultValue: 'If connection still fails, try using Firefox as it has better support for localhost connections from HTTPS sites.' })}
            </p>
            </a>
          </div>
        </div>

        <Button
          onClick={checkConnectionAndLoadModels}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('ai.ollama.tryAgain', { defaultValue: 'Try Again' })}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <CheckCircle className="h-4 w-4 text-green-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{t('ai.ollama.connected', { defaultValue: 'Connected to Ollama' })}</p>
          <p className="text-xs text-white/70">{baseUrl}</p>
        </div>
        <Button
          onClick={checkConnectionAndLoadModels}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Installed Models */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-white">
            {t('ai.ollama.installedModels', { defaultValue: 'Installed Models ({count})', count: installedModels.length })}
          </h4>
        </div>

        {installedModels.length === 0 ? (
          <div className="text-center py-8">
            <Server className="h-8 w-8 text-white/30 mx-auto mb-3" />
            <p className="text-sm text-white/70 mb-2">{t('ai.ollama.noModels', { defaultValue: 'No models installed' })}</p>
            <p className="text-xs text-white/50">
              {t('ai.ollama.pullModelToStart', { defaultValue: 'Pull a model below to get started' })}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {installedModels.map((model) => (
              <div
                key={model.digest}
                className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                  selectedModel === model.name
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => onModelSelect?.(model.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {model.name}
                      </p>
                      {selectedModel === model.name && (
                        <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-white/60">
                        {formatSize(model.size)}
                      </span>
                      <span className="text-xs text-white/60">
                        {formatDate(model.modified_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Popular Models to Install */}
      {/* <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-white">Popular Models</h4>
          <Button
            onClick={() => setShowPopularModels(!showPopularModels)}
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            {showPopularModels ? 'Hide' : 'Show'} Available Models
          </Button>
        </div>

        <AnimatePresence>
          {showPopularModels && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {POPULAR_MODELS.map((model) => {
                const isInstalled = isModelInstalled(model.name);
                const isPulling = pullingModels.has(model.name);
                const progress = pullProgress.get(model.name) || 0;

                return (
                  <div
                    key={model.name}
                    className="p-3 rounded-lg border border-white/10 bg-white/5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {model.displayName}
                          </p>
                          {isInstalled && (
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          )}
                        </div>
                        <p className="text-xs text-white/60 mt-1">
                          {model.description}
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          {model.size}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-3">
                        {isPulling ? (
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-white/70">
                              {progress.toFixed(0)}%
                            </div>
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        ) : isInstalled ? (
                          <Button
                            onClick={() => onModelSelect?.(model.name)}
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                          >
                            Use Model
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handlePullModel(model.name)}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Pull
                          </Button>
                        )}
                      </div>
                    </div>

                    {isPulling && progress > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-white/10 rounded-full h-1">
                          <div
                            className="bg-primary h-1 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div> */}

      {/* Help Text */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <Server className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-white/70">
            <p className="mb-1">{t('ai.ollama.privacyNote', { defaultValue: 'Models run entirely on your machine for complete privacy.' })}</p>
            <p>
              {t('ai.ollama.needMoreModels', { defaultValue: 'Need more models? Visit' })}{' '}
              <a
                href="https://ollama.com/library"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                {t('ai.ollama.ollamaLibrary', { defaultValue: 'Ollama Library' })}
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OllamaModelManager;