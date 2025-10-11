import { motion, AnimatePresence } from "framer-motion";
import React, { useCallback, useEffect } from "react";
import { Search, BarChart3, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/Tooltip";

import MainLayout from "@/components/layout/MainLayout";
import DataPreviewTab from "@/components/tabs/DataPreviewTab";
import QueryTab from "@/components/tabs/QueryTab";
import NotebooksTab from "@/components/tabs/NotebooksTab";
import { SEO } from "@/components/common/SEO";
import ViewModeSelector, { ViewMode } from "@/components/navigation/ViewModeSelector";
import EmptyDataState from "@/components/data-grid/EmptyDataState";
import AIAssistantSidebar from "@/components/common/AIAssistantSidebar";


import { DataSourceType } from "@/types/json";
import { useHomePageLogic } from "@/hooks/useHomePageLogic";
import { useAppStore } from "@/store/appStore";
import { useInspectorStore } from "@/store/inspectorStore";
import { useColumnStats } from "@/hooks/useColumnStats";
import { selectActiveFile, selectHasFiles } from "@/store/selectors/appSelectors";
import { ImportProvider } from "@/types/remoteImport";
import { useFolderStore } from "@/store/folderStore";
import { cn } from "@/lib/utils";

/**
 * Main application home page component with file-centric navigation
 */
const Home = () => {
  const { t } = useTranslation();
  const {
    // Store data
    sourceType,
    jsonSchema,
    jsonViewMode,
    
    // Store actions
    setJsonViewMode,
    
    // Handlers
    handleDataLoad,
  } = useHomePageLogic();

  // File management from store
  const hasFiles = useAppStore(selectHasFiles);
  const activeFile = useAppStore(selectActiveFile);
  const {
    setIsRemoteModalOpen, 
    setActiveProviderRemoteModal, 
    showColumnStats, 
    setShowColumnStats, 
    changeViewMode, 
    emptyStateViewMode,
    showAIAssistant,
    toggleAIAssistant,
    setShowAIAssistant,
    assistantSidebarWidth,
    setAssistantSidebarWidth
  } = useAppStore();
  
  // Folder store
  const { getParentChain, nodeMap } = useFolderStore();
  
  // Inspector store
  const { openPanel, analyzeFile } = useInspectorStore();

  // Column stats hook
  const { columnStats, isLoading: isLoadingStats, triggerAnalysis } = useColumnStats({
    fileId: activeFile?.id,
    enabled: true,
    manualTrigger: true
  });

  
  // Get current view mode - use file's mode if available, otherwise use empty state mode
  const currentViewMode: ViewMode = activeFile?.viewMode || emptyStateViewMode;

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    changeViewMode(mode);
  }, [changeViewMode]);
  
  // Get the file path for the active file
  const getFilePath = useCallback(() => {
    if (!activeFile) return null;
    
    // Find the node in the folder tree
    let fileNode = null;
    nodeMap.forEach(node => {
      if (node.type === 'file' && node.name === activeFile.fileName) {
        fileNode = node;
      }
    });
    
    if (!fileNode) return [activeFile.fileName];
    
    // Get parent chain
    const chain = getParentChain(fileNode.id);
    const pathParts = chain.map(node => node.name);
    pathParts.push(fileNode.name);
    
    return pathParts;
  }, [activeFile, nodeMap, getParentChain]);

  const handleImportOptionClick = (val: ImportProvider) => {
    setIsRemoteModalOpen(true);
    setActiveProviderRemoteModal(val);
  };

  // No need for manual window width tracking - using CSS container queries

  // Keyboard shortcut for AI Assistant (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleAIAssistant();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleAIAssistant]);


  // Inspector handler
  const handleInspectorClick = useCallback(() => {
    if (!activeFile) return;
    const tableName = activeFile.tableName;
    openPanel();
    analyzeFile(activeFile.id, tableName);
  }, [activeFile, openPanel, analyzeFile]);
  
  // Column stats handler
  const handleColumnStatsToggle = useCallback(() => {
    if (columnStats.length > 0) {
      // Toggle visibility if we already have data
      setShowColumnStats(!showColumnStats);
    } else {
      // Load stats for first time
      setShowColumnStats(true);
      triggerAnalysis();
    }
  }, [columnStats.length, showColumnStats, setShowColumnStats, triggerAnalysis]);

  // Dynamic CSS classes based on sidebar state
  const headerClasses = cn(
    "grid grid-cols-3 items-center px-6 py-3 min-h-[60px] gap-2",
    "responsive-header", // Custom class for container queries
    showAIAssistant && "ai-assistant-open"
  );

  // Animation variants for content
  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  // Render the appropriate content based on view mode
  const renderContent = () => {
    // Show different empty states or actual content based on mode
    switch (currentViewMode) {
      case 'preview':
        return hasFiles ? <DataPreviewTab /> : <EmptyDataState onImportOptionClick={handleImportOptionClick} />;
      case 'query':
        return <QueryTab />;
      case 'notebook':
        return <NotebooksTab />;
      default:
        return hasFiles ? <DataPreviewTab /> : <EmptyDataState onImportOptionClick={handleImportOptionClick} />;
    }
  };

  return (
    <>
      <SEO 
        title={t('seo.title')}
        description={t('seo.description')}
        keywords={t('seo.keywords')}
        url="/"
      />
      <MainLayout 
        onDataLoad={handleDataLoad}
      >
        <div 
          className="h-full flex flex-col bg-background relative transition-all duration-300"
          style={{
            marginRight: showAIAssistant ? assistantSidebarWidth : 0
          }}
        >
          {/* View Mode Selector and Action Buttons */}
          <motion.div 
            className={headerClasses}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
              // Only dynamic property we need - sidebar width for content adjustment
              '--sidebar-width': showAIAssistant ? `${assistantSidebarWidth}px` : '0px'
            } as React.CSSProperties}
          >
            {/* Left: File path breadcrumb when a file is open */}
            <div className="flex justify-start items-center min-w-0">
              {hasFiles && activeFile && (
                <motion.div 
                  className="responsive-breadcrumb flex items-center gap-1 text-sm min-w-0"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {getFilePath()?.map((part, index, arr) => (
                    <React.Fragment key={index}>
                      <span className={cn(
                        "breadcrumb-part",
                        index === arr.length - 1 
                          ? "breadcrumb-filename text-white/90 font-medium" 
                          : "breadcrumb-folder text-white/50"
                      )}>
                        {part}
                      </span>
                      {index < arr.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-white/30 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </motion.div>
              )}
            </div>
            
            {/* Center: ViewModeSelector */}
            <div className="flex justify-center">
              <ViewModeSelector
                currentMode={currentViewMode}
                onModeChange={handleViewModeChange}
              />
            </div>
            
            
            {/* Right side: Stats, Inspector, and Assistant */}
            <div className="flex justify-end min-w-0">
              <motion.div 
                className="responsive-buttons flex items-center gap-1.5 transition-all duration-300 min-w-0"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                {/* Column Stats Button - Icon only */}
                {hasFiles && activeFile && currentViewMode === 'preview' && !activeFile.isRemote && (
                  <Tooltip 
                    content={columnStats.length > 0 
                      ? (showColumnStats ? t('dataGrid.stats.hideStats') : t('dataGrid.stats.showStats'))
                      : t('dataGrid.stats.columnStats')
                    }
                    placement="bottom"
                  >
                    <motion.button
                      onClick={handleColumnStatsToggle}
                      className="relative group p-2 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 transition-all duration-200 hover:border-white/20 cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {showColumnStats && columnStats.length > 0 && (
                        <div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/25 via-primary/20 to-primary/15 border border-primary/30" />
                      )}
                      {isLoadingStats ? (
                        <svg 
                          className="w-4 h-4 text-primary animate-spin relative z-10" 
                          fill="none" 
                          viewBox="0 0 24 24"
                        >
                          <circle 
                            className="opacity-25" 
                            cx="12" 
                            cy="12" 
                            r="10" 
                            stroke="currentColor" 
                            strokeWidth="4"
                          />
                          <path 
                            className="opacity-75" 
                            fill="currentColor" 
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <BarChart3 className={`h-4 w-4 relative z-10 ${
                          showColumnStats && columnStats.length > 0 ? 'text-white' : 'text-white/50 hover:text-white/70'
                        }`} />
                      )}
                    </motion.button>
                  </Tooltip>
                )}
                
                {/* Inspector Button - Icon only */}
                {hasFiles && activeFile && currentViewMode === 'preview' && !activeFile.isRemote && (
                  <Tooltip content={t('dataGrid.inspector')} placement="bottom">
                    <motion.button
                      onClick={handleInspectorClick}
                      className="relative group p-2 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 transition-all duration-200 hover:border-white/20 cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Search className="h-4 w-4 text-white/50 hover:text-white/70 relative z-10" />
                    </motion.button>
                  </Tooltip>
                )}

                {/* AI Assistant Button - Always available in all view modes */}
                <motion.button
                  onClick={toggleAIAssistant}
                  className={cn(
                    'responsive-button assistant-button relative group flex items-center rounded-md transition-all duration-200 cursor-pointer gap-1.5 px-3 py-1.5 text-xs border',
                    showAIAssistant
                      ? 'text-white border-primary/40 bg-primary/5'
                      : 'text-white/50 hover:text-white/70 border-transparent hover:border-white/20 hover:bg-white/5'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-tooltip={t('ai.assistant.button', { defaultValue: 'Assistant' }) + ' (⌘K)'}
                >
                  {showAIAssistant && (
                    <motion.div
                      layoutId="activeAssistant"
                      className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/30 via-primary/25 to-primary/20 border border-primary/50 shadow-lg shadow-primary/20"
                      transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                    />
                  )}
                  
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/10 rounded text-xs text-white/60 border border-white/20 relative z-10">
                    <span>⌘</span>
                    <span className="font-mono">K</span>
                  </div>
                  <span className={cn(
                    'button-text relative z-10 font-medium',
                    showAIAssistant ? 'text-white' : 'text-white/95'
                  )}>
                    {t('ai.assistant.button', { defaultValue: 'Assistant' })}
                  </span>
                </motion.button>
              </motion.div>
            </div>
          </motion.div>

          {/* JSON View Mode Toggle (contextual, only for JSON files) */}
          {sourceType === DataSourceType.JSON && jsonSchema?.isNested && currentViewMode === 'preview' && (
            <div className="flex justify-center pb-2">
              <div className="border border-white/20 rounded-lg overflow-hidden bg-black/40 backdrop-blur-sm">
                <button
                  className={`px-3 py-1 text-xs ${
                    jsonViewMode === "table"
                      ? "bg-primary text-white"
                      : "text-white/70 hover:text-white/90 hover:bg-white/10"
                  } transition-colors`}
                  onClick={() => setJsonViewMode("table")}
                >
                  {t('dataGrid.jsonView.table')}
                </button>
                <button
                  className={`px-3 py-1 text-xs ${
                    jsonViewMode === "tree"
                      ? "bg-primary text-white"
                      : "text-white/70 hover:text-white/90 hover:bg-white/10"
                  } transition-colors`}
                  onClick={() => setJsonViewMode("tree")}
                >
                  {t('dataGrid.jsonView.tree')}
                </button>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden relative px-6 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentViewMode}-${activeFile?.id || 'empty'}`}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="absolute inset-0 px-6 pb-6"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* AI Assistant Sidebar */}
        <AIAssistantSidebar
          isOpen={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          width={assistantSidebarWidth}
          onWidthChange={setAssistantSidebarWidth}
        />
      </MainLayout>
    </>
  );
};

export default Home;