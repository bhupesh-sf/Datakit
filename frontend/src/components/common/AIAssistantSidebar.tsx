import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Send, 
  RefreshCw, 
  Command,
  MessageSquare,
  Database
} from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { useAppStore } from "@/store/appStore";
import { selectActiveFile, selectTableName } from "@/store/selectors/appSelectors";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAIOperations } from "@/hooks/ai/useAIOperations";
import { useDuckDBStore } from "@/store/duckDBStore";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import ModelSelector from "@/components/tabs/ai/ModelSelector";
import ErrorDisplay from "@/components/tabs/ai/ErrorDisplay";
import SidebarSQLQueryCard from "@/components/tabs/ai/SidebarSQLQueryCard";
import AuthModal from "@/components/auth/AuthModal";
import ApiKeyModal from "@/components/tabs/ai/ApiKeyModal";
import { validateAIInput } from "@/components/tabs/ai/utils/validation";

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
  onWidthChange
}) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("signup");
  const [isResizing, setIsResizing] = useState(false);

  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Store hooks
  const activeFile = useAppStore(selectActiveFile);
  const tableName = useAppStore(selectTableName);
  const { registeredTables, getTableSchema } = useDuckDBStore();
  const { isAuthenticated } = useAuth();

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
    currentResponse,
    streamingResponse,
    addTableContext,
    clearTableContexts,
  } = useAIStore();

  const { executeAIQueryStream, canExecute, extractSQLQueries } = useAIOperations();

  // No message navigation needed in sidebar - simpler experience

  // Automatically add current file's table to context (same as ContextBar)
  useEffect(() => {
    const setActiveTableContext = async () => {
      if (!tableName || !activeFile) return;
      
      // Clear all previous table contexts
      clearTableContexts();
      
      // Add only the active file's table
      try {
        const schema = await getTableSchema(tableName);
        if (schema) {
          addTableContext({
            tableName,
            schema,
            rowCount: activeFile.rowCount,
            description: activeFile.fileName || tableName,
          });
        }
      } catch (error) {
        console.error(`Failed to set table ${tableName} in context:`, error);
      }
    };
    
    setActiveTableContext();
  }, [tableName, activeFile, getTableSchema, addTableContext, clearTableContexts]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentConversation, streamingResponse]);

  // Simplified prompt management - no message navigation

  // Hide suggestions when user starts typing
  useEffect(() => {
    setShowSuggestions(prompt.length === 0 && currentConversation.length === 0);
  }, [prompt, currentConversation.length]);

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

  // Validation
  useEffect(() => {
    const hasRegisteredTables = registeredTables.size > 0;
    const validationError = validateAIInput(
      prompt,
      tableName,
      activeProvider,
      activeModel,
      multiTableContexts,
      hasRegisteredTables
    );
    setCurrentError(validationError);
  }, [
    prompt,
    tableName,
    activeProvider,
    activeModel,
    multiTableContexts,
    registeredTables,
    setCurrentError,
  ]);

  // Check if current provider is ready to use
  const isProviderReady = () => {
    if (!isAuthenticated) return false;
    
    if (activeProvider === 'datakit') return isAuthenticated;
    if (activeProvider === 'local') return isAuthenticated;
    if (activeProvider === 'ollama') return isAuthenticated;
    
    return isAuthenticated && apiKeys.has(activeProvider) && !!apiKeys.get(activeProvider);
  };

  const showSetupPrompt = !isProviderReady();

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
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

  const handleOpenAuthModal = (mode: "login" | "signup") => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const handleOpenSettings = () => {
    if (!isAuthenticated) {
      handleOpenAuthModal("login");
      return;
    }
    setShowApiKeyModal(true);
  };

  const getPlaceholderText = () => {
    if (!tableName) {
      return t('ai.prompts.placeholders.askAboutData');
    }

    const hasConversation = currentConversation.some((msg) => msg.role === 'user');
    if (hasConversation) {
      return t('ai.prompts.placeholders.followUp');
    }

    return t('ai.prompts.placeholders.askAboutTable', { tableName });
  };

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

  // Render chat messages
  const renderChatMessages = () => {
    if (currentConversation.length === 0 && !streamingResponse) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-white/20" />
            <p className="text-white/50 text-sm">
              {t('ai.assistant.welcome', { 
                defaultValue: 'Ask me anything about your data!' 
              })}
            </p>
          </div>
        </div>
      );
    }

    const displayResponse = streamingResponse || currentResponse;
    const sqlQueries = displayResponse ? extractSQLQueries(displayResponse) : [];

    return (
      <div className="space-y-4">
        {currentConversation.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-lg shadow-black/20 border border-slate-500/40'
                  : 'bg-gradient-to-br from-white/8 to-white/4 border border-white/15 text-white/90 shadow-sm'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="space-y-3">
                  {/* Split message content and SQL queries */}
                  {(() => {
                    const queries = extractSQLQueries(message.content);
                    if (queries.length === 0) {
                      return (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      );
                    }

                    // Simple text + SQL rendering
                    const parts = message.content.split(/```sql[\s\S]*?```/);
                    return (
                      <>
                        {parts.map((part, idx) => (
                          <React.Fragment key={idx}>
                            {part.trim() && (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {part.trim()}
                              </p>
                            )}
                            {queries[idx] && (
                              <SidebarSQLQueryCard
                                query={queries[idx]}
                                index={idx}
                                responseId={`sidebar-${index}`}
                                isPrimary={idx === 0}
                                activeFile={activeFile}
                              />
                            )}
                          </React.Fragment>
                        ))}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streamingResponse && (
          <div className="flex justify-start">
            <div className="max-w-[85%] p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/4 border border-white/15 text-white/90 shadow-sm">
              <div className="space-y-3">
                {(() => {
                  if (sqlQueries.length === 0) {
                    return (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {streamingResponse}
                      </p>
                    );
                  }

                  const parts = streamingResponse.split(/```sql[\s\S]*?```/);
                  return (
                    <>
                      {parts.map((part, idx) => (
                        <React.Fragment key={idx}>
                          {part.trim() && (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {part.trim()}
                            </p>
                          )}
                          {sqlQueries[idx] && (
                            <SidebarSQLQueryCard
                              query={sqlQueries[idx]}
                              index={idx}
                              responseId={`sidebar-streaming`}
                              isPrimary={idx === 0}
                              activeFile={activeFile}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </>
                  );
                })()}
              </div>
              {isProcessing && (
                <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>{t('ai.prompts.status.thinking')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={sidebarRef}
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed top-0 right-0 h-full bg-background border-l border-white/10 z-40 flex flex-col"
            style={{ width }}
          >
            {/* Resize handle */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20 transition-colors ${
                isResizing ? 'bg-primary/50' : ''
              }`}
              onMouseDown={handleMouseDown}
            />

            {/* Header - Minimal */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />
                <h3 className="text-sm font-medium text-white truncate">
                  {t('ai.assistant.title', { defaultValue: 'Assistant' })}
                </h3>
                {activeFile && tableName && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/20 border border-primary/30 rounded text-xs text-primary flex-shrink-0">
                    <span className="max-w-[80px] truncate">{tableName}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Model Selector - Minimal */}
                <div className={showSetupPrompt ? 'opacity-50 pointer-events-none' : ''}>
                  <ModelSelector compact />
                </div>

                {/* Refresh Button - Icon Only */}
                <Tooltip content={t('ai.prompts.actions.startNewChat')} placement="bottom">
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
              className="flex-1 overflow-y-auto p-4"
            >
              {showSuggestions ? (
                <div className="space-y-3">
                  <p className="text-xs text-white/50 mb-3">
                    {t('ai.prompts.suggestions.title')}:
                  </p>
                  {PROMPT_SUGGESTIONS(t).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => !showSetupPrompt && handleSuggestionClick(suggestion.prompt)}
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
                renderChatMessages()
              )}
            </div>

            {/* Input Area - Responsive padding */}
            <div className="border-t border-white/10 p-2 sm:p-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <textarea
                    ref={promptInputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholderText()}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm sm:text-base"
                    rows={2}
                    disabled={isProcessing || showSetupPrompt}
                  />

                  <div className="absolute bottom-2 right-2 flex items-center gap-1 sm:gap-2">
                    <div className="hidden sm:flex items-center gap-1 text-xs text-white/40 bg-black/30 px-2 py-1 rounded border border-white/10">
                      <Command className="h-3 w-3" />
                      <span>↵</span>
                    </div>

                    <button
                      type="submit"
                      disabled={!prompt.trim() || !canExecute || isProcessing || showSetupPrompt}
                      className={`p-2 rounded-md transition-all ${
                        prompt.trim() && canExecute && !isProcessing && !showSetupPrompt
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

                {/* Setup Prompt */}
                {showSetupPrompt && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <p className="text-xs text-white/50 text-center">
                      {t('ai.prompts.setup.configure')}
                    </p>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleOpenAuthModal("signup")}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs sm:text-sm"
                      >
                        {t('ai.prompts.setup.signUpCredits')}
                      </Button>

                      <Button
                        onClick={handleOpenSettings}
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm"
                      >
                        <span className="truncate">{t('ai.prompts.setup.useApiKeys')}</span>
                        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                          <img src={OpenAILogo} className="h-3 w-3 sm:h-4 sm:w-4 opacity-60" alt="OpenAI" />
                          <img src={AnthropicLogo} className="h-3 w-3 sm:h-4 sm:w-4 opacity-60" alt="Anthropic" />
                          <img src={OllamaLogo} className="h-3 w-3 sm:h-4 sm:w-4 opacity-60" alt="Ollama" />
                        </div>
                      </Button>
                    </div>

                    <p className="text-xs text-white/40 text-center">
                      {t('ai.prompts.setup.privacyNote')}
                    </p>
                  </motion.div>
                )}
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