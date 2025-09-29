import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeftRight, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';
import { selectActiveFile, selectSplitViewRatio } from '@/store/selectors/appSelectors';
import DataPreviewGrid from '@/components/data-grid/DataPreviewGrid';

interface SplitViewContainerProps {
  className?: string;
}

const SplitViewContainer: React.FC<SplitViewContainerProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { updateSplitRatio, swapSplitFiles, setActiveFile, clearFileSplitView } = useAppStore();
  const activeFile = useAppStore(selectActiveFile);
  const splitRatio = useAppStore(selectSplitViewRatio);
  
  // Get split partner based on active file's split configuration
  const leftFile = activeFile?.splitView?.position === 'left' 
    ? activeFile 
    : useAppStore.getState().files.find(f => f.id === activeFile?.splitView?.partnerId) || null;
    
  const rightFile = activeFile?.splitView?.position === 'right' 
    ? activeFile 
    : useAppStore.getState().files.find(f => f.id === activeFile?.splitView?.partnerId) || null;
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartRatio, setDragStartRatio] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Handle mouse events for resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartRatio(splitRatio);
  }, [splitRatio]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    const deltaRatio = deltaX / containerRect.width;
    const newRatio = dragStartRatio + deltaRatio;
    
    updateSplitRatio(newRatio);
  }, [isDragging, dragStartX, dragStartRatio, updateSplitRatio]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Don't render if no files
  if (!leftFile || !rightFile) {
    return null;
  }
  
  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`h-full flex flex-col ${className}`}
    >
      {/* Split View Header */}
      <div className="flex items-center justify-between p-3 bg-darkNav border-b border-white/10">
        <div className="flex items-center space-x-4">
          <h2 className="text-sm font-medium text-white">{t('layout.splitView.title', { defaultValue: 'Split View' })}</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={swapSplitFiles}
            className="h-8 w-8 p-0"
            title={t('layout.splitView.swapFiles', { defaultValue: 'Swap files' })}
          >
            <ArrowLeftRight size={14} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeFile?.id) {
                clearFileSplitView(activeFile.id);
              }
            }}
            className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
            title={t('layout.splitView.close', { defaultValue: 'Close split view' })}
          >
            <X size={14} />
          </Button>
        </div>
      </div>
      
      {/* Split View Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <motion.div
          layout
          className="flex flex-col overflow-hidden bg-background border-r border-white/10"
          style={{ width: `${splitRatio * 100}%` }}
          onClick={() => setActiveFile(leftFile.id)}
        >
          <div className="flex items-center justify-between p-2 bg-darkNav/50 border-b border-white/5">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-sm font-medium text-white truncate">{leftFile.fileName}</span>
            </div>
            <div className="text-xs text-white/50">
              {t('layout.splitView.columnCount', { defaultValue: '{{count}} cols', count: leftFile.columnCount })}
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <DataPreviewGrid fileId={leftFile.id} hideHeader={true} />
          </div>
        </motion.div>
        
        {/* Resize Handle */}
        <div
          className={`relative w-1 bg-white/10 cursor-col-resize hover:bg-primary/50 transition-colors ${
            isDragging ? 'bg-primary/70' : ''
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 left-0 w-1 flex items-center justify-center">
            <div className="w-0.5 h-8 bg-white/20 rounded-full"></div>
          </div>
          
          {/* Resize indicator */}
          <div className={`absolute inset-y-0 left-0 w-1 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity ${
            isDragging ? 'opacity-100' : ''
          }`}>
            <GripVertical size={12} className="text-white/60" />
          </div>
        </div>
        
        {/* Right Panel */}
        <motion.div
          layout
          className="flex flex-col overflow-hidden bg-background"
          style={{ width: `${(1 - splitRatio) * 100}%` }}
          onClick={() => setActiveFile(rightFile.id)}
        >
          <div className="flex items-center justify-between p-2 bg-darkNav/50 border-b border-white/5">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm font-medium text-white truncate">{rightFile.fileName}</span>
            </div>
            <div className="text-xs text-white/50">
              {t('layout.splitView.columnCount', { defaultValue: '{{count}} cols', count: rightFile.columnCount })}
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <DataPreviewGrid fileId={rightFile.id} hideHeader={true} />
          </div>
        </motion.div>
      </div>
      
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 pointer-events-none"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-darkNav/90 px-4 py-2 rounded-lg border border-white/20 shadow-lg">
                <div className="flex items-center space-x-2 text-white">
                  <GripVertical size={16} />
                  <span className="text-sm">
                    {Math.round(splitRatio * 100)}% / {Math.round((1 - splitRatio) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SplitViewContainer;