import React, { useState } from 'react';
import { Database, Zap, Settings, Plus, X } from 'lucide-react';

import { useAIStore } from '@/store/aiStore';

import { useAuth } from '@/hooks/auth/useAuth';

import MultiTableSelector from './MultiTableSelector';

interface ContextBarProps {
  onOpenApiKeyModal?: () => void;
}

/**
 * Multi-table context display
 */
const MultiTableContextDisplay: React.FC<{
  onOpenSelector: () => void;
}> = ({ onOpenSelector }) => {
  const { multiTableContexts, removeTableContext } = useAIStore();

  const selectedTables = multiTableContexts.filter((ctx) => ctx.isSelected);

  return (
    <div className="flex items-center gap-2">
      {selectedTables.length > 0 ? (
        <>
          <span className="text-xs text-white/50">Context:</span>
          <div className="flex items-center gap-1">
            {selectedTables.slice(0, 3).map((ctx) => (
              <div
                key={ctx.tableName}
                className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 border border-primary/30 rounded text-xs text-primary"
              >
                <Database className="h-3 w-3" />
                <span className="max-w-[100px] truncate">{ctx.tableName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTableContext(ctx.tableName);
                  }}
                  className="ml-1 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {selectedTables.length > 3 && (
              <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
                +{selectedTables.length - 3} more
              </span>
            )}
          </div>
        </>
      ) : (
        <span className="text-xs text-white/50">No tables in context</span>
      )}

      <button
        onClick={onOpenSelector}
        className="flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add Tables
      </button>
    </div>
  );
};

const ContextBar: React.FC<ContextBarProps> = ({ onOpenApiKeyModal }) => {
  const { autoExecuteSQL, updateSettings } = useAIStore();

  const { isAuthenticated } = useAuth();

  const [showMultiTableSelector, setShowMultiTableSelector] = useState(false);

  return (
    <>
      <div className="h-10 bg-darkNav border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-4 text-sm">
          {/* Multi-table Context Display */}
          <MultiTableContextDisplay
            onOpenSelector={() => setShowMultiTableSelector(true)}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Model Settings Button */}
          {onOpenApiKeyModal && isAuthenticated && (
            <button
              onClick={onOpenApiKeyModal}
              className="flex items-center gap-2 px-3 py-1 rounded-md text-sm bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Models</span>
            </button>
          )}

          {/* Auto-execute Toggle */}
          {isAuthenticated && (
            <button
              onClick={() =>
                updateSettings({ autoExecuteSQL: !autoExecuteSQL })
              }
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors cursor-pointer ${
                autoExecuteSQL
                  ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/25'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Auto-execute: {autoExecuteSQL ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      <MultiTableSelector
        isOpen={showMultiTableSelector}
        onClose={() => setShowMultiTableSelector(false)}
      />
    </>
  );
};

export default ContextBar;
