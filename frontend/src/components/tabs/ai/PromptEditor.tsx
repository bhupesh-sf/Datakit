import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Database, Sparkles, Code, BarChart, AlertCircle } from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { useAppStore } from "@/store/appStore";
import { selectTableName, selectActiveFileInfo } from "@/store/selectors/appSelectors";
import { useAIOperations } from "@/hooks/ai/useAIOperations";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface PromptEditorProps {
  isFullscreen?: boolean;
}

const PROMPT_SUGGESTIONS = [
  {
    icon: <Database className="h-4 w-4" />,
    title: "Explore Data",
    prompt: "Give me an overview of this dataset - what columns do we have and what insights can you find?",
    category: "analysis"
  },
  {
    icon: <Code className="h-4 w-4" />,
    title: "Quick Query",
    prompt: "Show me the top 10 rows sorted by the most interesting column",
    category: "query"
  },
  {
    icon: <BarChart className="h-4 w-4" />,
    title: "Find Trends",
    prompt: "What are the most significant patterns and trends in this data?",
    category: "insights"
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    title: "Data Quality",
    prompt: "Check this data for any missing values, duplicates, or quality issues",
    category: "validation"
  }
];

const PromptEditor: React.FC<PromptEditorProps> = ({ isFullscreen = false }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  
  const {
    currentPrompt,
    isProcessing,
    activeProvider,
    activeModel,
    apiKeys,
    showCostEstimates,
    setCurrentPrompt,
  } = useAIStore();

  const {
    executeAIQuery,
    executeAIQueryStream,
    canExecute: aiCanExecute,
  } = useAIOperations();

  const tableName = useAppStore(selectTableName);
  const activeFileInfo = useAppStore(selectActiveFileInfo);

  // Check if we can execute queries
  const canExecute = aiCanExecute;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [currentPrompt]);

  // Focus textarea when component mounts or becomes fullscreen
  useEffect(() => {
    if (textareaRef.current && (isFullscreen || !currentPrompt)) {
      textareaRef.current.focus();
    }
  }, [isFullscreen]);

  const handlePromptChange = (value: string) => {
    setCurrentPrompt(value);
    setShowSuggestions(value.length === 0);
  };

  const handleSuggestionClick = (suggestion: typeof PROMPT_SUGGESTIONS[0]) => {
    setCurrentPrompt(suggestion.prompt);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!currentPrompt.trim() || !canExecute || isProcessing) return;

    try {
      // Clear any previous errors
      setLastError(null);
      
      // Execute AI query with streaming for better UX
      await executeAIQueryStream(currentPrompt);
      
      // Clear prompt after successful submission
      setCurrentPrompt('');
      
    } catch (error) {
      console.error('Error executing AI query:', error);
      setLastError(error as Error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const estimateCost = () => {
    // TODO: Implement actual cost estimation
    return 0.0025;
  };

  return (
    <div className="h-full flex flex-col">
     

      {/* Context Bar */}
      {tableName && (
        <div className="p-3 bg-darkNav/30 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Database size={14} />
              <span>Working with: <span className="text-white/80 font-medium">{tableName}</span></span>
              {activeFileInfo?.rowCount && (
                <span className="text-white/40">({activeFileInfo.rowCount.toLocaleString()} rows)</span>
              )}
            </div>
            
            {showCostEstimates && canExecute && activeProvider !== 'local' && (
              <div className="text-xs text-white/40">
                Est. cost: ~${estimateCost().toFixed(4)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 relative">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={currentPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(currentPrompt.length === 0)}
          placeholder={tableName 
            ? `Ask anything about your ${tableName} data...`
            : "Ask about your data or upload a file to get started..."
          }
          disabled={isProcessing || !canExecute}
          className={cn(
            "w-full h-full bg-transparent border-none p-4 text-white placeholder-white/40",
            "focus:outline-none resize-none text-sm leading-relaxed",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isFullscreen ? "text-base" : "text-sm"
          )}
          style={{
            minHeight: isFullscreen ? '300px' : '120px',
          }}
        />

        {/* Suggestions Overlay */}
        {showSuggestions && currentPrompt.length === 0 && !isProcessing && (
          <div className="absolute inset-4 flex items-start justify-center pt-8">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-white/80 mb-2">
                  Ask me anything about your data
                </h3>
                <p className="text-sm text-white/50">
                  Get instant insights, generate SQL queries, or explore patterns with AI
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROMPT_SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200 text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        {suggestion.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white/90 mb-1">
                          {suggestion.title}
                        </div>
                        <div className="text-sm text-white/60 line-clamp-2">
                          {suggestion.prompt}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="p-3 bg-darkNav/30 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!canExecute && (
              <div className="flex items-center gap-2 text-sm text-yellow-500">
                <AlertCircle size={14} />
                <span>Configure API key to continue</span>
              </div>
            )}
            
            <div className="text-xs text-white/40">
              {isProcessing ? (
                "Processing..."
              ) : (
                "Ctrl+Enter to send"
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentPrompt.trim() && (
              <div className="text-xs text-white/40">
                {currentPrompt.length} chars
              </div>
            )}
            
            <Button
              onClick={handleSubmit}
              disabled={!currentPrompt.trim() || !canExecute || isProcessing}
              variant="primary"
              size="sm"
              className="h-8"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptEditor;