import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import { useAIOperations } from "@/hooks/ai/useAIOperations";

import SchemaBrowser from "@/components/tabs/query/SchemaBrowser";
import ModelSelector from "./ModelSelector";
import ContextBar from "./ContextBar";
import PromptPanel from "./PromptPanel";
import ResponsePanel from "./ResponsePanel";
import ResultsPanel from "./ResultsPanel";
import ApiKeyModal from "./ApiKeyModal";

const AIWorkspace: React.FC = () => {
  const [schemaBrowserOpen, setSchemaBrowserOpen] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [resultsPanelHeight, setResultsPanelHeight] = useState(300);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  const { 
    queryResults,
    activeProvider,
    apiKeys,
    autoExecuteSQL
  } = useAIStore();
  
  const { getAvailableTables } = useDuckDBStore();
  const { isLoading, canExecute } = useAIOperations();
  
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const resultsResizeRef = useRef<HTMLDivElement>(null);
  
  // Auto-expand results when query executes
  useEffect(() => {
    if (queryResults && autoExecuteSQL && !resultsExpanded) {
      setResultsExpanded(true);
    }
  }, [queryResults, autoExecuteSQL]);
  
  // Focus prompt on mount
  useEffect(() => {
    promptInputRef.current?.focus();
  }, []);
  
  // Handle results panel resize
  const handleResultsResize = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startHeight = resultsPanelHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
      setResultsPanelHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ns-resize";
  };
  
  const hasApiKey = apiKeys.has(activeProvider) && !!apiKeys.get(activeProvider);
  const showSetupPrompt = !hasApiKey && activeProvider !== "local";
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Context Bar */}
      <ContextBar onOpenApiKeyModal={() => setShowApiKeyModal(true)} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Schema Browser - Collapsible */}
        <AnimatePresence>
          {schemaBrowserOpen && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 250 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-white/10 overflow-hidden"
            >
              <SchemaBrowser onInsertQuery={() => {}} />
            </motion.div>
          )}
        </AnimatePresence>
        
        
        {/* Chat/Response Area */}
        <div className="flex-1 flex">
          {/* Left: Prompt Panel */}
          <div className="w-[40%] border-r border-white/10">
            <PromptPanel 
              inputRef={promptInputRef}
              showSetupPrompt={showSetupPrompt}
              onOpenApiKeyModal={() => setShowApiKeyModal(true)}
              onToggleSchema={() => setSchemaBrowserOpen(!schemaBrowserOpen)}
              schemaBrowserOpen={schemaBrowserOpen}
            />
          </div>
          
          {/* Right: Response Panel */}
          <div className="flex-1">
            <ResponsePanel />
          </div>
        </div>
      </div>
      
      {/* Bottom: Results Panel - Collapsible */}
      <AnimatePresence>
        {resultsExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: resultsPanelHeight }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/10 bg-darkNav relative"
          >
            {/* Resize Handle */}
            <div
              ref={resultsResizeRef}
              onMouseDown={handleResultsResize}
              className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/20 transition-colors"
            />
            
            {/* Collapse Button */}
            <button
              onClick={() => setResultsExpanded(false)}
              className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 transition-colors"
            >
              <ChevronDown className="h-4 w-4 text-white/70" />
            </button>
            
            <ResultsPanel height={resultsPanelHeight} />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Results Expand Button (when collapsed) */}
      {!resultsExpanded && queryResults && (
        <button
          onClick={() => setResultsExpanded(true)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-darkNav border border-white/10 rounded-t-lg px-4 py-1 hover:bg-white/5 transition-colors flex items-center gap-2"
        >
          <ChevronUp className="h-4 w-4 text-white/70" />
          <span className="text-sm text-white/70">Show Results</span>
        </button>
      )}
      
      {/* API Key Modal */}
      <ApiKeyModal 
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />
    </div>
  );
};

export default AIWorkspace;