import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Crown, 
  Key, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  ExternalLink, 
  Settings as SettingsIcon,
  Shield,
  Zap,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useAIStore } from '@/store/aiStore';
import { AIProvider } from '@/types/ai';

// Import provider logos
import OpenAILogo from '@/assets/openai.webp';
import AnthropicLogo from '@/assets/anthropic.webp';
import GroqLogo from '@/assets/groq.png';

const PROVIDER_CONFIG = {
  datakit: {
    name: 'DataKit AI',
    icon: <></>,
    color: 'primary',
    bgGradient: 'from-blue-500/20 to-purple-500/20',
    borderGradient: 'from-blue-500/40 to-purple-500/40',
    description: 'Optimized AI models for data analysis',
    helpText: 'DataKit AI uses your workspace credits and provides optimized prompts for data analysis tasks.',
    keyFormat: null,
    websiteUrl: null,
    models: ['DataKit Smart (Claude 3.5 Sonnet)', 'DataKit Fast (GPT-4o Mini)'],
    features: ['Optimized for data analysis', 'No API key required', 'Uses workspace credits']
  },
  openai: {
    name: 'OpenAI',
    icon: <img src={OpenAILogo} className="h-5 w-5" alt="OpenAI" />,
    color: 'green',
    bgGradient: 'from-green-500/20 to-emerald-500/20',
    borderGradient: 'from-green-500/40 to-emerald-500/40',
    description: 'GPT-4o and GPT-4o Mini models',
    helpText: 'Most capable models for complex reasoning and analysis. New users get $5 free credits.',
    keyFormat: 'sk-...',
    websiteUrl: 'https://platform.openai.com/api-keys',
    models: ['GPT-4o', 'GPT-4o Mini'],
    features: ['Advanced reasoning', 'Large context window', '$5 free credits']
  },
  anthropic: {
    name: 'Anthropic',
    icon: <img src={AnthropicLogo} className="h-4 w-4" alt="Anthropic" />,
    color: 'orange',
    bgGradient: 'from-orange-500/20 to-amber-500/20',
    borderGradient: 'from-orange-500/40 to-amber-500/40',
    description: 'Claude 3.5 Sonnet and Haiku models',
    helpText: 'Excellent for detailed analysis and explanations. Free credits for new users.',
    keyFormat: 'sk-ant-...',
    websiteUrl: 'https://console.anthropic.com/',
    models: ['Claude 3.5 Sonnet', 'Claude 3.5 Haiku'],
    features: ['Detailed explanations', 'Safety focused', 'Free trial credits']
  },
  groq: {
    name: 'Groq',
    icon: <img src={GroqLogo} className="h-4 w-4" alt="Groq" />,
    color: 'purple',
    bgGradient: 'from-purple-500/20 to-violet-500/20',
    borderGradient: 'from-purple-500/40 to-violet-500/40',
    description: 'Ultra-fast Llama 3.1 models',
    helpText: 'Fastest inference speed, perfect for trying AI features. Completely free to start.',
    keyFormat: 'gsk_...',
    websiteUrl: 'https://console.groq.com/keys',
    models: ['Llama 3.1 70B', 'Llama 3.1 8B'],
    features: ['Ultra-fast inference', 'Open source models', 'Completely free']
  }
} as const;

