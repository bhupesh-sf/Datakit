import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Square,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  MoreVertical,
  Image,
  FileText,
  AlertCircle,
  Table,
  Clock,
} from "lucide-react";

import { usePythonStore } from "@/store/pythonStore";
import { Button } from "@/components/ui/Button";
import MonacoEditor from "../query/MonacoEditor";
import MonacoErrorBoundary from "./MonacoErrorBoundary";
import type { PythonCell as PythonCellType, CellOutput } from "@/lib/python/types";
import { formatDataFrame } from "@/lib/python/executor";

interface PythonCellProps {
  cell: PythonCellType;
  isActive: boolean;
  onActivate: () => void;
  cellNumber: number;
}

/**
 * Individual Python cell component with editor and output display
 */
const PythonCell: React.FC<PythonCellProps> = ({
  cell,
  isActive,
  onActivate,
  cellNumber,
}) => {
  const {
    updateCell,
    deleteCell,
    executeCell,
    moveCell,
    clearCell,
    isExecuting: globalExecuting,
  } = usePythonStore();

  const [showMenu, setShowMenu] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExecute = async () => {
    const startTime = performance.now();
    await executeCell(cell.id);
    const endTime = performance.now();
    setExecutionTime(endTime - startTime);
  };

  const handleCopyCell = () => {
    navigator.clipboard.writeText(cell.code);
    setShowMenu(false);
  };

  // Debounced update to prevent rapid Monaco Editor re-renders
  const debouncedUpdateCell = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (cellId: string, code: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          updateCell(cellId, code);
        }, 100);
      };
    })(),
    [updateCell]
  );

  const renderOutput = (output: CellOutput) => {
    switch (output.type) {
      case 'text':
        return (
          <div className="font-mono text-sm text-white/90 whitespace-pre-wrap">
            {output.content}
          </div>
        );

      case 'error':
        return (
          <div className="font-mono text-sm text-red-400 whitespace-pre-wrap bg-red-500/10 p-3 rounded border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div>{output.content}</div>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="bg-white/5 p-3 rounded border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Image size={16} className="text-blue-400" />
              <span className="text-sm text-white/70">Plot Output</span>
            </div>
            <img
              src={output.content}
              alt="Python plot output"
              className="max-w-full h-auto rounded border border-white/10"
              style={{ maxHeight: '500px' }}
            />
          </div>
        );

      case 'dataframe':
        const dfInfo = formatDataFrame(output.content);
        return (
          <div className="bg-white/5 p-3 rounded border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Table size={16} className="text-green-400" />
              <span className="text-sm text-white/70">
                DataFrame ({dfInfo.shape[0]} rows × {dfInfo.shape[1]} columns)
              </span>
              {dfInfo.memory_usage && (
                <span className="text-xs text-white/50">
                  {(dfInfo.memory_usage / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </div>
            
            {/* Column info */}
            <div className="mb-3">
              <div className="text-xs text-white/60 mb-1">Columns:</div>
              <div className="flex flex-wrap gap-1">
                {dfInfo.columns.map((col, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-white/10 px-2 py-1 rounded"
                    title={`${col}: ${dfInfo.dtypes[col] || 'unknown'}`}
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Data preview */}
            {dfInfo.preview.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      {dfInfo.columns.map((col, idx) => (
                        <th key={idx} className="text-left p-2 text-white/80 font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dfInfo.preview.slice(0, 10).map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-white/5">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="p-2 text-white/70">
                            {String(cell).length > 50
                              ? String(cell).substring(0, 50) + "..."
                              : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dfInfo.preview.length > 10 && (
                  <div className="text-xs text-white/50 p-2">
                    ... and {dfInfo.preview.length - 10} more rows
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'html':
        return (
          <div className="bg-white/5 p-3 rounded border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-purple-400" />
              <span className="text-sm text-white/70">HTML Output</span>
            </div>
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: output.content }}
            />
          </div>
        );

      default:
        return (
          <div className="font-mono text-sm text-white/70 whitespace-pre-wrap">
            {output.content}
          </div>
        );
    }
  };

  return (
    <div
      className={`border rounded-lg overflow-visible transition-colors ${
        isActive
          ? "border-primary/50 bg-primary/5"
          : "border-white/10 bg-black/20"
      }`}
      onClick={onActivate}
    >
      {/* Cell Header */}
      <div className="flex items-center justify-between p-3 bg-darkNav/50 border-b border-white/10 relative">
        <div className="flex items-center gap-3">
          {/* Cell Number */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">In</span>
            <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded">
              {cell.executionCount || cellNumber}
            </span>
          </div>

          {/* Execution Status */}
          {cell.isExecuting && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span>Executing...</span>
            </div>
          )}

          {executionTime && !cell.isExecuting && (
            <div className="flex items-center gap-1 text-xs text-white/50">
              <Clock size={12} />
              <span>{executionTime.toFixed(0)}ms</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Execute Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              handleExecute();
            }}
            disabled={cell.isExecuting || globalExecuting || !cell.code.trim()}
            title="Execute Cell (⌘+Enter)"
          >
            {cell.isExecuting ? (
              <Square size={14} />
            ) : (
              <Play size={14} />
            )}
          </Button>

          {/* Menu Button */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
            >
              <MoreVertical size={14} />
            </Button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-black border border-white/10 rounded shadow-xl z-50 min-w-40">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveCell(cell.id, 'up');
                    setTimeout(() => setShowMenu(false), 100);
                  }}
                >
                  <ChevronUp size={14} />
                  Move Up
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveCell(cell.id, 'down');
                    setTimeout(() => setShowMenu(false), 100);
                  }}
                >
                  <ChevronDown size={14} />
                  Move Down
                </button>
                <div className="border-t border-white/10" />
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                  onClick={handleCopyCell}
                >
                  <Copy size={14} />
                  Copy Code
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                  onClick={() => {
                    clearCell(cell.id);
                    setShowMenu(false);
                  }}
                >
                  <Square size={14} />
                  Clear Output
                </button>
                <div className="border-t border-white/10" />
                <button
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                  onClick={() => {
                    deleteCell(cell.id);
                    setShowMenu(false);
                  }}
                >
                  <Trash2 size={14} />
                  Delete Cell
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Editor */}
      <div className="border-b border-white/10">
        <MonacoErrorBoundary cellId={cell.id}>
          <MonacoEditor
            key={`monaco-${cell.id}`}
            value={cell.code}
            onChange={(value) => debouncedUpdateCell(cell.id, value || "")}
            onExecute={() => handleExecute()}
            language="python"
            height={150}
            minHeight={100}
            maxHeight={400}
          />
        </MonacoErrorBoundary>
      </div>

      {/* Output Area */}
      {cell.output.length > 0 && (
        <div className="p-3 space-y-3">
          {cell.output.map((output) => (
            <div key={output.id}>
              {renderOutput(output)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PythonCell;