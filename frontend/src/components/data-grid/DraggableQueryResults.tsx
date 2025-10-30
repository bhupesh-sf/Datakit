import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2, Download, Save, GripVertical, BarChart3, Grid3X3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import UnifiedGrid from '@/components/data-grid/UnifiedGrid';
import { useQueryColumnFormatting } from '@/components/tabs/query/query-results/useQueryColumnFormatting';
import { useCellFormatting } from '@/components/data-grid/hooks/useCellFormatting';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import ChartBuilder from '@/components/charts/ChartBuilder';

interface DraggableQueryResultsProps {
  isOpen: boolean;
  results: {
    data: any[][];
    columnTypes?: Array<{ name: string; type: string }>;
    metadata?: {
      rowCount: number;
      columnCount: number;
      executionTime: number;
      query: string;
    };
  } | null;
  onClose: () => void;
  onKeep?: (tableName: string) => Promise<void>;
  onExport?: (format: 'csv' | 'json') => void;
  onCopy?: () => void;
  aiChartSuggestion?: string; // AI-suggested chart configuration
}

const DraggableQueryResults: React.FC<DraggableQueryResultsProps> = ({
  isOpen,
  results,
  onClose,
  onKeep,
  onExport,
  onCopy,
  aiChartSuggestion,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 800, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showKeepPrompt, setShowKeepPrompt] = useState(false);
  const [tableName, setTableName] = useState('');
  const [showChart, setShowChart] = useState(false);
  
  const dragRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract data for formatting
  const extractedData = React.useMemo(() => {
    if (!results?.data || results.data.length < 2) {
      return { queryResults: [], columns: [] };
    }

    const headers = results.data[0].slice(1); // Skip row number column
    const queryResults = results.data.slice(1).map((row: any[]) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index + 1]; // +1 to skip row number column
      });
      return obj;
    });

    return { queryResults, columns: headers };
  }, [results?.data]);

  const { columnTypes, formatCellValue } = useQueryColumnFormatting({
    results: extractedData.queryResults,
    columns: extractedData.columns,
  });

  const { getCellClass } = useCellFormatting(
    columnTypes,
    true,
    {
      animationActive: false,
      gridData: results?.data || [],
      animationMessage: [],
      activeWordIndex: -1,
    }
  );

  // Reset position when opened
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const container = containerRef.current.getBoundingClientRect();
      setPosition({
        x: Math.max(0, (container.width - size.width) / 2),
        y: Math.max(0, (container.height - size.height) / 2),
      });
    }
  }, [isOpen, size.width, size.height]);

  // Handle drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const container = containerRef.current.getBoundingClientRect();
      const newX = Math.max(0, Math.min(container.width - size.width, e.clientX - startX));
      const newY = Math.max(0, Math.min(container.height - size.height, e.clientY - startY));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, size]);

  // Handle resize
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const container = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newWidth = Math.max(400, Math.min(container.width - position.x, startWidth + deltaX));
      const newHeight = Math.max(200, Math.min(container.height - position.y, startHeight + deltaY));
      
      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [size, position]);

  // Handle expand/collapse
  const handleToggleExpand = useCallback(() => {
    if (!containerRef.current) return;
    
    if (isExpanded) {
      // Restore previous size
      setSize({ width: 800, height: 400 });
      setPosition({ x: 0, y: 0 });
    } else {
      // Expand to full size
      const container = containerRef.current.getBoundingClientRect();
      setSize({ width: container.width - 40, height: container.height - 40 });
      setPosition({ x: 20, y: 20 });
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Handle keep results
  const handleKeepClick = useCallback(() => {
    setShowKeepPrompt(true);
    setTableName(`query_result_${Date.now()}`);
  }, []);

  const handleKeepConfirm = useCallback(async () => {
    if (onKeep && tableName.trim()) {
      try {
        await onKeep(tableName.trim());
        setShowKeepPrompt(false);
        onClose();
      } catch (error) {
        console.error('Failed to keep results:', error);
      }
    }
  }, [onKeep, tableName, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleToggleExpand();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleToggleExpand]);

  if (!isOpen || !results) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute pointer-events-auto"
            style={{
              left: position.x,
              top: position.y,
              width: size.width,
              height: size.height,
            }}
          >
            {/* Main container */}
            <div className="w-full h-full bg-background border border-white/20 rounded-lg shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div
                ref={dragRef}
                onMouseDown={handleMouseDown}
                className={`flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 cursor-move ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-white/40" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Query Results</span>
                    {results.metadata && (
                      <span className="text-xs text-white/50">
                        {results.metadata.rowCount} rows × {results.metadata.columnCount} cols
                        {results.metadata.executionTime && (
                          <span className="ml-1">({results.metadata.executionTime.toFixed(1)}ms)</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {/* View Mode Toggle */}
                  <div className="flex border border-white/20 rounded overflow-hidden">
                    <Tooltip placement='bottom' content="Data grid view">
                      <button
                        onClick={() => setShowChart(false)}
                        className={`p-1 transition-colors ${
                          !showChart ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                    <Tooltip placement='bottom' content="Chart view">
                      <button
                        onClick={() => setShowChart(true)}
                        className={`p-1 transition-colors ${
                          showChart ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                  
                  {onExport && (
                    <Tooltip placement='bottom' content="Export results">
                      <button
                        onClick={() => onExport('csv')}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        <Download className="h-4 w-4 text-white/70" />
                      </button>
                    </Tooltip>
                  )}
                  
                  {onKeep && (
                    <Tooltip placement='bottom' content="Save as table">
                      <button
                        onClick={handleKeepClick}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        <Save className="h-4 w-4 text-white/70" />
                      </button>
                    </Tooltip>
                  )}
                  
                  <Tooltip placement='bottom' content={isExpanded ? "Restore size" : "Maximize"}>
                    <button
                      onClick={handleToggleExpand}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      {isExpanded ? (
                        <Minimize2 className="h-4 w-4 text-white/70" />
                      ) : (
                        <Maximize2 className="h-4 w-4 text-white/70" />
                      )}
                    </button>
                  </Tooltip>
                  
                  <Tooltip placement='bottom' content="Close">
                    <button
                      onClick={onClose}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-white/70" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {showChart ? (
                  <ChartBuilder
                    data={results.data || []}
                    columnTypes={results.columnTypes || []}
                    aiSuggestion={aiChartSuggestion}
                    className="h-full"
                  />
                ) : (
                  <UnifiedGrid
                    data={results.data || []}
                    columnTypes={results.columnTypes || []}
                    gridId="draggable-results"
                    isDataMode={true}
                    className="h-full"
                    rowHeight={32}
                    estimatedColumnWidth={120}
                    formatCellValue={formatCellValue}
                    getCellClass={getCellClass}
                  />
                )}
              </div>

              {/* Resize handle */}
              <div
                onMouseDown={handleResizeMouseDown}
                className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize ${
                  isResizing ? 'bg-primary/30' : 'bg-white/10 hover:bg-white/20'
                } transition-colors`}
                style={{
                  background: 'linear-gradient(-45deg, transparent 30%, currentColor 30%, currentColor 40%, transparent 40%, transparent 60%, currentColor 60%, currentColor 70%, transparent 70%)',
                }}
              />
            </div>

            {/* Keep results prompt */}
            <AnimatePresence>
              {showKeepPrompt && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    className="bg-background border border-white/20 rounded-lg p-6 shadow-xl"
                  >
                    <h3 className="text-lg font-semibold text-white mb-4">Save Results as Table</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Table Name:
                        </label>
                        <input
                          type="text"
                          value={tableName}
                          onChange={(e) => setTableName(e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowKeepPrompt(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleKeepConfirm}
                          disabled={!tableName.trim()}
                        >
                          Save Table
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DraggableQueryResults;