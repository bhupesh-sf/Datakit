import React, { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BarChart3, ChevronRight, Github } from "lucide-react";
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

import { useDraggableQueryResults } from "@/hooks/useDraggableQueryResults";
import DraggableQueryResults from "@/components/data-grid/DraggableQueryResults";
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
  

  // Draggable Query Results
  const {
    isDraggableOpen,
    draggableResults,
    showDraggableResults,
    closeDraggableResults,
    handleKeepDraggableResults,
    handleExportDraggableResults,
    handleCopyDraggableResults,
  } = useDraggableQueryResults();



  // Register global handlers for AI assistant integration (window-based)
  useEffect(() => {
    // Store the handlers globally so AI operations can access them
    (window as any).__showDraggableResults = showDraggableResults;
    (window as any).__closeDraggableResults = closeDraggableResults;
    
    return () => {
      delete (window as any).__showDraggableResults;
      delete (window as any).__closeDraggableResults;
    };
  }, [showDraggableResults, closeDraggableResults]);
  

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

  // Open AI Assistant by default on first load
  useEffect(() => {
    if (!showAIAssistant) {
      setShowAIAssistant(true);
    }
  }, []); // Empty dependency array ensures this only runs on first mount

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
            {/* Normal Header */}
                  {/* Left: File path breadcrumb when a file is open */}
                  <motion.div 
                    className="flex justify-start items-center min-w-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {hasFiles && activeFile && (
                      <div 
                        className="responsive-breadcrumb flex items-center gap-1 text-sm min-w-0"
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
                      </div>
                    )}
                  </motion.div>
                  
                  {/* Center: ViewModeSelector */}
                  <motion.div 
                    className="flex justify-center"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <ViewModeSelector
                      currentMode={currentViewMode}
                      onModeChange={handleViewModeChange}
                    />
                  </motion.div>
                  
                  {/* Right side: Stats, Inspector, and Assistant */}
                  <motion.div 
                    className="flex justify-end min-w-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <div className="responsive-buttons flex items-center gap-1.5 transition-all duration-300 min-w-0">
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


    {/* GitHub Repository Button */}
                      <Tooltip content="View on GitHub" placement="bottom">
                        <motion.button
                          onClick={() => window.open('https://github.com/datakitpage/datakit', '_blank', 'noopener,noreferrer')}
                          className="relative group p-2 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 transition-all duration-200 hover:border-white/20 hover:bg-white/5 cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Github className="h-4 w-4 text-white/70 hover:text-white/90 transition-colors duration-200 relative z-10" />
                        </motion.button>
                      </Tooltip>

                      {/* Buy Me a Coffee Button */}
                      <Tooltip content="Buy Me a Coffee" placement="bottom">
                        <motion.button
                          onClick={() => window.open('https://buymeacoffee.com/aminkhorrami', '_blank', 'noopener,noreferrer')}
                          className="relative group p-2 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 transition-all duration-200 hover:border-white/20 hover:bg-white/5 cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <svg
                            className="h-4 w-4 text-white/70 group-hover:text-yellow-400 transition-colors duration-200 relative z-10"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.168.364z"/>
                          </svg>
                        </motion.button>
                      </Tooltip>
                      {/* AI Assistant Button - Always available in all view modes */}
                      <motion.button
                        onClick={toggleAIAssistant}
                        className={cn(
                          'responsive-button assistant-button relative group flex items-center rounded-md transition-all duration-200 cursor-pointer gap-1.5 px-3 py-1.5 text-xs border-2 font-semibold',
                          showAIAssistant
                            ? 'border-primary bg-primary/10'
                            : 'border-white/20 hover:border-white/30 hover:bg-white/5'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        data-tooltip="Datakit Assistant (⌘K)"
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
                          'button-text relative z-10 font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent',
                          showAIAssistant && 'from-white to-gray-300'
                        )}>
                          Datakit Assistant
                        </span>
                      </motion.button>

                  
                    </div>
                  </motion.div>
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
        
        {/* Draggable Query Results Overlay */}
        <DraggableQueryResults
          isOpen={isDraggableOpen}
          results={draggableResults}
          onClose={closeDraggableResults}
          onKeep={handleKeepDraggableResults}
          onExport={handleExportDraggableResults}
          onCopy={handleCopyDraggableResults}
        />
      </MainLayout>
    </>
  );
};

export default Home;