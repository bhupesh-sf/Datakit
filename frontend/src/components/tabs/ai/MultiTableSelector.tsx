import React, { useState, useEffect } from 'react';
import { X, Plus, Check, FileText, Table2, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/Button';

import { useDuckDBStore } from '@/store/duckDBStore';
import { useAIStore } from '@/store/aiStore';
import { useAppStore } from '@/store/appStore';

interface MultiTableSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onTablesSelected?: (tables: string[]) => void;
}

const MultiTableSelector: React.FC<MultiTableSelectorProps> = ({
  isOpen,
  onClose,
  onTablesSelected,
}) => {
  const { registeredTables, getTableSchema } = useDuckDBStore();
  const { files } = useAppStore();
  const {
    multiTableContexts,
    addTableContext,
    removeTableContext,
    toggleTableContext,
    clearTableContexts,
  } = useAIStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize selected tables from store
      const selected = new Set(
        multiTableContexts
          .filter((ctx) => ctx.isSelected)
          .map((ctx) => ctx.tableName)
      );
      setSelectedTables(selected);
    }
  }, [isOpen, multiTableContexts]);

  const handleToggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);

    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }

    setSelectedTables(newSelected);
  };

  const handleApply = async () => {
    setIsApplying(true);

    try {
      // Get currently selected tables from store
      const currentlySelected = new Set(
        multiTableContexts
          .filter((ctx) => ctx.isSelected)
          .map((ctx) => ctx.tableName)
      );

      // Remove tables that are no longer selected
      for (const tableName of currentlySelected) {
        if (!selectedTables.has(tableName)) {
          removeTableContext(tableName);
        }
      }

      // Add newly selected tables
      const tablesToAdd = Array.from(selectedTables).filter(
        (tableName) => !currentlySelected.has(tableName)
      );

      for (const tableName of tablesToAdd) {
        // Check if table already exists in context (but not selected)
        const existingContext = multiTableContexts.find(
          (ctx) => ctx.tableName === tableName
        );

        if (existingContext) {
          // Just toggle it to selected
          toggleTableContext(tableName);
        } else {
          try {
            const schema = await getTableSchema(tableName);
            if (schema) {
              // Get file info for additional metadata
              const file = files.find((f) => f.tableName === tableName);

              addTableContext({
                tableName,
                schema,
                rowCount: file?.rowCount,
                description: file?.fileName || tableName,
              });
            }
          } catch (error) {
            console.error(`Failed to load schema for ${tableName}:`, error);
          }
        }
      }

      if (onTablesSelected) {
        onTablesSelected(Array.from(selectedTables));
      }
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const handleClearAll = () => {
    // Clear all tables from context store
    clearTableContexts();
    // Close the modal
    onClose();
  };

  // Filter tables based on search
  const filteredTables = Array.from(registeredTables.entries()).filter(
    ([name]) => name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get icon for table based on source
  const getTableIcon = (tableName: string) => {
    const file = files.find((f) => f.tableName === tableName);
    if (file?.source === 'remote') {
      return <Link2 className="h-4 w-4" />;
    } else if (file?.source === 'file') {
      return <FileText className="h-4 w-4" />;
    }
    return <Table2 className="h-4 w-4" />;
  };

  // Get source label
  const getSourceLabel = (tableName: string) => {
    const file = files.find((f) => f.tableName === tableName);
    if (file?.source === 'remote') {
      return file.remoteSource?.type || 'Remote';
    } else if (file?.source === 'file') {
      return 'Local File';
    }
    return 'Table';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="w-full max-w-3xl max-h-[70vh] bg-black border border-white/20 rounded-lg shadow-xl shadow-black/30 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-white">
                  Select Tables for AI Context
                </h2>
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
                  {selectedTables.size} selected
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-full text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-white/10">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tables..."
                className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* Table List */}
            <div className="flex-1 overflow-auto p-4">
              {filteredTables.length === 0 ? (
                <div className="text-center py-8 text-white/50">
                  {searchQuery
                    ? 'No tables found matching your search'
                    : 'No tables available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTables.map(([tableName, tableInfo]) => {
                    const isSelected = selectedTables.has(tableName);
                    const file = files.find((f) => f.tableName === tableName);

                    return (
                      <motion.div
                        key={tableName}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                        onClick={() => handleToggleTable(tableName)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="mt-1">
                              {isSelected ? (
                                <div className="h-4 w-4 bg-primary rounded flex items-center justify-center">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              ) : (
                                <div className="h-4 w-4 border-2 border-white/30 rounded" />
                              )}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-white/60">
                                  {getTableIcon(tableName)}
                                </div>
                                <span className="font-medium text-white">
                                  {tableName}
                                </span>
                                <span className="px-2 py-0.5 bg-white/10 text-white/60 text-xs rounded">
                                  {getSourceLabel(tableName)}
                                </span>
                              </div>

                              {file && (
                                <div className="mt-2 flex items-center gap-4 text-sm text-white/50">
                                  {file.rowCount && (
                                    <span>
                                      {file.rowCount.toLocaleString()} rows
                                    </span>
                                  )}
                                  {file.columnCount && (
                                    <span>{file.columnCount} columns</span>
                                  )}
                                  {file.fileName && (
                                    <span className="truncate">
                                      {file.fileName}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-darkNav/30">
              <div className="flex justify-between items-center">
                <button
                  onClick={handleClearAll}
                  className="text-white/60 hover:text-white transition-colors text-sm"
                  disabled={
                    multiTableContexts.filter((ctx) => ctx.isSelected)
                      .length === 0
                  }
                >
                  Clear all
                </button>

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleApply}
                    disabled={selectedTables.size === 0 || isApplying}
                  >
                    {isApplying ? (
                      <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isApplying
                      ? 'Applying...'
                      : `Add to Context (${selectedTables.size})`}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MultiTableSelector;
