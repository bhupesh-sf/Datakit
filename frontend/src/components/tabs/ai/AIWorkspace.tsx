import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Settings,
  Maximize,
  Minimize,
  Database,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { useAppStore } from "@/store/appStore";
import { selectTableName } from "@/store/selectors/appSelectors";

import { Button } from "@/components/ui/Button";
import ModelSelector from "./ModelSelector";
import PromptEditor from "./PromptEditor";
import ResultsPanel from "./ResultsPanel";
import DataContextPanel from "./panels/DataContextPanel";
import QueryHistoryPanel from "./panels/QueryHistoryPanel";
import ApiKeyModal from "./ApiKeyModal";

// Constants for panel dimensions
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_PROMPT_HEIGHT = 200;

/**
 * Main AI workspace container with resizable panels
 */
const AIWorkspace: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const promptEditorRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  // AI Store state
  const {
    showDataContext,
    showQueryHistory,
    showApiKeyModal,
    sidebarWidth,
    promptEditorHeight,
    splitViewMode,
    isProcessing,
    activeProvider,
    activeModel,
    apiKeys,
    toggleDataContext,
    toggleQueryHistory,
    toggleApiKeyModal,
    setSidebarWidth,
    setPromptEditorHeight,
    initializeModels,
  } = useAIStore();

  // App Store state
  const tableName = useAppStore(selectTableName);

  // Local state for resizing
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingPrompt, setIsResizingPrompt] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState<'none' | 'prompt' | 'results'>('none');

  // Initialize models on mount
  useEffect(() => {
    initializeModels();
  }, [initializeModels]);

  // Handle sidebar resize
  const handleSidebarResize = useCallback((e: MouseEvent) => {
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(
        Math.max(e.clientX - containerRect.left, MIN_SIDEBAR_WIDTH),
        MAX_SIDEBAR_WIDTH
      );
      
      setSidebarWidth(newWidth);
    });
  }, [setSidebarWidth]);

  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const stopSidebarResize = useCallback(() => {
    if (isResizingSidebar) {
      setIsResizingSidebar(false);
    }
  }, [isResizingSidebar]);

  // Handle prompt editor resize
  const handlePromptResize = useCallback((e: MouseEvent) => {
    requestAnimationFrame(() => {
      if (!promptEditorRef.current) return;
      
      const rect = promptEditorRef.current.getBoundingClientRect();
      const newHeight = Math.min(
        Math.max(e.clientY - rect.top, 100),
        600
      );
      
      setPromptEditorHeight(newHeight);
    });
  }, [setPromptEditorHeight]);

  const startPromptResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPrompt(true);
  }, []);

  const stopPromptResize = useCallback(() => {
    if (isResizingPrompt) {
      setIsResizingPrompt(false);
    }
  }, [isResizingPrompt]);

  // Handle mouse events for resizing
  useEffect(() => {
    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleSidebarResize);
      document.addEventListener('mouseup', stopSidebarResize);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleSidebarResize);
        document.removeEventListener('mouseup', stopSidebarResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizingSidebar, handleSidebarResize, stopSidebarResize]);

  useEffect(() => {
    if (isResizingPrompt) {
      document.addEventListener('mousemove', handlePromptResize);
      document.addEventListener('mouseup', stopPromptResize);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handlePromptResize);
        document.removeEventListener('mouseup', stopPromptResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizingPrompt, handlePromptResize, stopPromptResize]);

  // Check if API key is configured
  const hasApiKey = activeProvider && apiKeys.has(activeProvider) && apiKeys.get(activeProvider);
  const needsApiKey = activeProvider !== 'local' && !hasApiKey;

  // Getting started state
  const showGettingStarted = needsApiKey && !isProcessing;

  const GettingStartedPanel = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-heading font-medium text-white mb-2">
          AI Assistant Ready
        </h3>
        <p className="text-white/70 mb-4">
          Configure your API keys to start using AI features with your data.
        </p>
        <Button onClick={toggleApiKeyModal} variant="primary">
          <Settings className="w-4 h-4 mr-2" />
          Configure API Keys
        </Button>
      </div>
    </div>
  );

  // Fullscreen mode rendering
  if (fullScreenMode !== 'none') {
    return (
      <div className="w-full h-full flex flex-col">
        {fullScreenMode === 'prompt' ? (
          <>
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <h3 className="text-sm font-medium">AI Prompt Editor (Fullscreen)</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFullScreenMode('none')}
                title="Exit Full Screen"
              >
                <Minimize size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PromptEditor isFullscreen />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <h3 className="text-sm font-medium">AI Results (Fullscreen)</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFullScreenMode('none')}
                title="Exit Full Screen"
              >
                <Minimize size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ResultsPanel isFullscreen />
            </div>
          </>
        )}
      </div>
    );
  }

  // Regular layout with panels
  return (
    <>
      <div ref={containerRef} className="h-full w-full flex overflow-hidden relative">
        {/* Resize Overlay */}
        {(isResizingSidebar || isResizingPrompt) && (
          <div 
            className="absolute inset-0 z-50" 
            style={{ cursor: isResizingSidebar ? 'col-resize' : 'row-resize' }} 
          />
        )}

        {/* Left Sidebar - Data Context */}
        <div
          className={`flex-shrink-0 overflow-hidden bg-darkNav border-r border-white/10 relative ${
            isResizingSidebar ? '' : 'transition-all duration-200'
          }`}
          style={{
            width: showDataContext ? `${sidebarWidth}px` : "0px",
          }}
        >
          <div className="h-full w-full">
            <DataContextPanel />
          </div>

          {/* Resize Handle */}
          {showDataContext && (
            <div
              className={`absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent ${
                isResizingSidebar ? 'bg-primary/50' : 'hover:bg-primary/30 transition-colors'
              }`}
              onMouseDown={startSidebarResize}
              style={{
                width: '5px',
                right: '-2px',
              }}
            >
              {isResizingSidebar && (
                <div className="absolute inset-0 bg-primary/50" />
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleDataContext}
                title={showDataContext ? "Hide Data Context" : "Show Data Context"}
              >
                <ChevronLeft
                  size={16}
                  className={`transition-transform ${
                    showDataContext ? "" : "rotate-180"
                  }`}
                />
              </Button>

              <h3 className="text-sm font-medium">AI Assistant</h3>

              {tableName && (
                <div className="flex items-center text-xs text-white/60">
                  <Database size={12} className="mr-1" />
                  <span>Context: {tableName}</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <ModelSelector />
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleApiKeyModal}
                title="API Keys & Settings"
              >
                <Settings size={16} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleQueryHistory}
                title={showQueryHistory ? "Hide Query History" : "Show Query History"}
              >
                <ChevronRight
                  size={16}
                  className={`transition-transform ${
                    showQueryHistory ? "" : "rotate-180"
                  }`}
                />
              </Button>
            </div>
          </div>

          {/* Show getting started if no API key */}
          {showGettingStarted ? (
            <GettingStartedPanel />
          ) : (
            <>
              {/* Prompt Editor */}
              <div
                ref={promptEditorRef}
                className="flex flex-col relative"
                style={{ height: `${promptEditorHeight}px` }}
              >
                <div className="flex items-center justify-between p-2 bg-darkNav/50 border-b border-white/10">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium">Prompt</h4>
                    <div className="text-xs text-white/50">
                      Ask about your data
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setFullScreenMode('prompt')}
                    title="Full Screen Prompt"
                  >
                    <Maximize size={16} />
                  </Button>
                </div>

                <div className="flex-1 overflow-hidden">
                  <PromptEditor />
                </div>
              </div>

              {/* Resizer Handle */}
              <div
                ref={dividerRef}
                className="h-2 bg-darkNav/50 cursor-row-resize hover:bg-primary/30 transition-colors flex items-center justify-center"
                onMouseDown={startPromptResize}
              >
                <div className="w-8 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Results Area */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
                  <h4 className="text-sm font-medium">AI Response</h4>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setFullScreenMode('results')}
                    title="Full Screen Results"
                  >
                    <Maximize size={16} />
                  </Button>
                </div>

                <div className="flex-1 overflow-hidden">
                  <ResultsPanel />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar - Query History */}
        <div
          className="flex-shrink-0 transition-all duration-200 overflow-hidden"
          style={{
            width: showQueryHistory ? `${DEFAULT_SIDEBAR_WIDTH}px` : "0px",
            opacity: showQueryHistory ? 1 : 0,
          }}
        >
          {showQueryHistory && (
            <div className="h-full border-l border-white/10 bg-darkNav overflow-hidden">
              <QueryHistoryPanel />
            </div>
          )}
        </div>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && <ApiKeyModal />}
    </>
  );
};

export default AIWorkspace;