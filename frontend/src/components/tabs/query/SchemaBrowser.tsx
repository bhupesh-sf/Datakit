import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  HardDrive,
  Cloud,
  Loader2,
} from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";

interface SchemaBrowserProps {
  onInsertQuery: (text: string) => void;
}

interface TableSchema {
  name: string;
  type: "table" | "view";
  source: "local" | "motherduck";
  database?: string;
  columns: {
    name: string;
    type: string;
  }[];
  rowCount?: number;
}

/**
 * Enhanced schema browser showing both local and MotherDuck tables
 */
const SchemaBrowser: React.FC<SchemaBrowserProps> = ({ onInsertQuery }) => {
  const {
    // Local state
    getAvailableTables,
    registeredTables,
    executeQuery,
    lastTableRefresh,
    getObjectType,
    
    motherDuckConnected,
    motherDuckDatabases,
    motherDuckSchemas,
    refreshMotherDuckSchemas,
    motherDuckConnecting,
    motherDuckError,
    executeMotherDuckQuery,
  } = useDuckDBStore();

  const [localSchemas, setLocalSchemas] = useState<Record<string, TableSchema>>({});
  const [motherDuckTableSchemas, setMotherDuckTableSchemas] = useState<Record<string, TableSchema>>({});
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set(["local"]));
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [localLoading, setLocalLoading] = useState<boolean>(true);
  const [localRefreshing, setLocalRefreshing] = useState<boolean>(false);
  const [motherDuckRefreshing, setMotherDuckRefreshing] = useState<Set<string>>(new Set());
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());

  // Dependency tracking for local tables
  const localDependencyKey = useMemo(() => {
    const tableNames = getAvailableTables().sort().join(',');
    const registeredKeys = Array.from(registeredTables.keys()).sort().join(',');
    return `${tableNames}-${registeredKeys}-${lastTableRefresh}`;
  }, [getAvailableTables, registeredTables, lastTableRefresh]);

  const fetchLocalSchemas = useCallback(async () => {
    setLocalLoading(true);
    try {
      const objectNames = getAvailableTables();
      const schemaData: Record<string, TableSchema> = {};

      for (const objectName of objectNames) {
        try {
          const objectType = await getObjectType(objectName);
          const result = await executeQuery(`DESCRIBE "${objectName}"`);

          if (result) {
            const columns = result.toArray().map((row) => ({
              name: row.column_name || row.name || "",
              type: row.column_type || row.type || "",
            }));

            schemaData[objectName] = {
              name: objectName,
              type: objectType || "table",
              source: "local",
              columns,
            };
          }
        } catch (err) {
          console.error(`Error fetching schema for ${objectName}:`, err);
          schemaData[objectName] = {
            name: objectName,
            type: "table",
            source: "local",
            columns: [],
          };
        }
      }

      setLocalSchemas(schemaData);
    } catch (err) {
      console.error("Error fetching local schemas:", err);
    } finally {
      setLocalLoading(false);
    }
  }, [getAvailableTables, getObjectType, executeQuery]);

  // Fetch MotherDuck table columns on demand
  const fetchMotherDuckTableColumns = useCallback(async (database: string, tableName: string) => {
    const tableId = `${database}.${tableName}`;
    
    // Skip if already loaded or currently loading
    if (motherDuckTableSchemas[tableId]?.columns?.length > 0 || loadingColumns.has(tableId)) {
      return;
    }

    setLoadingColumns(prev => new Set(prev).add(tableId));

    try {
      const result = await executeMotherDuckQuery(
        `DESCRIBE "${database}"."${tableName}"`,
        database
      );

      if (result && Array.isArray(result)) {
        const columns = result.map((row: any) => ({
          name: row.column_name || row.name || "",
          type: row.column_type || row.type || "",
        }));

        setMotherDuckTableSchemas(prev => ({
          ...prev,
          [tableId]: {
            name: tableName,
            type: motherDuckSchemas.get(database)?.find(s => s.name === tableName)?.type as "table" | "view" || "table",
            source: "motherduck",
            database,
            columns,
          }
        }));
      }
    } catch (err) {
      console.error(`Error fetching columns for ${database}.${tableName}:`, err);
    } finally {
      setLoadingColumns(prev => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    }
  }, [executeMotherDuckQuery, motherDuckSchemas, motherDuckTableSchemas]);

  // Fetch local schemas when dependencies change
  useEffect(() => {
    fetchLocalSchemas();
  }, [localDependencyKey]);

  // Handle local refresh
  const handleLocalRefresh = async () => {
    if (localRefreshing) return;
    setLocalRefreshing(true);
    try {
      await fetchLocalSchemas();
    } finally {
      setLocalRefreshing(false);
    }
  };

  // Handle MotherDuck database refresh
  const handleMotherDuckRefresh = async (databaseName: string) => {
    if (motherDuckRefreshing.has(databaseName)) return;
    
    setMotherDuckRefreshing(prev => new Set(prev).add(databaseName));
    try {
      await refreshMotherDuckSchemas(databaseName);
      // Clear cached columns for this database
      const keysToRemove = Object.keys(motherDuckTableSchemas).filter(key => 
        key.startsWith(`${databaseName}.`)
      );
      setMotherDuckTableSchemas(prev => {
        const next = { ...prev };
        keysToRemove.forEach(key => delete next[key]);
        return next;
      });
    } catch (err) {
      console.error(`Failed to refresh MotherDuck schemas for ${databaseName}:`, err);
    } finally {
      setMotherDuckRefreshing(prev => {
        const next = new Set(prev);
        next.delete(databaseName);
        return next;
      });
    }
  };

  const toggleDatabase = async (dbId: string) => {
    const isExpanding = !expandedDatabases.has(dbId);
    
    // If expanding a MotherDuck database and schemas not loaded, auto-refresh
    if (isExpanding && dbId !== 'local' && motherDuckConnected) {
      const schemas = motherDuckSchemas.get(dbId);
      if (!schemas || schemas.length === 0) {
        await handleMotherDuckRefresh(dbId);
      }
    }
    
    setExpandedDatabases(prev => {
      const next = new Set(prev);
      if (next.has(dbId)) {
        next.delete(dbId);
      } else {
        next.add(dbId);
      }
      return next;
    });
  };

  const toggleTable = async (tableId: string) => {
    // If it's a MotherDuck table and we're expanding it, fetch columns
    if (!expandedTables.has(tableId) && tableId.includes('.')) {
      const [database, ...tableNameParts] = tableId.split('.');
      const tableName = tableNameParts.join('.'); // Handle table names with dots
      if (database !== 'local') {
        await fetchMotherDuckTableColumns(database, tableName);
      }
    }

    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const generateSelectQuery = (schema: TableSchema) => {
    let query: string;
    
    if (schema.source === 'local') {
      const escapedName = registeredTables.get(schema.name) || `"${schema.name}"`;
      query = `\nSELECT *\nFROM ${escapedName}\nLIMIT 10;`;
    } else {
      // MotherDuck table
      const tableRef = schema.database ? `"${schema.database}"."${schema.name}"` : `"${schema.name}"`;
      query = `\nSELECT *\nFROM ${tableRef}\nLIMIT 10;`;
    }
    
    onInsertQuery(query);
  };

  const generateColumnQuery = (schema: TableSchema, columnName: string) => {
    let query: string;
    
    if (schema.source === 'local') {
      const escapedName = registeredTables.get(schema.name) || `"${schema.name}"`;
      query = `\nSELECT "${columnName}"\nFROM ${escapedName}\nLIMIT 10;`;
    } else {
      // MotherDuck table
      const tableRef = schema.database ? `"${schema.database}"."${schema.name}"` : `"${schema.name}"`;
      query = `\nSELECT "${columnName}"\nFROM ${tableRef}\nLIMIT 10;`;
    }
    
    onInsertQuery(query);
  };

  const getObjectIcon = (type: "table" | "view") => {
    if (type === "view") {
      return <Eye size={14} className="text-blue-400" />;
    }
    return <Table size={14} className="text-primary" />;
  };

  const getColumnTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes("int") || lowerType.includes("float") || lowerType.includes("double") || lowerType.includes("numeric")) {
      return <Hash size={12} className="text-yellow-400" />;
    }
    if (lowerType.includes("date") || lowerType.includes("time")) {
      return <Calendar size={12} className="text-green-400" />;
    }
    if (lowerType.includes("bool")) {
      return <Check size={12} className="text-blue-400" />;
    }
    return <Type size={12} className="text-white/70" />;
  };

  // Prepare data
  const localTables = Object.values(localSchemas);
  const localTablesData = localTables.filter(s => s.type === "table");
  const localViewsData = localTables.filter(s => s.type === "view");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center">
            <Database size={16} className="mr-2 text-primary" />
            Schema Browser
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Local Database Section */}
        <div className="border-b border-white/5">
          {/* Database Header */}
          <div className="flex items-center justify-between px-2 py-2 hover:bg-white/5 cursor-pointer"
               onClick={() => toggleDatabase('local')}>
            <div className="flex items-center space-x-2">
              <span className="text-white/70">
                {expandedDatabases.has('local') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <HardDrive size={14} className="text-primary" />
              <span className="text-sm font-medium text-white">Local Database</span>
              <span className="text-xs text-white/60">
                ({localTablesData.length + localViewsData.length})
              </span>
            </div>
            <Tooltip content="Refresh local schemas">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLocalRefresh();
                }}
                disabled={localRefreshing}
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
              >
                <RefreshCw size={12} className={localRefreshing ? "animate-spin" : ""} />
              </button>
            </Tooltip>
          </div>

          {/* Database Content */}
          {expandedDatabases.has('local') && (
            <div className="pl-6">
              {localLoading ? (
                <div className="flex items-center justify-center py-4 text-white/50">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  <span className="text-sm">Loading local schemas...</span>
                </div>
              ) : localTables.length === 0 ? (
                <div className="px-2 py-4 text-center text-white/50 text-sm">
                  No local tables. Import data to get started.
                </div>
              ) : (
                <div className="py-1">
                  {/* Tables Section */}
                  {localTablesData.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center px-2 py-1 text-xs font-medium text-white/50">
                        <Layers size={12} className="mr-1" />
                        Tables ({localTablesData.length})
                      </div>
                      {localTablesData.map(schema => (
                        <TableItem
                          key={schema.name}
                          schema={schema}
                          tableId={`local.${schema.name}`}
                          isExpanded={expandedTables.has(`local.${schema.name}`)}
                          onToggle={() => toggleTable(`local.${schema.name}`)}
                          onGenerateQuery={generateSelectQuery}
                          onGenerateColumnQuery={generateColumnQuery}
                          getObjectIcon={getObjectIcon}
                          getColumnTypeIcon={getColumnTypeIcon}
                        />
                      ))}
                    </div>
                  )}

                  {/* Views Section */}
                  {localViewsData.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center px-2 py-1 text-xs font-medium text-white/50">
                        <Eye size={12} className="mr-1" />
                        Views ({localViewsData.length})
                      </div>
                      {localViewsData.map(schema => (
                        <TableItem
                          key={schema.name}
                          schema={schema}
                          tableId={`local.${schema.name}`}
                          isExpanded={expandedTables.has(`local.${schema.name}`)}
                          onToggle={() => toggleTable(`local.${schema.name}`)}
                          onGenerateQuery={generateSelectQuery}
                          onGenerateColumnQuery={generateColumnQuery}
                          getObjectIcon={getObjectIcon}
                          getColumnTypeIcon={getColumnTypeIcon}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MotherDuck Database Sections */}
        {motherDuckConnected ? (
          motherDuckDatabases.map((db) => {
            const schemas = motherDuckSchemas.get(db.name) || [];
            const tables = schemas.filter(s => s.type === 'table');
            const views = schemas.filter(s => s.type === 'view');
            const isExpanded = expandedDatabases.has(db.name);

            return (
              <div key={db.name} className="border-b border-white/5">
                {/* Database Header */}
                <div className="flex items-center justify-between px-2 py-2 hover:bg-white/5 cursor-pointer"
                     onClick={() => toggleDatabase(db.name)}>
                  <div className="flex items-center space-x-2">
                    <span className="text-white/70">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <Cloud size={16} className="text-orange-300" />
                    <span className="text-sm font-medium text-white">{db.name}</span>
                    {db.shared && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                        Shared
                      </span>
                    )}
                    <span className="text-xs text-white/60">
                      ({tables.length + views.length})
                    </span>
                  </div>
                  <Tooltip content={`Refresh ${db.name} schemas`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMotherDuckRefresh(db.name);
                      }}
                      disabled={motherDuckRefreshing.has(db.name)}
                      className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
                    >
                      <RefreshCw size={12} className={motherDuckRefreshing.has(db.name) ? "animate-spin" : ""} />
                    </button>
                  </Tooltip>
                </div>

                {/* Database Content */}
                {isExpanded && (
                  <div className="pl-6">
                    {motherDuckRefreshing.has(db.name) ? (
                      <div className="flex items-center justify-center py-4 text-white/50">
                        <Loader2 size={16} className="animate-spin mr-2" />
                        <span className="text-sm">Loading {db.name} schemas...</span>
                      </div>
                    ) : schemas.length === 0 ? (
                      <div className="px-2 py-4 text-center text-white/50 text-sm">
                        No tables found in {db.name}
                      </div>
                    ) : (
                      <div className="py-1">
                        {/* Tables Section */}
                        {tables.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center px-2 py-1 text-xs font-medium text-white/50">
                              <Layers size={12} className="mr-1" />
                              Tables ({tables.length})
                            </div>
                            {tables.map(table => {
                              const tableId = `${db.name}.${table.name}`;
                              const schema = motherDuckTableSchemas[tableId] || {
                                name: table.name,
                                type: table.type as "table" | "view",
                                source: "motherduck" as const,
                                database: db.name,
                                columns: [],
                              };

                              return (
                                <TableItem
                                  key={tableId}
                                  schema={schema}
                                  tableId={tableId}
                                  isExpanded={expandedTables.has(tableId)}
                                  isLoadingColumns={loadingColumns.has(tableId)}
                                  onToggle={() => toggleTable(tableId)}
                                  onGenerateQuery={generateSelectQuery}
                                  onGenerateColumnQuery={generateColumnQuery}
                                  getObjectIcon={getObjectIcon}
                                  getColumnTypeIcon={getColumnTypeIcon}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Views Section */}
                        {views.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center px-2 py-1 text-xs font-medium text-white/50">
                              <Eye size={12} className="mr-1" />
                              Views ({views.length})
                            </div>
                            {views.map(view => {
                              const tableId = `${db.name}.${view.name}`;
                              const schema = motherDuckTableSchemas[tableId] || {
                                name: view.name,
                                type: view.type as "table" | "view",
                                source: "motherduck" as const,
                                database: db.name,
                                columns: [],
                              };

                              return (
                                <TableItem
                                  key={tableId}
                                  schema={schema}
                                  tableId={tableId}
                                  isExpanded={expandedTables.has(tableId)}
                                  isLoadingColumns={loadingColumns.has(tableId)}
                                  onToggle={() => toggleTable(tableId)}
                                  onGenerateQuery={generateSelectQuery}
                                  onGenerateColumnQuery={generateColumnQuery}
                                  getObjectIcon={getObjectIcon}
                                  getColumnTypeIcon={getColumnTypeIcon}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // MotherDuck not connected
          <div className="border-b border-white/5">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-500/5">
              <div className="flex items-center space-x-2">
                <Cloud size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-white/60">MotherDuck</span>
                {motherDuckConnecting && <Loader2 size={12} className="animate-spin" />}
              </div>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center space-x-2 text-white/50">
             
                <span className="text-sm">
                  {motherDuckConnecting ? 'Connecting...' : ''}
                </span>
              </div>
              {motherDuckError && (
                <p className="text-xs text-red-400 mt-2">{motherDuckError}</p>
              )}
              <p className="text-xs text-white/40 mt-2">
                Connect from the Import tab to see remote tables
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Table Item Component
interface TableItemProps {
  schema: TableSchema;
  tableId: string;
  isExpanded: boolean;
  isLoadingColumns?: boolean;
  onToggle: () => void;
  onGenerateQuery: (schema: TableSchema) => void;
  onGenerateColumnQuery: (schema: TableSchema, columnName: string) => void;
  getObjectIcon: (type: "table" | "view") => React.ReactNode;
  getColumnTypeIcon: (type: string) => React.ReactNode;
}

const TableItem: React.FC<TableItemProps> = ({ 
  schema, 
  tableId, 
  isExpanded, 
  isLoadingColumns = false,
  onToggle, 
  onGenerateQuery, 
  onGenerateColumnQuery,
  getObjectIcon,
  getColumnTypeIcon 
}) => {
  return (
    <div className="schema-item group">
      {/* Table/View row */}
      <div
        className="flex items-center px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer text-sm"
        onClick={onToggle}
      >
        <span className="mr-1.5 text-white/70">
          {schema.columns.length > 0 || isLoadingColumns ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div className="w-3.5 h-3.5" />
          )}
        </span>
        
        {getObjectIcon(schema.type)}
        
        <span className="flex-1 text-white/90 truncate ml-1.5" title={schema.name}>
          {schema.name}
        </span>
        
        <Tooltip placement="left" content="Insert SELECT query">
          <button
            className="opacity-0 group-hover:opacity-100 hover:text-primary transition-all text-white/70 p-1"
            onClick={(e) => {
              e.stopPropagation();
              onGenerateQuery(schema);
            }}
          >
            <FileText size={12} />
          </button>
        </Tooltip>
      </div>

      {/* Columns */}
      {isExpanded && (
        <div className="ml-6 pl-2 border-l border-white/10 mt-1 mb-2">
          {isLoadingColumns ? (
            <div className="flex items-center py-2 text-white/40 text-xs">
              <Loader2 size={12} className="animate-spin mr-1.5" />
              Loading columns...
            </div>
          ) : schema.columns.length > 0 ? (
            <div className="space-y-0.5">
              {schema.columns.map((column) => (
                <div
                  key={`${tableId}-${column.name}`}
                  className="flex items-center px-2 py-1 hover:bg-white/5 rounded text-xs group/column"
                >
                  {getColumnTypeIcon(column.type)}
                  
                  <span className="ml-1.5 text-white/80 truncate flex-1" title={column.name}>
                    {column.name}
                  </span>
                  
                  <span className="text-white/40 text-xs mr-2">
                    {column.type}
                  </span>
                  
                  <Tooltip placement="left" content="Insert column query">
                    <button
                      className="opacity-0 group-hover/column:opacity-100 hover:text-primary transition-all text-white/70 p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenerateColumnQuery(schema, column.name);
                      }}
                    >
                      <FileText size={10} />
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-2 text-white/40 text-xs">
              No columns available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchemaBrowser;