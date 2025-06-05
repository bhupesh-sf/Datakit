import React, { useState, useEffect } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";
import {
  Database,
  Table,
  ChevronRight,
  ChevronDown,
  FileText,
  Hash,
  Calendar,
  Check,
  Type,
} from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";

interface SchemaBrowserProps {
  onInsertQuery: (text: string) => void;
}

interface TableSchema {
  name: string;
  columns: {
    name: string;
    type: string;
  }[];
}

/**
 * Schema browser component to display database tables and columns
 */
const SchemaBrowser: React.FC<SchemaBrowserProps> = ({ onInsertQuery }) => {
  const {
    getAvailableTables,
    registeredTables,
    executeQuery,
    lastTableRefresh,
  } = useDuckDBStore();

  const [tables, setTables] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<Record<string, TableSchema>>({});
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch tables on mount and when registered tables change
  useEffect(() => {
    const fetchTables = async () => {
      setLoading(true);
      try {
        const tableNames = getAvailableTables();
        setTables(tableNames);

        // Fetch schema for each table
        const schemaData: Record<string, TableSchema> = {};

        for (const tableName of tableNames) {
          try {
            // Execute a query to get column information
            const result = await executeQuery(`DESCRIBE "${tableName}"`);

            if (result) {
              const columns = result.toArray().map((row) => ({
                name: row.column_name || row.name || "",
                type: row.column_type || row.type || "",
              }));

              schemaData[tableName] = {
                name: tableName,
                columns,
              };
            }
          } catch (err) {
            console.error(`Error fetching schema for ${tableName}:`, err);
          }
        }

        setSchemas(schemaData);
      } catch (err) {
        console.error("Error fetching tables:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTables();
  }, [getAvailableTables, registeredTables, executeQuery, lastTableRefresh]);

  // Toggle table expansion
  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  // Generate query based on table
  const generateSelectQuery = (tableName: string) => {
    const query = `\nSELECT *\nFROM "${tableName}"\nLIMIT 10;`;
    onInsertQuery(query);
  };

  // Get icon for column type
  const getColumnTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (
      lowerType.includes("int") ||
      lowerType.includes("float") ||
      lowerType.includes("double")
    ) {
      return <Hash size={14} className="text-tertiary" />;
    }
    if (lowerType.includes("date") || lowerType.includes("time")) {
      return <Calendar size={14} className="text-secondary" />;
    }
    if (lowerType.includes("bool")) {
      return <Check size={14} className="text-primary" />;
    }
    return <Type size={14} className="text-white/70" />;
  };

  if (loading) {
    return (
      <div className="p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Schema Browser</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-full text-white/50">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mb-2"></div>
          <p className="text-xs">Loading schema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-sm font-medium flex items-center">
          <Database size={16} className="mr-2 text-primary" />
          Schema Browser
        </h3>
      </div>

      <div className="p-2 flex-1 overflow-auto">
        {tables.length === 0 ? (
          <div className="p-4 text-center text-white/50 text-xs">
            No tables available. Open a file to create a table.
          </div>
        ) : (
          <div className="space-y-1">
            {tables.map((tableName) => (
              <div key={tableName} className="schema-item group">
                {/* Table row */}
                <div
                  className="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-sm"
                  onClick={() => toggleTable(tableName)}
                >
                  <span className="mr-1.5 text-white/70">
                    {expandedTables.has(tableName) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </span>
                  <Table size={16} className="mr-1.5 text-primary" />
                  <span
                    className="flex-1 text-white/90 truncate"
                    title={tableName}
                  >
                    {tableName}
                  </span>
                  <Tooltip placement="left" content="Insert SELECT query">
                    <button
                      className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity text-white/70"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateSelectQuery(tableName);
                      }}
                    >
                      <FileText size={14} />
                    </button>
                  </Tooltip>
                </div>

                {/* Columns */}
                {expandedTables.has(tableName) && schemas[tableName] && (
                  <div className="ml-7 pl-2 border-l border-white/10 mt-1 mb-2 space-y-1">
                    {schemas[tableName].columns.map((column) => (
                      <div
                        key={`${tableName}-${column.name}`}
                        className="flex items-center p-1.5 hover:bg-white/5 rounded text-xs group/column"
                      >
                        {getColumnTypeIcon(column.type)}

                        <span
                          title={column.name}
                          className="ml-1.5 text-white/80 truncate"
                        >
                          {column.name}
                        </span>

                        <span className="ml-auto text-white/50 text-xs">
                          {column.type}
                        </span>

                        <Tooltip placement="left" content="Insert column name">
                          <button
                            className="opacity-0 group-hover/column:opacity-100 hover:text-primary transition-opacity text-white/70 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              const query = `\nSELECT "${column.name}" \nFROM "${tableName}"\nLIMIT 10;`;
                              onInsertQuery(query);
                            }}
                          >
                            <FileText size={12} />
                          </button>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemaBrowser;
