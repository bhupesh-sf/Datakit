import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AIProvider,
  AIModel,
  LocalModel,
  AIQuery,
  MCPConnection,
} from '@/types/ai';
import { AIMessage } from '@/lib/ai/types';

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
  visualizationTokenUsage: { input: number; output: number } | null;
  currentError: string | null;

  // Conversation State
  currentConversation: AIMessage[];
  conversationId: string | null;
  currentMessageIndex: number;
  
  // File-aware conversations - maps fileId to conversation
  fileConversations: Map<string, AIMessage[]>;
  
  // File-aware response state - maps fileId to response state
  fileResponseStates: Map<string, {
    currentResponse: string | null;
    streamingResponse: string;
    currentError: string | null;
    isProcessing: boolean;
  }>;

  // Multiple table contexts
  multiTableContexts: Array<{
    tableName: string;
    schema: Array<{ name: string; type: string }>;
    sampleData?: any[];
    rowCount?: number;
    description?: string;
    isSelected: boolean;
  }>;

  // System prompt configuration
  systemPrompt: string;

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
  updateOllamaModels: (models: any[]) => void;

  // Context Actions
  addTableContext: (
    context: Omit<AIState['multiTableContexts'][0], 'isSelected'>
  ) => void;
  removeTableContext: (tableName: string) => void;
  toggleTableContext: (tableName: string) => void;
  clearTableContexts: () => void;

  // Query Actions
  setCurrentPrompt: (prompt: string) => void;
  addQueryToHistory: (query: AIQuery) => void;
  clearQueryHistory: () => void;
  setProcessing: (isProcessing: boolean) => void;
  setQueryResults: (results: QueryResults | null) => void;
  setCurrentResponse: (response: string | null) => void;
  setStreamingResponse: (response: string) => void;
  setCurrentTokenUsage: (
    usage: { input: number; output: number } | null
  ) => void;
  setVisualizationTokenUsage: (
    usage: { input: number; output: number } | null
  ) => void;
  setCurrentError: (error: string | null) => void;

  // Conversation Actions
  addMessageToConversation: (message: AIMessage) => void;
  clearConversation: () => void;
  startNewConversation: () => void;
  navigateToMessage: (index: number) => void;
  navigateToNextMessage: () => void;
  navigateToPreviousMessage: () => void;
  
  // File-aware conversation actions
  setActiveFileConversation: (fileId: string | null) => void;
  addMessageToFileConversation: (fileId: string, message: AIMessage) => void;
  clearFileConversation: (fileId: string) => void;

  // Model Actions
  downloadLocalModel: (modelId: string) => Promise<void>;
  removeLocalModel: (modelId: string) => void;
  updateModelDownloadProgress: (modelId: string, progress: number) => void;

  // MCP Actions
  addMCPConnection: (connection: MCPConnection) => void;
  removeMCPConnection: (connectionId: string) => void;
  setActiveMCPConnection: (connectionId: string | null) => void;
  updateMCPConnectionStatus: (
    connectionId: string,
    status: MCPConnection['status']
  ) => void;

  // UI Actions
  toggleModelSelector: () => void;
  toggleApiKeyModal: () => void;
  setSplitViewMode: (mode: 'vertical' | 'horizontal') => void;
  setPromptEditorHeight: (height: number) => void;
  setSidebarWidth: (width: number) => void;
  toggleDataContext: () => void;
  toggleQueryHistory: () => void;

  // Settings Actions
  updateSettings: (
    settings: Partial<{
      autoExecuteSQL: boolean;
      showCostEstimates: boolean;
      maxHistoryItems: number;
    }>
  ) => void;

  // Initialize default models
  initializeModels: () => void;
}

// Default available models
const DEFAULT_MODELS: Map<AIProvider, AIModel[]> = new Map([
  [
    'datakit',
    [
      {
        id: 'datakit-smart',
        name: 'Smart',
        provider: 'datakit',
        type: 'chat',
        contextWindow: 200000,
        costPer1kTokens: { input: 0.3, output: 1.5 }, // Credits per 1K tokens
        capabilities: [],
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
        capabilities: [],
        requiresApiKey: false,
        description: 'Powered by Claude 3.5 Haiku - Economical',
      },
    ],
  ],
  [
    'ollama',
    [
      {
        id: 'llama3.2',
        name: 'Llama 3.2',
        provider: 'ollama',
        type: 'chat',
        contextWindow: 128000,
        costPer1kTokens: { input: 0, output: 0 },
        capabilities: [],
        requiresApiKey: false,
        isLocal: true,
        description: 'Latest Llama model - Great for general tasks',
      },
      {
        id: 'mistral',
        name: 'Mistral',
        provider: 'ollama',
        type: 'chat',
        contextWindow: 8192,
        costPer1kTokens: { input: 0, output: 0 },
        capabilities: [],
        requiresApiKey: false,
        isLocal: true,
        description: 'Fast and efficient model',
      },
      {
        id: 'codellama',
        name: 'Code Llama',
        provider: 'ollama',
        type: 'chat',
        contextWindow: 16384,
        costPer1kTokens: { input: 0, output: 0 },
        capabilities: [],
        requiresApiKey: false,
        isLocal: true,
        description: 'Specialized for code and SQL generation',
      },
    ],
  ],
  [
    'openai',
    [
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
    ],
  ],
  [
    'anthropic',
    [
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
    ],
  ],
  [
    'groq',
    [
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
    ],
  ],
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
      visualizationTokenUsage: null,
      currentError: null,

      currentConversation: [],
      conversationId: null,
      currentMessageIndex: -1,
      
      fileConversations: new Map(),
      fileResponseStates: new Map(),

      multiTableContexts: [],
      systemPrompt:
        'You are a SQL expert helping users query their data using DuckDB syntax.',

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

      updateOllamaModels: (models) => {
        set((state) => {
          const newAvailableModels = new Map(state.availableModels);

          // Convert Ollama models to AIModel format
          const ollamaAIModels: AIModel[] = models.map((model) => ({
            id: model.name || model.model,
            name: model.name || model.model,
            provider: 'ollama' as AIProvider,
            type: 'chat',
            contextWindow: null,
            costPer1kTokens: null,
            capabilities: [],
            requiresApiKey: false,
            isLocal: true,
            description: `${formatSize(model.size)} - Modified ${formatDate(
              model.modified_at
            )}`,
          }));

          // Update the models for Ollama provider
          newAvailableModels.set('ollama', ollamaAIModels);

          return { availableModels: newAvailableModels };
        });

        // Helper functions for formatting
        function formatSize(bytes: number): string {
          const gb = bytes / (1024 * 1024 * 1024);
          return gb.toFixed(1) + ' GB';
        }

        function formatDate(dateString: string): string {
          return new Date(dateString).toLocaleDateString();
        }
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

      setProcessing: (isProcessing) => {
        set((state) => {
          // Update global state
          const updates: any = { isProcessing };
          
          // Also update current file's response state if we have an active file
          if (state.conversationId?.startsWith('file_')) {
            const fileId = state.conversationId.replace('file_', '');
            const updatedFileResponseStates = new Map(state.fileResponseStates);
            const currentFileState = updatedFileResponseStates.get(fileId) || {
              currentResponse: null,
              streamingResponse: "",
              currentError: null,
              isProcessing: false,
            };
            updatedFileResponseStates.set(fileId, {
              ...currentFileState,
              isProcessing,
            });
            updates.fileResponseStates = updatedFileResponseStates;
          }
          
          return updates;
        });
      },

      setQueryResults: (results) => set({ queryResults: results }),

      setCurrentResponse: (response) => {
        set((state) => {
          // Update global state
          const updates: any = { currentResponse: response };
          
          // Also update current file's response state if we have an active file
          if (state.conversationId?.startsWith('file_')) {
            const fileId = state.conversationId.replace('file_', '');
            const updatedFileResponseStates = new Map(state.fileResponseStates);
            const currentFileState = updatedFileResponseStates.get(fileId) || {
              currentResponse: null,
              streamingResponse: "",
              currentError: null,
              isProcessing: false,
            };
            updatedFileResponseStates.set(fileId, {
              ...currentFileState,
              currentResponse: response,
            });
            updates.fileResponseStates = updatedFileResponseStates;
          }
          
          return updates;
        });
      },

      setStreamingResponse: (response) => {
        set((state) => {
          // Update global state
          const updates: any = { streamingResponse: response };
          
          // Also update current file's response state if we have an active file
          if (state.conversationId?.startsWith('file_')) {
            const fileId = state.conversationId.replace('file_', '');
            const updatedFileResponseStates = new Map(state.fileResponseStates);
            const currentFileState = updatedFileResponseStates.get(fileId) || {
              currentResponse: null,
              streamingResponse: "",
              currentError: null,
              isProcessing: false,
            };
            updatedFileResponseStates.set(fileId, {
              ...currentFileState,
              streamingResponse: response,
            });
            updates.fileResponseStates = updatedFileResponseStates;
          }
          
          return updates;
        });
      },

      setCurrentTokenUsage: (usage) => set({ currentTokenUsage: usage }),
      setVisualizationTokenUsage: (usage) =>
        set({ visualizationTokenUsage: usage }),

      setCurrentError: (error) => {
        set((state) => {
          // Update global state
          const updates: any = { currentError: error };
          
          // Also update current file's response state if we have an active file
          if (state.conversationId?.startsWith('file_')) {
            const fileId = state.conversationId.replace('file_', '');
            const updatedFileResponseStates = new Map(state.fileResponseStates);
            const currentFileState = updatedFileResponseStates.get(fileId) || {
              currentResponse: null,
              streamingResponse: "",
              currentError: null,
              isProcessing: false,
            };
            updatedFileResponseStates.set(fileId, {
              ...currentFileState,
              currentError: error,
            });
            updates.fileResponseStates = updatedFileResponseStates;
          }
          
          return updates;
        });
      },

      addTableContext: (context) => {
        set((state) => {
          const existing = state.multiTableContexts.find(
            (c) => c.tableName === context.tableName
          );
          if (existing) {
            return state;
          }
          return {
            multiTableContexts: [
              ...state.multiTableContexts,
              { ...context, isSelected: true },
            ],
          };
        });
      },

      removeTableContext: (tableName) => {
        set((state) => ({
          multiTableContexts: state.multiTableContexts.filter(
            (c) => c.tableName !== tableName
          ),
        }));
      },

      toggleTableContext: (tableName) => {
        set((state) => ({
          multiTableContexts: state.multiTableContexts.map((c) =>
            c.tableName === tableName ? { ...c, isSelected: !c.isSelected } : c
          ),
        }));
      },

      clearTableContexts: () => set({ multiTableContexts: [] }),

      addMessageToConversation: (message) => {
        set((state) => {
          const newConversation = [...state.currentConversation, message];
          // Keep conversation manageable (last 20 messages = ~10 exchanges)
          if (newConversation.length > 20) {
            newConversation.splice(0, newConversation.length - 20);
          }

          // If this is a user message, update the current message index to point to the virtual "new message" index
          let newMessageIndex = state.currentMessageIndex;
          if (message.role === 'user') {
            const userMessages = newConversation.filter(
              (msg) => msg.role === 'user'
            );
            newMessageIndex = userMessages.length; // Point to virtual index for new message
          }

          return {
            currentConversation: newConversation,
            currentMessageIndex: newMessageIndex,
          };
        });
      },

      clearConversation: () => {
        set((state) => {
          const updates: any = {
            currentConversation: [],
            conversationId: null,
            currentResponse: null,
            streamingResponse: '',
            currentError: null,
            currentMessageIndex: -1,
          };
          
          // If we're clearing a file conversation, also clear its response state
          if (state.conversationId?.startsWith('file_')) {
            const fileId = state.conversationId.replace('file_', '');
            const updatedFileResponseStates = new Map(state.fileResponseStates);
            updatedFileResponseStates.delete(fileId);
            updates.fileResponseStates = updatedFileResponseStates;
          }
          
          return updates;
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
          currentMessageIndex: -1,
        });
      },

      navigateToMessage: (index) => {
        set({ currentMessageIndex: index });
      },

      navigateToNextMessage: () => {
        set((state) => {
          const userMessages = state.currentConversation.filter(
            (msg) => msg.role === 'user'
          );
          const maxIndex = userMessages.length; // Include virtual index for unsent message
          if (state.currentMessageIndex < maxIndex) {
            return { currentMessageIndex: state.currentMessageIndex + 1 };
          }
          return state;
        });
      },

      navigateToPreviousMessage: () => {
        set((state) => {
          if (state.currentMessageIndex > 0) {
            return { currentMessageIndex: state.currentMessageIndex - 1 };
          }
          return state;
        });
      },

      // File-aware conversation actions
      setActiveFileConversation: (fileId) => {
        set((state) => {
          if (!fileId) {
            return {
              currentConversation: [],
              conversationId: null,
              currentMessageIndex: -1,
              currentResponse: null,
              streamingResponse: "",
              currentError: null,
              isProcessing: false,
            };
          }
          
          const fileConversation = state.fileConversations.get(fileId) || [];
          const fileResponseState = state.fileResponseStates.get(fileId) || {
            currentResponse: null,
            streamingResponse: "",
            currentError: null,
            isProcessing: false,
          };
          
          return {
            currentConversation: fileConversation,
            conversationId: `file_${fileId}`,
            currentMessageIndex: fileConversation.filter(msg => msg.role === 'user').length,
            currentResponse: fileResponseState.currentResponse,
            streamingResponse: fileResponseState.streamingResponse,
            currentError: fileResponseState.currentError,
            isProcessing: fileResponseState.isProcessing,
          };
        });
      },

      addMessageToFileConversation: (fileId, message) => {
        set((state) => {
          const updatedFileConversations = new Map(state.fileConversations);
          const currentConversation = updatedFileConversations.get(fileId) || [];
          const newConversation = [...currentConversation, message];
          
          // Keep conversation manageable (last 20 messages = ~10 exchanges)
          if (newConversation.length > 20) {
            newConversation.splice(0, newConversation.length - 20);
          }
          
          updatedFileConversations.set(fileId, newConversation);
          
          // If this is the active file, also update current conversation
          const isActiveFile = state.conversationId === `file_${fileId}`;
          let updates: any = { fileConversations: updatedFileConversations };
          
          if (isActiveFile) {
            let newMessageIndex = state.currentMessageIndex;
            if (message.role === 'user') {
              const userMessages = newConversation.filter(msg => msg.role === 'user');
              newMessageIndex = userMessages.length;
            }
            
            updates = {
              ...updates,
              currentConversation: newConversation,
              currentMessageIndex: newMessageIndex,
            };
          }
          
          return updates;
        });
      },

      clearFileConversation: (fileId) => {
        set((state) => {
          const updatedFileConversations = new Map(state.fileConversations);
          const updatedFileResponseStates = new Map(state.fileResponseStates);
          
          updatedFileConversations.delete(fileId);
          updatedFileResponseStates.delete(fileId);
          
          // If this is the active file, also clear current conversation
          const isActiveFile = state.conversationId === `file_${fileId}`;
          let updates: any = { 
            fileConversations: updatedFileConversations,
            fileResponseStates: updatedFileResponseStates,
          };
          
          if (isActiveFile) {
            updates = {
              ...updates,
              currentConversation: [],
              currentMessageIndex: -1,
              currentResponse: null,
              streamingResponse: '',
              currentError: null,
              isProcessing: false,
            };
          }
          
          return updates;
        });
      },

      downloadLocalModel: async (modelId) => {
        try {
          const { aiService } = await import('@/lib/ai/aiService');
          const { modelManager } = await import('@/lib/ai/modelManager');

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
          const model = get()
            .availableModels.get('local')
            ?.find((m) => m.id === modelId);
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
          mcpConnections: state.mcpConnections.filter(
            (c) => c.id !== connectionId
          ),
          activeMCPConnection:
            state.activeMCPConnection === connectionId
              ? null
              : state.activeMCPConnection,
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
        if (
          !state.activeModel &&
          state.availableModels.get(state.activeProvider)
        ) {
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
        systemPrompt: state.systemPrompt,
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
