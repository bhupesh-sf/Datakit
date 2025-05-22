interface DuckDBState {
  db: any;
  connection: any;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;
  registeredTables: Map<string, string>;
  hasSampleTable: boolean;
  sampleTableName: string;
  isLoading: boolean;
  processingProgress: number;
  processingStatus: string;
  schemaCache: Map<string, { name: string; type: string }[]>;
  lastSchemaCacheUpdate: number;
}

// Basic state selectors
export const selectIsInitialized = (state: DuckDBState) => state.isInitialized;
export const selectIsInitializing = (state: DuckDBState) => state.isInitializing;
export const selectIsLoading = (state: DuckDBState) => state.isLoading;
export const selectError = (state: DuckDBState) => state.error;
export const selectProcessingProgress = (state: DuckDBState) => state.processingProgress;
export const selectProcessingStatus = (state: DuckDBState) => state.processingStatus;

// Sample table selectors
export const selectHasSampleTable = (state: DuckDBState) => state.hasSampleTable;
export const selectSampleTableName = (state: DuckDBState) => state.sampleTableName;

// Table management selectors
export const selectRegisteredTables = (state: DuckDBState) => 
  Array.from(state.registeredTables.keys());

export const selectTableCount = (state: DuckDBState) => 
  state.registeredTables.size;

export const selectHasUserTables = (state: DuckDBState) => {
  const tableCount = state.registeredTables.size;
  return state.hasSampleTable ? tableCount > 1 : tableCount > 0;
};

export const selectUserTables = (state: DuckDBState) => {
  const allTables = Array.from(state.registeredTables.keys());
  return state.hasSampleTable 
    ? allTables.filter(table => table !== state.sampleTableName)
    : allTables;
};

export const selectAllTables = (state: DuckDBState) => 
  Array.from(state.registeredTables.keys());

// Schema cache selectors
export const selectSchemaCache = (state: DuckDBState) => state.schemaCache;
export const selectLastSchemaCacheUpdate = (state: DuckDBState) => state.lastSchemaCacheUpdate;

export const selectTableSchema = (tableName: string) => (state: DuckDBState) =>
  state.schemaCache.get(tableName) || null;

export const selectIsSchemaAvailable = (tableName: string) => (state: DuckDBState) =>
  state.schemaCache.has(tableName);

// Composite selectors for UI
export const selectReadyForQueries = (state: DuckDBState) => 
  state.isInitialized && !state.isLoading && !state.error;

export const selectCanExecuteQueries = (state: DuckDBState) => 
  state.isInitialized && state.registeredTables.size > 0;

// Status text selector
export const selectDuckDBStatus = (state: DuckDBState) => {
  if (!state.isInitialized && !state.isInitializing) {
    return "DuckDB not initialized";
  }
  
  if (state.isInitializing) {
    return "Initializing DuckDB...";
  }
  
  if (state.error) {
    return `Error: ${state.error}`;
  }
  
  if (state.isLoading) {
    return state.processingStatus || "Processing...";
  }
  
  const tableCount = state.registeredTables.size;
  const userTableCount = state.hasSampleTable ? tableCount - 1 : tableCount;
  
  if (tableCount === 0) {
    return "DuckDB ready - no tables loaded";
  }
  
  if (state.hasSampleTable && userTableCount === 0) {
    return "DuckDB ready with sample data - import a file to get started";
  }
  
  return `DuckDB ready - ${userTableCount} user table${userTableCount !== 1 ? 's' : ''} loaded${
    state.hasSampleTable ? ' (+ sample data)' : ''
  }`;
};

// Memoized cache for default query to prevent infinite loops
let cachedDefaultQuery = "";
let lastQueryCacheKey = "";

// For integration with app store - get default query based on available tables
export const selectDefaultQuery = (state: DuckDBState) => {
  // Create a cache key based on relevant state
  const cacheKey = `${state.isInitialized}-${state.registeredTables.size}-${Array.from(state.registeredTables.keys()).sort().join(",")}-${state.hasSampleTable}`;
  
  // Return cached result if nothing relevant has changed
  if (cacheKey === lastQueryCacheKey) {
    return cachedDefaultQuery;
  }
  
  // Update cache
  lastQueryCacheKey = cacheKey;
  
  if (!state.isInitialized || state.registeredTables.size === 0) {
    cachedDefaultQuery = `-- DuckDB is initializing or no tables available
-- Import a file to get started`;
    return cachedDefaultQuery;
  }
  
  const userTables = selectUserTables(state);
  
  // If user has uploaded tables, prioritize the first user table
  if (userTables.length > 0) {
    const primaryTable = userTables[0];
    cachedDefaultQuery = `-- Querying your data: ${primaryTable}
-- Write your SQL query here
SELECT *
FROM "${primaryTable}"
LIMIT 10;`;
    return cachedDefaultQuery;
  }
  
  // Fall back to sample table
  if (state.hasSampleTable) {
    cachedDefaultQuery = `-- Sample employee data is available for testing
-- Import your own files to query your data
SELECT *
FROM "${state.sampleTableName}"
LIMIT 10;`;
    return cachedDefaultQuery;
  }
  
  cachedDefaultQuery = `-- Import a CSV, JSON, or Parquet file to get started
-- Your SQL queries will appear here`;
  return cachedDefaultQuery;
};

// Selector for available tables with metadata
export const selectTablesWithMetadata = (state: DuckDBState) => {
  return Array.from(state.registeredTables.keys()).map(tableName => ({
    name: tableName,
    escapedName: state.registeredTables.get(tableName),
    isSample: tableName === state.sampleTableName,
    hasSchema: state.schemaCache.has(tableName),
    schema: state.schemaCache.get(tableName) || [],
  }));
};

// Utility selector for getting table suggestions for autocomplete
export const selectTableSuggestions = (state: DuckDBState) => {
  return Array.from(state.registeredTables.keys()).map(tableName => ({
    label: tableName,
    kind: tableName === state.sampleTableName ? 'sample' : 'user',
    detail: tableName === state.sampleTableName ? 'Sample data' : 'User table',
    insertText: `"${tableName}"`,
  }));
};

// Selector for column suggestions given a table name
export const selectColumnSuggestions = (tableName: string) => (state: DuckDBState) => {
  const schema = state.schemaCache.get(tableName);
  if (!schema) return [];
  
  return schema.map(column => ({
    label: column.name,
    kind: 'column',
    detail: column.type,
    insertText: `"${column.name}"`,
  }));
};