const AISettings: React.FC = () => {
  const { currentWorkspace } = useAuthStore();
  const { 
    apiKeys, 
    activeProvider,
    autoExecuteSQL,
    setActiveProvider: setActiveProviderToStore,
    setApiKey,
    updateSettings
  } = useAIStore();

  const [keyInputs, setKeyInputs] = useState<Map<AIProvider, string>>(new Map());
  const [showKeys, setShowKeys] = useState<Map<AIProvider, boolean>>(new Map());
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(activeProvider || 'openai');
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);

  const isProOrTeam = currentWorkspace?.subscription?.planType === 'pro' || 
                     currentWorkspace?.subscription?.planType === 'team';

  // Initialize form with existing keys
  useEffect(() => {
    const newInputs = new Map();
    for (const [provider, key] of apiKeys) {
      newInputs.set(provider, key);
    }
    setKeyInputs(newInputs);
  }, [apiKeys]);

  const handleKeyChange = (provider: AIProvider, value: string) => {
    setKeyInputs(new Map(keyInputs.set(provider, value)));
  };

  const handleToggleKeyVisibility = (provider: AIProvider) => {
    setShowKeys(new Map(showKeys.set(provider, !showKeys.get(provider))));
  };

  const handleSaveKey = (provider: AIProvider) => {
    const key = keyInputs.get(provider);
    if (key?.trim()) {
      setApiKey(provider, key.trim());
      setActiveProviderToStore(provider);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return '•'.repeat(key.length);
    // Always show first 6 chars + 20 dots + last 4 chars for consistency
    return key.slice(0, 6) + '•'.repeat(20) + key.slice(-4);
  };

  const getProviderStatus = (provider: AIProvider) => {
    if (provider === 'datakit') {
      return isProOrTeam ? 'available' : 'upgrade';
    }
    const hasKey = apiKeys.has(provider) && !!apiKeys.get(provider);
    return hasKey ? 'configured' : 'setup';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'configured':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'upgrade':
        return <Crown className="h-4 w-4 text-amber-400" />;
      case 'setup':
        return <Key className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'configured':
        return 'Configured';
      case 'upgrade':
        return 'Pro/Team Required';
      case 'setup':
        return 'Setup Required';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-white mb-2">AI Configuration</h3>
        <p className="text-sm text-white/60">
          Configure your AI providers and manage API keys for data analysis
        </p>
      </div>

      {/* DataKit AI Status Card */}
      <div className={`relative overflow-hidden rounded-xl border ${
        isProOrTeam 
          ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30' 
          : 'bg-gradient-to-br from-gray-500/10 to-gray-600/10 border-gray-500/30'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div>
                <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                  DataKit AI
                  {isProOrTeam && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                      Available
                    </span>
                  )}
                </h4>
                <p className="text-sm text-white/60">
                  {isProOrTeam 
                    ? 'Optimized AI models with curated prompts for data analysis'
                    : 'Upgrade to Pro or Team to access DataKit AI'
                  }
                </p>
              </div>
            </div>
            {!isProOrTeam && (
              <Button variant="primary" size="sm">
                Upgrade Plan
              </Button>
            )}
          </div>

          {isProOrTeam && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 text-white/70">
                <Sparkles className="h-3 w-3 text-blue-400" />
                Optimized prompts
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <Shield className="h-3 w-3 text-green-400" />
                No API key needed
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <Zap className="h-3 w-3 text-purple-400" />
                Uses workspace credits
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Provider Cards Grid */}
      <div>
        <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <Key className="h-4 w-4" />
          Third-Party Providers
        </h4>
        <div className="space-y-2">
          {(['openai', 'anthropic', 'groq'] as AIProvider[]).map((provider) => {
            const config = PROVIDER_CONFIG[provider];
            const status = getProviderStatus(provider);
            const isActive = activeProvider === provider;
            const hasKey = apiKeys.has(provider) && !!apiKeys.get(provider);
            const isEditing = editingProvider === provider;

            const handleUpdateKey = () => {
              setEditingProvider(provider);
              setKeyInputs(new Map(keyInputs.set(provider, apiKeys.get(provider) || '')));
            };

            const handleSaveUpdate = () => {
              const key = keyInputs.get(provider);
              if (key?.trim()) {
                setApiKey(provider, key.trim());
                setActiveProviderToStore(provider);
              }
              setEditingProvider(null);
            };

            const handleCancelUpdate = () => {
              setKeyInputs(new Map(keyInputs.set(provider, apiKeys.get(provider) || '')));
              setEditingProvider(null);
            };

            return (
              <div
                key={provider}
                className={`rounded-lg border p-3 transition-all duration-200 ${
                  isActive
                    ? 'bg-white/10 border-primary/50'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Provider Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-6 w-6 rounded flex items-center justify-center flex-shrink-0 bg-white/10">
                      {config.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-medium text-white truncate">{config.name}</h5>
                        {getStatusIcon(status)}
                      </div>
                      {hasKey && !isEditing && (
                        <div className="text-xs font-mono text-white/60 mt-1">
                          {maskApiKey(apiKeys.get(provider) || '')}
                        </div>
                      )}
                      {isEditing && (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="password"
                            value={keyInputs.get(provider) || ''}
                            onChange={(e) => handleKeyChange(provider, e.target.value)}
                            placeholder={`Enter ${config.name} API key`}
                            className="flex-1 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-primary/50"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveUpdate}
                            className="px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded hover:bg-primary/30"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelUpdate}
                            className="px-2 py-1 text-xs text-white/60 hover:text-white/80"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {!hasKey && !isEditing && (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="password"
                            value={keyInputs.get(provider) || ''}
                            onChange={(e) => handleKeyChange(provider, e.target.value)}
                            placeholder={`Enter ${config.name} API key`}
                            className="flex-1 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-primary/50"
                          />
                          <button
                            onClick={() => handleSaveKey(provider)}
                            disabled={!keyInputs.get(provider)?.trim()}
                            className="px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded hover:bg-primary/30 disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasKey && !isEditing && (
                      <button
                        onClick={handleUpdateKey}
                        className="px-2 py-1 text-xs text-white/60 hover:text-white/90 hover:bg-white/5 rounded transition-colors"
                      >
                        Update
                      </button>
                    )}
                    {config.websiteUrl && (
                      <button
                        onClick={() => window.open(config.websiteUrl!, '_blank')}
                        className="p-1 text-white/40 hover:text-white/80 rounded"
                        title="Get API key"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* General Settings */}
      <div className="border-t border-white/10 pt-6">
        <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4" />
          General Settings
        </h4>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
            <div>
              <label className="text-sm text-white/80 font-medium">
                Auto-execute generated SQL
              </label>
              <p className="text-xs text-white/60 mt-1">
                Automatically run SQL queries generated by AI
              </p>
            </div>
            <button
              onClick={() => updateSettings({ autoExecuteSQL: !autoExecuteSQL })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoExecuteSQL ? 'bg-primary' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoExecuteSQL ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISettings;