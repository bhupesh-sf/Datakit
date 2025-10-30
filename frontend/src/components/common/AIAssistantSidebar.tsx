import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  RefreshCw,
  Command,
  MessageSquare,
  FileText,
  FileSpreadsheet,
  Database,
  Package,
  Braces,
  Cloud,
  TableProperties
} from 'lucide-react';

import { useAIStore } from '@/store/aiStore';
import { useAppStore } from '@/store/appStore';
import {
  selectActiveFile,
  selectTableName,
} from '@/store/selectors/appSelectors';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAIOperations } from '@/hooks/ai/useAIOperations';
import { useDuckDBStore } from '@/store/duckDBStore';
import { usePythonStore } from '@/store/pythonStore';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import ModelSelector from '@/components/tabs/ai/ModelSelector';
import ErrorDisplay from '@/components/tabs/ai/ErrorDisplay';
import SidebarSQLQueryCard from '@/components/tabs/ai/SidebarSQLQueryCard';
import SidebarPythonCodeCard from '@/components/tabs/ai/SidebarPythonCodeCard';
import StatusIndicator from '@/components/tabs/ai/StatusIndicator';
import ContextPills from '@/components/tabs/ai/ContextPills';
import AuthModal from '@/components/auth/AuthModal';
import ApiKeyModal from '@/components/tabs/ai/ApiKeyModal';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import {
  useStreamingStatus,
  useContextPills,
} from '@/hooks/ai/useStreamingStatus';
import { validateAIInput } from '@/components/tabs/ai/utils';

import OpenAILogo from '@/assets/openai.webp';
import AnthropicLogo from '@/assets/anthropic.webp';
import OllamaLogo from '@/assets/ollama.webp';

interface AIAssistantSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

const PROMPT_SUGGESTIONS = (t: any) => [
  {
    title: t('ai.prompts.suggestions.exploreData.title'),
    prompt: t('ai.prompts.suggestions.exploreData.prompt'),
  },
  {
    title: t('ai.prompts.suggestions.findPatterns.title'),
    prompt: t('ai.prompts.suggestions.findPatterns.prompt'),
  },
  {
    title: t('ai.prompts.suggestions.dataQuality.title'),
    prompt: t('ai.prompts.suggestions.dataQuality.prompt'),
  },
  {
    title: t('ai.prompts.suggestions.quickStats.title'),
    prompt: t('ai.prompts.suggestions.quickStats.prompt'),
  },
];

const AIAssistantSidebar: React.FC<AIAssistantSidebarProps> = ({
  isOpen,
  onClose,
  width = 400,
  onWidthChange,
}) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>(
    'signup'
  );
  const [isResizing, setIsResizing] = useState(false);
  const [showFullStreamingContent, setShowFullStreamingContent] =
    useState(false);

  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Store hooks
  const activeFile = useAppStore(selectActiveFile);
  const tableName = useAppStore(selectTableName);
  const { registeredTables, getTableSchema } = useDuckDBStore();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Get current view mode for context-aware behavior
  const currentViewMode = useAppStore((state) => {
    const activeFile = selectActiveFile(state);
    const emptyStateViewMode = state.emptyStateViewMode;
    return activeFile?.viewMode || emptyStateViewMode;
  });

  // Python store hooks
  const { createCell, setActiveCellId } = usePythonStore();

  const {
    isProcessing,
    clearConversation,
    clearFileConversation,
    setQueryResults,
    currentConversation,
    currentError,
    setCurrentError,
    activeProvider,
    activeModel,
    apiKeys,
    multiTableContexts,
    streamingResponse,
    addTableContext,
    clearTableContexts,
    currentPrompt,
    setCurrentPrompt,
  } = useAIStore();

  const {
    executeAIQueryStream,
    canExecute,
    extractSQLQueries,
    extractPythonQueries,
  } = useAIOperations();

  // Smart streaming status
  const streamingState = useStreamingStatus(
    streamingResponse,
    isProcessing,
    currentPrompt || prompt
  );
  const contextPills = useContextPills(streamingState);

  // Memoize table context setup to reduce re-renders
  const activeTableContext = useMemo(() => {
    if (!tableName || !activeFile) return null;
    return {
      tableName,
      rowCount: activeFile.rowCount,
      description: activeFile.fileName || tableName,
      fileId: activeFile.id,
    };
  }, [tableName, activeFile?.id, activeFile?.rowCount, activeFile?.fileName]);

  // Set table context only when the context data actually changes
  useEffect(() => {
    if (!activeTableContext) return;

    const setActiveTableContext = async () => {
      // Clear all previous table contexts
      clearTableContexts();

      // Add only the active file's table
      try {
        const schema = await getTableSchema(activeTableContext.tableName);
        if (schema) {
          addTableContext({
            tableName: activeTableContext.tableName,
            schema,
            rowCount: activeTableContext.rowCount,
            description: activeTableContext.description,
          });
        }
      } catch (error) {
        console.error(
          `Failed to set table ${activeTableContext.tableName} in context:`,
          error
        );
      }
    };

    setActiveTableContext();
  }, [activeTableContext, getTableSchema, addTableContext, clearTableContexts]);

  // Auto-scroll to bottom when new messages arrive (but not when showing more content)
  useEffect(() => {
    if (chatScrollRef.current && !showFullStreamingContent) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentConversation, streamingResponse, showFullStreamingContent]);

  // Reset show more state when new streaming starts
  useEffect(() => {
    if (isProcessing) {
      setShowFullStreamingContent(false);
    }
  }, [isProcessing]);

  // Sync AI store's currentPrompt to local prompt state (for "Ask AI to Fix" functionality)
  useEffect(() => {
    if (currentPrompt && currentPrompt !== prompt) {
      setPrompt(currentPrompt);
      // Clear the store's currentPrompt after setting it
      setCurrentPrompt('');
      // Focus the input for user to review and send
      promptInputRef.current?.focus();
    }
  }, [currentPrompt, prompt, setCurrentPrompt]);

  // Memoize suggestions visibility to prevent unnecessary updates
  const shouldShowSuggestions = useMemo(() => {
    return prompt.length === 0 && currentConversation.length === 0;
  }, [prompt.length, currentConversation.length]);

  useEffect(() => {
    setShowSuggestions(shouldShowSuggestions);
  }, [shouldShowSuggestions]);

  // Auto-resize textarea
  useEffect(() => {
    if (promptInputRef.current) {
      promptInputRef.current.style.height = 'auto';
      promptInputRef.current.style.height = `${Math.min(
        promptInputRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [prompt]);

  // Memoize validation inputs to reduce validation calls
  const validationInputs = useMemo(
    () => ({
      prompt,
      tableName,
      activeProvider,
      activeModel,
      multiTableContexts,
      hasRegisteredTables: registeredTables.size > 0,
    }),
    [
      prompt,
      tableName,
      activeProvider,
      activeModel,
      multiTableContexts,
      registeredTables.size,
    ]
  );

  // Validation - only run when inputs actually change
  useEffect(() => {
    const validationError = validateAIInput(
      validationInputs.prompt,
      validationInputs.tableName,
      validationInputs.activeProvider,
      validationInputs.activeModel,
      validationInputs.multiTableContexts,
      validationInputs.hasRegisteredTables
    );
    setCurrentError(validationError);
  }, [validationInputs, setCurrentError]);

  // Check if current provider is ready to use
  const isProviderReady = () => {
    if (!isAuthenticated) return false;

    if (activeProvider === 'datakit') return isAuthenticated;
    if (activeProvider === 'local') return isAuthenticated;
    if (activeProvider === 'ollama') return isAuthenticated;

    return (
      isAuthenticated &&
      apiKeys.has(activeProvider) &&
      !!apiKeys.get(activeProvider)
    );
  };

  const showSetupPrompt = useMemo(
    () => !isProviderReady(),
    [isAuthenticated, activeProvider, apiKeys]
  );

  const validateBeforeSubmit = () => {
    const hasRegisteredTables = registeredTables.size > 0;
    const validationError = validateAIInput(
      prompt,
      tableName,
      activeProvider,
      activeModel,
      multiTableContexts,
      hasRegisteredTables
    );

    if (validationError) {
      setCurrentError(validationError);
      return false;
    }

    if (!canExecute) {
      if (activeProvider === 'datakit') {
        setCurrentError('authentication required');
      } else {
        setCurrentError(`AI provider ${activeProvider} not configured`);
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!prompt.trim() || isProcessing) return;
    if (!validateBeforeSubmit()) return;

    try {
      await executeAIQueryStream(prompt);
      setPrompt('');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      setCurrentError(errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestionPrompt: string) => {
    setPrompt(suggestionPrompt);
    promptInputRef.current?.focus();
  };

  const handleRefreshChat = () => {
    if (activeFile?.id) {
      clearFileConversation(activeFile.id);
    } else {
      clearConversation();
    }

    setQueryResults(null);
    setPrompt('');
    setShowSuggestions(true);
    setCurrentError(null);
    promptInputRef.current?.focus();
  };

  const handleOpenAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const handleOpenSettings = () => {
    if (!isAuthenticated) {
      handleOpenAuthModal('login');
      return;
    }
    setShowApiKeyModal(true);
  };

  const handleSendToNotebook = useCallback(
    async (code: string) => {
      try {
        // Switch to notebook view
        const { changeViewMode } = useAppStore.getState();
        changeViewMode('notebook');

        // Create new cell with the code
        const cellId = createCell('code', code);

        // Set as active cell
        setActiveCellId(cellId);

        // Close the AI assistant to show the notebook
        onClose();
      } catch (error) {
        console.error('Failed to send code to notebook:', error);
        setCurrentError('Failed to send code to notebook');
      }
    },
    [createCell, setActiveCellId, onClose, setCurrentError]
  );

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(400, Math.min(600, startWidth + deltaX));
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  // Memoize extraction functions to prevent unnecessary re-renders
  const memoizedExtractSQLQueries = useCallback(
    (content: string) => {
      return extractSQLQueries(content);
    },
    [extractSQLQueries]
  );

  const memoizedExtractPythonQueries = useCallback(
    (content: string) => {
      return extractPythonQueries(content);
    },
    [extractPythonQueries]
  );

  // Memoize the message rendering to prevent unnecessary re-renders
  const renderedMessages = useMemo(() => {
    if (
      currentConversation.length === 0 &&
      !streamingResponse &&
      !isProcessing
    ) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="relative mb-4">
              <MessageSquare className="h-12 w-12 mx-auto text-white/20" />
              <div className="absolute inset-0 h-12 w-12 mx-auto bg-gradient-to-r from-primary/20 to-blue-400/20 rounded-lg blur-xl" />
            </div>
            <p className="text-white/50 text-sm">
              {t('ai.assistant.welcome', {
                defaultValue: 'Ask me anything about your file',
              })}
            </p>
          </div>
        </div>
      );
    }

    const messages = [];

    // Add regular conversation messages
    messages.push(
      ...currentConversation.map((message, index) => {
        // Check if this message contains SQL queries for special layout
        const sqlQueries =
          message.role === 'assistant'
            ? memoizedExtractSQLQueries(message.content)
            : [];
        const hasSQLCards = sqlQueries.length > 0;

        // Create stable key - use index and content hash instead of timestamp
        const messageKey = `message-${index}-${message.content
          .slice(0, 20)
          .replace(/\s+/g, '-')}`;

        return (
          <div
            key={messageKey}
            className={
              hasSQLCards
                ? 'w-full'
                : `flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`
            }
          >
            {hasSQLCards ? (
              // Special layout for SQL card messages - calculated width to avoid CSS variables
              <div
                className="ml-1 -mr-4 bg-gradient-to-br from-white/8 to-white/4 border border-white/15 text-white/90 shadow-sm rounded-lg p-4"
                style={{
                  width: `${width * 0.75}px`,
                  minWidth: `${width * 0.75}px`,
                }}
              >
                <SidebarSQLQueryCard
                  key={`sql-card-${index}-${sqlQueries[0]
                    .slice(0, 30)
                    .replace(/\s+/g, '-')}`}
                  query={sqlQueries[0]}
                  index={0}
                  responseId={`sidebar-${index}`}
                  isPrimary={true}
                  responseText={message.content}
                  activeFile={activeFile}
                />
              </div>
            ) : (
              // Normal message layout
              <div
                className={`${
                  message.role === 'user' ? 'max-w-[85%]' : 'max-w-[98%]'
                } p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-lg shadow-black/20 border border-slate-500/40'
                    : 'bg-gradient-to-br from-white/8 to-white/4 border border-white/15 text-white/90 shadow-sm'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="space-y-3">
                    {(() => {
                      const pythonCodes = memoizedExtractPythonQueries(
                        message.content
                      );

                      // Handle non-code responses (clarifications, explanations, etc.)
                      if (pythonCodes.length === 0) {
                        return (
                          <div className="text-sm leading-relaxed">
                            <MarkdownRenderer
                              content={message.content}
                              className="text-white/90"
                            />
                          </div>
                        );
                      }

                      // Show Python cards for non-SQL messages
                      return (
                        <SidebarPythonCodeCard
                          key={`primary-python-${index}`}
                          code={pythonCodes[0]}
                          index={0}
                          onSendToNotebook={handleSendToNotebook}
                          activeFile={activeFile}
                        />
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            )}
          </div>
        );
      })
    );

    // Add status indicator as a chat message when processing
    if (isProcessing) {
      messages.push(
        <div key="status-indicator" className="flex justify-start">
          <div className="max-w-[98%] p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/4 border border-white/15 text-white/90 shadow-sm">
            <StatusIndicator
              status={streamingState.currentStatus}
              progress={streamingState.progress}
              phase={streamingState.phase}
              isVisible={true}
              compact
            />
            {contextPills.length > 0 && (
              <div className="mt-2">
                <ContextPills pills={contextPills} compact />
              </div>
            )}
          </div>
        </div>
      );
    }

    return messages;
  }, [
    currentConversation,
    width,
    activeFile,
    memoizedExtractSQLQueries,
    memoizedExtractPythonQueries,
    handleSendToNotebook,
    t,
    streamingResponse,
    isProcessing,
    streamingState,
    contextPills,
  ]);


  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={sidebarRef}
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed top-0 right-0 h-full bg-background border-l border-white/10 z-40 flex flex-col"
            style={{ width } as React.CSSProperties}
          >
            {/* Resize handle */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20 transition-colors ${
                isResizing ? 'bg-primary/50' : ''
              }`}
              onMouseDown={handleMouseDown}
            />
            
            {/* Invisible wider resize area for easier grabbing */}
            <div
              className="absolute left-0 top-0 bottom-0 w-6 cursor-ew-resize z-50"
              onMouseDown={handleMouseDown}
            />

            {/* Privacy Notice Banner */}
            {showSetupPrompt && (
              <div className="bg-white/5 border-b border-white/10 px-4 py-3">
                <div className="text-center">
                  <p className="text-xs text-white/70 font-normal leading-relaxed">
                    <span className="font-semibold text-white">
                      DataKit Assistant
                    </span>
                    <span className="text-white/60">
                      {' '}
                      models only see your tables structure, not your actual
                      data
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Setup Buttons */}
            {showSetupPrompt && (
              <div className="px-3 py-4 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
                <p className="text-xs text-white/60 text-center mb-4 font-medium">
                  Configure your AI model to start asking questions
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => handleOpenAuthModal('signup')}
                    variant="outline"
                    size="md"
                    disabled={isAuthLoading}
                    className="w-full text-sm font-medium py-3 h-auto"
                  >
                    {t('ai.prompts.setup.signUpCredits')}
                  </Button>

                  <Button
                    onClick={handleOpenSettings}
                    variant="outline"
                    disabled={isAuthLoading}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm group hover:bg-white/5 h-auto"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white/90">Login</span>
                      <span className="text-xs text-white/40 italic">• use your own API keys</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-60 transition-opacity">
                      <img
                        src={OpenAILogo}
                        className="h-4 w-4"
                        alt="OpenAI"
                      />
                      <img
                        src={AnthropicLogo}
                        className="h-4 w-4"
                        alt="Anthropic"
                      />
                      <img
                        src={OllamaLogo}
                        className="h-4 w-4"
                        alt="Ollama"
                      />
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {/* Header - Minimal */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h3 className="text-sm font-medium text-white truncate">
                  {t('ai.assistant.title', { defaultValue: 'Assistant' })}
                </h3>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Model Selector - Minimal */}
                <div
                  className={
                    showSetupPrompt ? 'opacity-50 pointer-events-none' : ''
                  }
                >
                  <ModelSelector compact />
                </div>

                {/* Refresh Button - Icon Only */}
                <Tooltip
                  content={t('ai.prompts.actions.startNewChat')}
                  placement="bottom"
                >
                  <button
                    onClick={handleRefreshChat}
                    disabled={showSetupPrompt || isProcessing}
                    className={`p-1 rounded transition-all ${
                      showSetupPrompt || isProcessing
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-6 relative"
            >
              {/* Notebook Mode Coming Soon Banner */}
              {currentViewMode === 'notebook' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-10 flex items-center justify-center bg-background/30 pointer-events-none"
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0
                  }}
                >
                  <div className="text-center px-4">
                    <p className="text-white/80 text-sm font-medium mb-1">
                      Coming Soon
                    </p>
                    <p className="text-white/60 text-xs">
                      Soon you can write your Python cells with help of DataKit Assistant
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Regular Chat Content */}
              <div
                className={
                  currentViewMode === 'notebook'
                    ? 'opacity-20 pointer-events-none'
                    : ''
                }
              >
                {showSuggestions ? (
                  <div className="space-y-3">
                    <p className="text-xs text-white/50 mb-3">
                      {t('ai.prompts.suggestions.title')}:
                    </p>
                    {PROMPT_SUGGESTIONS(t).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          !showSetupPrompt &&
                          handleSuggestionClick(suggestion.prompt)
                        }
                        disabled={showSetupPrompt}
                        className={`w-full text-left p-3 border rounded-lg transition-all cursor-pointer ${
                          showSetupPrompt
                            ? 'bg-white/3 border-white/5 cursor-not-allowed opacity-50'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 group'
                        }`}
                      >
                        <div className="font-medium text-sm text-white/90 mb-1">
                          {suggestion.title}
                        </div>
                        <div
                          className={`text-xs ${
                            showSetupPrompt
                              ? 'text-white/40'
                              : 'text-white/60 group-hover:text-white/70'
                          }`}
                        >
                          {suggestion.prompt}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {renderedMessages}
                  </div>
                )}
              </div>
            </div>

            {/* Input Area - Responsive padding */}
            <div
              className={`border-t border-white/10 p-2 sm:p-4 ${
                currentViewMode === 'notebook'
                  ? 'opacity-20 pointer-events-none'
                  : ''
              }`}
            >
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* File/Table indicator */}
                {activeFile && tableName && (
                  <div className="relative mb-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary/15 to-gray-500/5 border-l-2 border-l-primary/60 border-y border-r border-white/10 rounded-lg max-w-[75%] group hover:from-primary/20 hover:to-gray-500/8 transition-all duration-200">
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        {(() => {
                          const fileType = activeFile.fileExtension;
                          const iconProps = { size: 14, strokeWidth: 1.5 };

                          switch (fileType) {
                            case 'csv':
                            case 'excel':
                            case 'xlsx':
                            case 'xls':
                              return (
                                <FileSpreadsheet
                                  {...iconProps}
                                  className="text-emerald-400"
                                />
                              );
                            case 'json':
                              return (
                                <Braces
                                  {...iconProps}
                                  className="text-amber-400"
                                />
                              );
                            case 'parquet':
                              return (
                                <Package
                                  {...iconProps}
                                  className="text-cyan-400"
                                />
                              );
                            case 'txt':
                              return (
                                <FileText
                                  {...iconProps}
                                  className="text-slate-400"
                                />
                              );
                            case 'duckdb':
                              return (
                                <Database
                                  {...iconProps}
                                  className="text-violet-400"
                                />
                              );
                            case 'remote':
                              return (
                                <Cloud
                                  {...iconProps}
                                  className="text-blue-400"
                                />
                              );
                            case 'query':
                              return (
                                <TableProperties
                                  {...iconProps}
                                  className="text-blue-400"
                                />
                              );
                            default:
                              return (
                                <FileText
                                  {...iconProps}
                                  className="text-white/50"
                                />
                              );
                          }
                        })()}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-white/90 font-medium truncate block">
                          {tableName}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <textarea
                    ref={promptInputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your file"
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm sm:text-base"
                    rows={2}
                    disabled={isProcessing || showSetupPrompt}
                  />

                  <div className="absolute bottom-3 right-2 flex items-center gap-1 sm:gap-2">
                    <div className="hidden sm:flex items-center gap-1 text-xs text-white/40 bg-black/30 px-2 py-1 rounded border border-white/10">
                      <Command className="h-3 w-3" />
                      <span>↵</span>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        !prompt.trim() ||
                        !canExecute ||
                        isProcessing ||
                        showSetupPrompt
                      }
                      className={`p-2 rounded-md transition-all ${
                        prompt.trim() &&
                        canExecute &&
                        !isProcessing &&
                        !showSetupPrompt
                          ? 'bg-primary text-white hover:bg-primary/80'
                          : 'bg-white/10 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <ErrorDisplay
                  error={currentError}
                  onDismiss={() => setCurrentError(null)}
                  onRetry={() => {
                    setCurrentError(null);
                    if (prompt.trim()) {
                      handleSubmit();
                    }
                  }}
                />

              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authModalMode}
      />
    </>
  );
};

export default AIAssistantSidebar;
