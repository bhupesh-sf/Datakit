import { create } from "zustand";
import { persist } from "zustand/middleware";
import { 
  AIProvider, 
  AIModel, 
  LocalModel, 
  AIQuery, 
  MCPConnection,
  APIKeyConfig,
  QueryIntent
} from "@/types/ai";

interface AIState {
  // Model Management
  activeProvider: AIProvider;
  activeModel: string | null;
  availableModels: Map<AIProvider, AIModel[]>;
  localModels: LocalModel[];
  
  // API Keys (encrypted in localStorage)
  apiKeys: Map<AIProvider, string>;
  
  // Query State
  currentPrompt: string;
  queryHistory: AIQuery[];
  isProcessing: boolean;
  currentQueryId: string | null;
  
  // MCP State
  mcpConnections: MCPConnection[];
  activeMCPConnection: string | null;
  
  // UI State
  showModelSelector: boolean;
  showApiKeyModal: boolean;
  splitViewMode: 'vertical' | 'horizontal';
  promptEditorHeight: number;
  sidebarWidth: number;
  showDataContext: boolean;
  showQueryHistory: boolean;
  
  // Settings
  autoExecuteSQL: boolean;
  showCostEstimates: boolean;
  maxHistoryItems: number;
  
  // Actions
  setActiveProvider: (provider: AIProvider) => void;
  setActiveModel: (model: string) => void;
  setApiKey: (provider: AIProvider, key: string) => void;
  validateApiKey: (provider: AIProvider) => Promise<boolean>;
  
  // Query Actions
  setCurrentPrompt: (prompt: string) => void;
  addQueryToHistory: (query: AIQuery) => void;
  clearQueryHistory: () => void;
  setProcessing: (isProcessing: boolean) => void;
  
  // Model Actions
  downloadLocalModel: (modelId: string) => Promise<void>;
  removeLocalModel: (modelId: string) => void;
  updateModelDownloadProgress: (modelId: string, progress: number) => void;
  
  // MCP Actions
  addMCPConnection: (connection: MCPConnection) => void;
  removeMCPConnection: (connectionId: string) => void;
  setActiveMCPConnection: (connectionId: string | null) => void;
  updateMCPConnectionStatus: (connectionId: string, status: MCPConnection['status']) => void;
  
  // UI Actions
  toggleModelSelector: () => void;
  toggleApiKeyModal: () => void;
  setSplitViewMode: (mode: 'vertical' | 'horizontal') => void;
  setPromptEditorHeight: (height: number) => void;
  setSidebarWidth: (width: number) => void;
  toggleDataContext: () => void;
  toggleQueryHistory: () => void;
  
  // Settings Actions
  updateSettings: (settings: Partial<{
    autoExecuteSQL: boolean;
    showCostEstimates: boolean;
    maxHistoryItems: number;
  }>) => void;
  
  // Initialize default models
  initializeModels: () => void;
}

// Default available models
const DEFAULT_MODELS: Map<AIProvider, AIModel[]> = new Map([
  ['openai', [
    {
      id: 'gpt-4-turbo-preview',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      type: 'chat',
      contextWindow: 128000,
      costPer1kTokens: { input: 0.01, output: 0.03 },
      capabilities: ['sql', 'analysis', 'visualization', 'code'],
      requiresApiKey: true,
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      type: 'chat',
      contextWindow: 16384,
      costPer1kTokens: { input: 0.0005, output: 0.0015 },
      capabilities: ['sql', 'analysis', 'basic'],
      requiresApiKey: true,
    },
  ]],
  ['anthropic', [
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      type: 'chat',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
      capabilities: ['sql', 'analysis', 'visualization', 'code', 'reasoning'],
      requiresApiKey: true,
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      type: 'chat',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      capabilities: ['sql', 'analysis', 'visualization', 'code'],
      requiresApiKey: true,
    },
  ]],
]);

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeProvider: 'openai',
      activeModel: null,
      availableModels: DEFAULT_MODELS,
      localModels: [],
      apiKeys: new Map(),
      
      currentPrompt: '',
      queryHistory: [],
      isProcessing: false,
      currentQueryId: null,
      
      mcpConnections: [],
      activeMCPConnection: null,
      
      showModelSelector: false,
      showApiKeyModal: false,
      splitViewMode: 'horizontal',
      promptEditorHeight: 200,
      sidebarWidth: 280,
      showDataContext: true,
      showQueryHistory: false,
      
      autoExecuteSQL: false,
      showCostEstimates: true,
      maxHistoryItems: 50,
      
      // Actions
      setActiveProvider: (provider) => set({ activeProvider: provider }),
      
      setActiveModel: (model) => set({ activeModel: model }),
      
      setApiKey: (provider, key) => {
        set((state) => {
          const newKeys = new Map(state.apiKeys);
          newKeys.set(provider, key);
          return { apiKeys: newKeys };
        });
      },
      
      validateApiKey: async (provider) => {
        // TODO: Implement actual API key validation
        const key = get().apiKeys.get(provider);
        if (!key) return false;
        
        // Placeholder for actual validation
        return true;
      },
      
      setCurrentPrompt: (prompt) => set({ currentPrompt: prompt }),
      
      addQueryToHistory: (query) => {
        set((state) => {
          const history = [query, ...state.queryHistory];
          // Keep only maxHistoryItems
          if (history.length > state.maxHistoryItems) {
            history.pop();
          }
          return { queryHistory: history };
        });
      },
      
      clearQueryHistory: () => set({ queryHistory: [] }),
      
      setProcessing: (isProcessing) => set({ isProcessing }),
      
      downloadLocalModel: async (modelId) => {
        try {
          const { aiService } = await import("@/lib/ai/aiService");
          const { modelManager } = await import("@/lib/ai/modelManager");
          
          // Start download and load process
          set({ isProcessing: true });
          
          await aiService.loadLocalModel(modelId, (progress) => {
            set((state) => ({
              localModels: state.localModels.map((m) =>
                m.id === modelId ? { ...m, downloadProgress: progress } : m
              ),
            }));
          });
          
          // Mark as downloaded
          const model = get().availableModels.get('local')?.find(m => m.id === modelId);
          if (model) {
            modelManager.markModelDownloaded(model as any);
          }
          
        } catch (error) {
          console.error('Failed to download model:', error);
        } finally {
          set({ isProcessing: false });
        }
      },
      
      removeLocalModel: (modelId) => {
        set((state) => ({
          localModels: state.localModels.filter((m) => m.id !== modelId),
        }));
      },
      
      updateModelDownloadProgress: (modelId, progress) => {
        set((state) => ({
          localModels: state.localModels.map((m) =>
            m.id === modelId ? { ...m, downloadProgress: progress } : m
          ),
        }));
      },
      
      addMCPConnection: (connection) => {
        set((state) => ({
          mcpConnections: [...state.mcpConnections, connection],
        }));
      },
      
      removeMCPConnection: (connectionId) => {
        set((state) => ({
          mcpConnections: state.mcpConnections.filter((c) => c.id !== connectionId),
          activeMCPConnection:
            state.activeMCPConnection === connectionId ? null : state.activeMCPConnection,
        }));
      },
      
      setActiveMCPConnection: (connectionId) => {
        set({ activeMCPConnection: connectionId });
      },
      
      updateMCPConnectionStatus: (connectionId, status) => {
        set((state) => ({
          mcpConnections: state.mcpConnections.map((c) =>
            c.id === connectionId ? { ...c, status } : c
          ),
        }));
      },
      
      toggleModelSelector: () => {
        set((state) => ({ showModelSelector: !state.showModelSelector }));
      },
      
      toggleApiKeyModal: () => {
        set((state) => ({ showApiKeyModal: !state.showApiKeyModal }));
      },
      
      setSplitViewMode: (mode) => set({ splitViewMode: mode }),
      
      setPromptEditorHeight: (height) => set({ promptEditorHeight: height }),
      
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      
      toggleDataContext: () => {
        set((state) => ({ showDataContext: !state.showDataContext }));
      },
      
      toggleQueryHistory: () => {
        set((state) => ({ showQueryHistory: !state.showQueryHistory }));
      },
      
      updateSettings: (settings) => {
        set((state) => ({ ...state, ...settings }));
      },
      
      initializeModels: () => {
        // Initialize with default models if needed
        const state = get();
        if (!state.activeModel && state.availableModels.get(state.activeProvider)) {
          const models = state.availableModels.get(state.activeProvider);
          if (models && models.length > 0) {
            set({ activeModel: models[0].id });
          }
        }
      },
    }),
    {
      name: 'datakit-ai-store',
      partialize: (state) => ({
        activeProvider: state.activeProvider,
        activeModel: state.activeModel,
        apiKeys: Array.from(state.apiKeys.entries()),
        queryHistory: state.queryHistory.slice(0, 10), // Only persist last 10
        mcpConnections: state.mcpConnections,
        promptEditorHeight: state.promptEditorHeight,
        sidebarWidth: state.sidebarWidth,
        splitViewMode: state.splitViewMode,
        autoExecuteSQL: state.autoExecuteSQL,
        showCostEstimates: state.showCostEstimates,
        maxHistoryItems: state.maxHistoryItems,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert apiKeys array back to Map
          if (Array.isArray(state.apiKeys)) {
            state.apiKeys = new Map(state.apiKeys);
          }
          // Initialize models on rehydrate
          state.initializeModels();
        }
      },
    }
  )
);