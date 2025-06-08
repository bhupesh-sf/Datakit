import React, { useState, useEffect } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";
import {
  Database,
  Table,
  Eye,
  ChevronRight,
  ChevronDown,
  FileText,
  Hash,
  Calendar,
  Check,
  Type,
  Layers,
  RefreshCw,
} from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";

interface SchemaBrowserProps {
  onInsertQuery: (text: string) => void;
}

interface TableSchema {
  name: string;
  type: "table" | "view";
  columns: {
    name: string;
    type: string;
  }[];
  rowCount?: number;
}

interface ObjectRowProps {
  schema: TableSchema;
  expanded: boolean;
  onToggle: () => void;
  onGenerateQuery: () => void;
  onInsertQuery: (text: string) => void;
  getObjectIcon: (type: "table" | "view") => React.ReactNode;
  getColumnTypeIcon: (type: string) => React.ReactNode;
  registeredTables: Map<string, string>;
}

/**
 * Schema browser component to display database tables and views
 */
const SchemaBrowser: React.FC<SchemaBrowserProps> = ({ onInsertQuery }) => {
  const {
    getAvailableTables,
    registeredTables,
    executeQuery,
    lastTableRefresh,
    getObjectType, 
  } = useDuckDBStore();


  const [schemas, setSchemas] = useState<Record<string, TableSchema>>({});
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);


  const fetchTablesAndViews = async () => {
    setLoading(true);
    try {
      const objectNames = getAvailableTables();

      // Fetch schema for each object and determine its type
      const schemaData: Record<string, TableSchema> = {};

      for (const objectName of objectNames) {
        try {
          const objectType = await getObjectType(objectName);
          
          // Execute a query to get column information
          const result = await executeQuery(`DESCRIBE "${objectName}"`);

          if (result) {
            const columns = result.toArray().map((row) => ({
              name: row.column_name || row.name || "",
              type: row.column_type || row.type || "",
            }));

            schemaData[objectName] = {
              name: objectName,
              type: objectType || "table",
              columns,
            };
          }
        } catch (err) {
          console.error(`Error fetching schema for ${objectName}:`, err);
          schemaData[objectName] = {
            name: objectName,
            type: "table",
            columns: [],
          };
        }
      }

      setSchemas(schemaData);

      const tables = Object.values(schemaData).filter(s => s.type === 'table');
      const views = Object.values(schemaData).filter(s => s.type === 'view');
      console.log(`[SchemaBrowser] Loaded ${tables.length} tables and ${views.length} views`);
      
    } catch (err) {
      console.error("Error fetching objects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTablesAndViews();
  }, [getAvailableTables, registeredTables, executeQuery, lastTableRefresh]);

  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await fetchTablesAndViews();
    } finally {
      setRefreshing(false);
    }
  };

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

  // Generate query based on table/view
  const generateSelectQuery = (objectName: string) => {
    const escapedName = registeredTables.get(objectName) || `"${objectName}"`;
    const query = `\nSELECT *\nFROM ${escapedName}\nLIMIT 10;`;
    onInsertQuery(query);
  };


  const getObjectIcon = (type: "table" | "view") => {
    if (type === "view") {
      return <Eye size={16} className="text-blue-400" />;
    }
    return <Table size={16} className="text-primary" />;
  };

  // Get icon for column type
  const getColumnTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (
      lowerType.includes("int") ||
      lowerType.includes("float") ||
      lowerType.includes("double")
    ) {
      return <Hash size={14} className="text-yellow-400" />;
    }
    if (lowerType.includes("date") || lowerType.includes("time")) {
      return <Calendar size={14} className="text-green-400" />;
    }
    if (lowerType.includes("bool")) {
      return <Check size={14} className="text-blue-400" />;
    }
    return <Type size={14} className="text-white/70" />;
  };

  const allSchemas = Object.values(schemas);
  const tables = allSchemas.filter(s => s.type === "table");
  const views = allSchemas.filter(s => s.type === "view");

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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center">
            <Database size={16} className="mr-2 text-primary" />
            Schema Browser
          </h3>
          <Tooltip content="Refresh schema">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </Tooltip>
        </div>
        
       
      </div>

      <div className="p-2 flex-1 overflow-auto">
        {allSchemas.length === 0 ? (
          <div className="p-4 text-center text-white/50 text-xs">
            No tables or views available. Import a dataset to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {tables.length > 0 && (
              <div>
                <div className="flex items-center px-2 py-1 text-xs font-medium text-white/60 tracking-wide">
                  <Layers size={12} className="mr-1.5" />
                  Tables ({tables.length})
                </div>
                <div className="space-y-1">
                  {tables.map((schema) => (
                    <ObjectRow
                      key={`table-${schema.name}`}
                      schema={schema}
                      expanded={expandedTables.has(schema.name)}
                      onToggle={() => toggleTable(schema.name)}
                      onGenerateQuery={() => generateSelectQuery(schema.name)}
                      onInsertQuery={onInsertQuery}
                      getObjectIcon={getObjectIcon}
                      getColumnTypeIcon={getColumnTypeIcon}
                      registeredTables={registeredTables}
                    />
                  ))}
                </div>
              </div>
            )}

            {views.length > 0 && (
              <div>
                <div className="flex items-center px-2 py-1 text-xs font-medium text-white/60 tracking-wide">
                  <Eye size={12} className="mr-1.5" />
                  Views ({views.length})
                </div>
                <div className="space-y-1">
                  {views.map((schema) => (
                    <ObjectRow
                      key={`view-${schema.name}`}
                      schema={schema}
                      expanded={expandedTables.has(schema.name)}
                      onToggle={() => toggleTable(schema.name)}
                      onGenerateQuery={() => generateSelectQuery(schema.name)}
                      onInsertQuery={onInsertQuery}
                      getObjectIcon={getObjectIcon}
                      getColumnTypeIcon={getColumnTypeIcon}
                      registeredTables={registeredTables}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ObjectRow: React.FC<ObjectRowProps> = ({
  schema,
  expanded,
  onToggle,
  onGenerateQuery,
  onInsertQuery,
  getObjectIcon,
  getColumnTypeIcon,
  registeredTables,
}) => {
  return (
    <div className="schema-item group">
      {/* Object row */}
      <div
        className="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer text-sm"
        onClick={onToggle}
      >
        <span className="mr-1.5 text-white/70">
          {expanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </span>
        {getObjectIcon(schema.type)}
        <span
          className="flex-1 text-white/90 truncate ml-1.5"
          title={schema.name}
        >
          {schema.name}
        </span>
        
       
        
        <Tooltip placement="left" content="Insert SELECT query">
          <button
            className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity text-white/70"
            onClick={(e) => {
              e.stopPropagation();
              onGenerateQuery();
            }}
          >
            <FileText size={14} />
          </button>
        </Tooltip>
      </div>

      {/* Columns */}
      {expanded && schema.columns && (
        <div className="ml-7 pl-2 border-l border-white/10 mt-1 mb-2 space-y-1">
          {schema.columns.map((column) => (
            <div
              key={`${schema.name}-${column.name}`}
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

              <Tooltip placement="left" content="Insert column query">
                <button
                  className="opacity-0 group-hover/column:opacity-100 hover:text-primary transition-opacity text-white/70 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    const escapedTableName = registeredTables.get(schema.name) || `"${schema.name}"`;
                    const query = `\nSELECT "${column.name}" \nFROM ${escapedTableName}\nLIMIT 10;`;
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
  );
};

export default SchemaBrowser;