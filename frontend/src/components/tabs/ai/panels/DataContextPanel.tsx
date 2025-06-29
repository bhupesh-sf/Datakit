import React, { useState } from "react";
import { Database, Table, Eye, Info, ChevronRight, ChevronDown } from "lucide-react";

import { useAppStore } from "@/store/appStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import { selectActiveFileInfo, selectTableName } from "@/store/selectors/appSelectors";
import { cn } from "@/lib/utils";

const DataContextPanel: React.FC = () => {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  
  const activeFileInfo = useAppStore(selectActiveFileInfo);
  const tableName = useAppStore(selectTableName);
  const { registeredTables, getTableSchema } = useDuckDBStore();
  
  const [schemaCache, setSchemaCache] = useState<Map<string, any[]>>(new Map());

  const toggleTableExpansion = async (table: string) => {
    const newExpanded = new Set(expandedTables);
    
    if (newExpanded.has(table)) {
      newExpanded.delete(table);
    } else {
      newExpanded.add(table);
      
      // Load schema if not cached
      if (!schemaCache.has(table)) {
        const schema = await getTableSchema(table);
        if (schema) {
          setSchemaCache(new Map(schemaCache.set(table, schema)));
        }
      }
    }
    
    setExpandedTables(newExpanded);
  };

  const getColumnTypeIcon = (type: string) => {
    const normalizedType = type.toLowerCase();
    if (normalizedType.includes('int') || normalizedType.includes('number')) {
      return "🔢";
    } else if (normalizedType.includes('text') || normalizedType.includes('varchar')) {
      return "📝";
    } else if (normalizedType.includes('date') || normalizedType.includes('time')) {
      return "📅";
    } else if (normalizedType.includes('bool')) {
      return "✅";
    }
    return "📄";
  };

  const availableTables = Array.from(registeredTables.keys()).filter(table => table !== 'employees_sample');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-white">Data Context</h3>
        </div>
        <p className="text-xs text-white/60">
          Available tables and schemas for AI analysis
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Current Active File */}
        {activeFileInfo && tableName && (
          <div className="p-3 border-b border-white/10">
            <div className="mb-2">
              <span className="text-xs font-medium text-primary uppercase tracking-wider">
                Active Dataset
              </span>
            </div>
            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Table className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-white truncate">
                  {tableName}
                </span>
              </div>
              
              <div className="space-y-1 text-xs text-white/70">
                <div className="flex justify-between">
                  <span>Rows:</span>
                  <span className="text-white/90">{activeFileInfo.rowCount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Columns:</span>
                  <span className="text-white/90">{activeFileInfo.columnCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="text-white/90">{activeFileInfo.fileType?.toUpperCase()}</span>
                </div>
              </div>

              <button
                onClick={() => toggleTableExpansion(tableName)}
                className="w-full mt-2 pt-2 border-t border-primary/20 flex items-center justify-between text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <span>View Schema</span>
                {expandedTables.has(tableName) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {/* Schema Details */}
              {expandedTables.has(tableName) && (
                <div className="mt-3 pt-3 border-t border-primary/20">
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {schemaCache.get(tableName)?.map((column, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <span className="text-lg">{getColumnTypeIcon(column.type)}</span>
                        <span className="text-white/90 font-medium flex-1 truncate">
                          {column.name}
                        </span>
                        <span className="text-white/50 text-xs">
                          {column.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Other Available Tables */}
        {availableTables.length > 0 && (
          <div className="p-3">
            <div className="mb-2">
              <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Other Tables
              </span>
            </div>
            
            <div className="space-y-2">
              {availableTables.map((table) => (
                <div
                  key={table}
                  className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                >
                  <button
                    onClick={() => toggleTableExpansion(table)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Table className="h-4 w-4 text-white/60" />
                      <span className="text-sm text-white/90 truncate">
                        {table}
                      </span>
                    </div>
                    {expandedTables.has(table) ? (
                      <ChevronDown className="h-3 w-3 text-white/60" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-white/60" />
                    )}
                  </button>

                  {/* Schema Details */}
                  {expandedTables.has(table) && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {schemaCache.get(table)?.map((column, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs">
                            <span className="text-sm">{getColumnTypeIcon(column.type)}</span>
                            <span className="text-white/80 flex-1 truncate">
                              {column.name}
                            </span>
                            <span className="text-white/40 text-xs">
                              {column.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Data State */}
        {!activeFileInfo && availableTables.length === 0 && (
          <div className="p-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                <Eye className="w-6 h-6 text-white/40" />
              </div>
            </div>
            <h4 className="text-sm font-medium text-white/70 mb-2">
              No Data Available
            </h4>
            <p className="text-xs text-white/50 leading-relaxed">
              Upload a CSV, JSON, or Parquet file to see your data schema here.
            </p>
          </div>
        )}

        {/* Help Section */}
        <div className="p-3 border-t border-white/10">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-blue-400 mb-1">
                  AI Context
                </div>
                <div className="text-xs text-white/70 leading-relaxed">
                  The AI assistant uses this schema information to understand your data structure and generate accurate queries.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataContextPanel;