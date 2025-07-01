import React, { useState, useEffect, RefObject } from "react";
import { Send, Settings, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useAIStore } from "@/store/aiStore";
import { useAIOperations } from "@/hooks/ai/useAIOperations";
import { useAppStore } from "@/store/appStore";
import { selectTableName } from "@/store/selectors/appSelectors";

import ModelSelector from "./ModelSelector";
import { Button } from "@/components/ui/Button";

interface PromptPanelProps {
  inputRef: RefObject<HTMLTextAreaElement>;
  showSetupPrompt: boolean;
  onOpenApiKeyModal: () => void;
  onToggleSchema?: () => void;
  schemaBrowserOpen?: boolean;
}

const PROMPT_SUGGESTIONS = [
  {
    title: "Explore Data",
    prompt: "Give me an overview of this dataset - what columns do we have and what insights can you find?",
  },
  {
    title: "Find Patterns", 
    prompt: "What are the most interesting patterns or trends in this data?",
  },
  {
    title: "Data Quality",
    prompt: "Check this dataset for missing values, duplicates, or data quality issues",
  },
  {
    title: "Quick Stats",
    prompt: "Show me summary statistics for all numeric columns",
  },
];

const PromptPanel: React.FC<PromptPanelProps> = ({ 
  inputRef, 
  showSetupPrompt,
  onOpenApiKeyModal,
  onToggleSchema,
  schemaBrowserOpen = false
}) => {
  const [prompt, setPrompt] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const tableName = useAppStore(selectTableName);
  const { isProcessing } = useAIStore();
  const { executeAIQueryStream, canExecute } = useAIOperations();
  
  // Hide suggestions when user starts typing
  useEffect(() => {
    setShowSuggestions(prompt.length === 0);
  }, [prompt]);
  
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!prompt.trim() || !canExecute || isProcessing) return;
    
    await executeAIQueryStream(prompt);
    setPrompt("");
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const handleSuggestionClick = (suggestionPrompt: string) => {
    setPrompt(suggestionPrompt);
    inputRef.current?.focus();
  };
  
  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [prompt, inputRef]);
  
  if (showSetupPrompt) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mb-4 flex justify-center">
            
          </div>
          <h3 className="text-xl font-medium text-white mb-3">
            Analysis Assistant
          </h3>
          <p className="text-white/70 text-sm mb-4 leading-relaxed">
            Connect to AI models like GPT-4o, Claude, or Groq to analyze your data with natural language. 
            
          </p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-white/60 mb-2">What you can do:</p>
            <ul className="text-xs text-white/70 space-y-1">
              <li>• Ask questions in plain English</li>
              <li>• Get generated SQL queries automatically</li>
              <li>• Get data insights and summaries</li>
              <li>• Identify patterns and trends</li>
            </ul>
            <p className="text-xs text-primary mt-3">
              AI models only see your table structure, not your actual data
            </p>
          </div>
          <Button onClick={onOpenApiKeyModal} variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure Models
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onToggleSchema && (
              <button
                onClick={onToggleSchema}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title={schemaBrowserOpen ? "Hide Schema" : "Show Schema"}
              >
                <ChevronRight 
                  className={`h-4 w-4 text-white/70 transition-transform ${
                    schemaBrowserOpen ? "rotate-180" : ""
                  }`} 
                />
              </button>
            )}
            <h3 className="text-sm font-medium text-white">Ask AI</h3>
          </div>
          <ModelSelector compact />
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Prompt Input */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tableName ? `Ask about ${tableName}...` : "Ask about your data..."}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              rows={2}
              disabled={isProcessing}
            />
            
            <button
              type="submit"
              disabled={!prompt.trim() || !canExecute || isProcessing}
              className={`absolute bottom-3 right-3 p-2 rounded-md transition-all ${
                prompt.trim() && canExecute && !isProcessing
                  ? "bg-primary text-white hover:bg-primary/80"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
        
        {/* Suggestions */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <p className="text-xs text-white/50 mb-3">Suggestions:</p>
              {PROMPT_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all group"
                >
                  <div className="font-medium text-sm text-white/90 mb-1">
                    {suggestion.title}
                  </div>
                  <div className="text-xs text-white/60 group-hover:text-white/70">
                    {suggestion.prompt}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Status */}
      {isProcessing && (
        <div className="px-4 py-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span>Thinking...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptPanel;