import { create } from "zustand";
import { persist } from "zustand/middleware";
import { 
  AIProvider, 
  AIModel, 
  LocalModel, 
  AIQuery, 
  MCPConnection
} from "@/types/ai";
import { AIMessage } from "@/lib/ai/types";

interface QueryResults {
  data: any[] | null;
  columns: string[] | null;
  isLoading: boolean;
  error: string | null;
  totalRows: number;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
}

interface AIState {
  // Model Management
  activeProvider?: AIProvider;
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
  queryResults: QueryResults | null;
  currentResponse: string | null;
  streamingResponse: string;
  currentTokenUsage: { input: number; output: number } | null;
  currentError: string | null;
  
  // Conversation State
  currentConversation: AIMessage[];
  conversationId: string | null;
  
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
  setQueryResults: (results: QueryResults | null) => void;
  setCurrentResponse: (response: string | null) => void;
  setStreamingResponse: (response: string) => void;
  setCurrentTokenUsage: (usage: { input: number; output: number } | null) => void;
  setCurrentError: (error: string | null) => void;
  
  // Conversation Actions
  addMessageToConversation: (message: AIMessage) => void;
  clearConversation: () => void;
  startNewConversation: () => void;
  
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
  ['datakit', [
    {
      id: 'datakit-smart',
      name: 'Smart',
      provider: 'datakit',
      type: 'chat',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.3, output: 1.5 }, // Credits per 1K tokens
      capabilities: ['sql-generation', 'data-analysis'],
      requiresApiKey: false,
      description: 'Powered by Claude 3.5 Sonnet - Best for complex analysis',
    },
    {
      id: 'datakit-fast',
      name: 'Fast',
      provider: 'datakit',
      type: 'chat',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.08, output: 0.4 }, // Credits per 1K tokens
      capabilities: ['sql-generation', 'data-analysis'],
      requiresApiKey: false,
      description: 'Powered by Claude 3.5 Haiku - Economical',
    },
  ]],
  ['openai', [
    {
      id: 'gpt-4o-2024-11-20',
      name: 'GPT-4o',
      provider: 'openai',
      type: 'chat',
      contextWindow: 128000,
      costPer1kTokens: { input: 0.0025, output: 0.01 },
      capabilities: [],
      requiresApiKey: true,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      type: 'chat',
      contextWindow: 128000,
      costPer1kTokens: { input: 0.00015, output: 0.0006 },
      capabilities: [],
      requiresApiKey: true,
    },
  ]],
  ['anthropic', [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      type: 'chat',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      capabilities: [],
      requiresApiKey: true,
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      type: 'chat',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.0008, output: 0.004 },
      capabilities: [],
      requiresApiKey: true,
    },
  ]],
  ['groq', [
    {
      id: 'llama-3.1-70b-versatile',
      name: 'Llama 3.1 70B (Free)',
      provider: 'groq',
      type: 'chat',
      contextWindow: 131072,
      costPer1kTokens: { input: 0, output: 0 },
      capabilities: [],
      requiresApiKey: true,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B (Free)',
      provider: 'groq',
      type: 'chat',
      contextWindow: 131072,
      costPer1kTokens: { input: 0, output: 0 },
      capabilities: [],
      requiresApiKey: true,
    },
  ]],
]);

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeProvider: undefined,
      activeModel: null,
      availableModels: DEFAULT_MODELS,
      localModels: [],
      apiKeys: new Map(),
      
      currentPrompt: '',
      queryHistory: [],
      isProcessing: false,
      currentQueryId: null,
      queryResults: null,
      currentResponse: null,
      streamingResponse: '',
      currentTokenUsage: null,
      currentError: null,
      
      currentConversation: [],
      conversationId: null,
      
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
      
      setQueryResults: (results) => set({ queryResults: results }),
      
      setCurrentResponse: (response) => set({ currentResponse: response }),
      
      setStreamingResponse: (response) => set({ streamingResponse: response }),
      
      setCurrentTokenUsage: (usage) => set({ currentTokenUsage: usage }),
      
      setCurrentError: (error) => set({ currentError: error }),
      
      addMessageToConversation: (message) => {
        set((state) => {
          const newConversation = [...state.currentConversation, message];
          // Keep conversation manageable (last 20 messages = ~10 exchanges)
          if (newConversation.length > 20) {
            newConversation.splice(0, newConversation.length - 20);
          }
          return { currentConversation: newConversation };
        });
      },
      
      clearConversation: () => {
        set({ 
          currentConversation: [], 
          conversationId: null,
          currentResponse: null,
          streamingResponse: '',
          currentError: null,
        });
      },
      
      startNewConversation: () => {
        const newConversationId = Date.now().toString();
        set({ 
          currentConversation: [], 
          conversationId: newConversationId,
          currentResponse: null,
          streamingResponse: '',
          currentError: null,
        });
      },
      
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
      name: 'ai-store',
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