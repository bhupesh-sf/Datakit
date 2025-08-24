// Stored connection (without password)
export interface PostgreSQLConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  schema: string;
  sslEnabled: boolean;
  connectionTimeout: number;
  queryTimeout: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Connection test result
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  errorCode?: string;
  connectionTime?: number;
}

// Schema discovery types
export interface PostgreSQLSchema {
  schemaName: string;
  tableCount: number;
  viewCount: number;
  isSystemSchema: boolean;
}

export interface PostgreSQLTable {
  tableName: string;
  schemaName: string;
  tableType: 'table' | 'view' | 'materialized_view';
  rowCount?: number;
  size?: string;
  comment?: string;
  lastModified?: string;
  columns?: PostgreSQLColumn[];
}

export interface PostgreSQLColumn {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  characterMaximumLength?: number;
  numericPrecision?: number;
  numericScale?: number;
  comment?: string;
}

// Table detailed info
export interface PostgreSQLTableInfo {
  table: PostgreSQLTable;
  columns: PostgreSQLColumn[];
  indexes?: TableIndex[];
  foreignKeys?: ForeignKey[];
  constraints?: TableConstraint[];
}

// Query execution types
export interface QueryRequest {
  sql: string;
  limit?: number;
  timeout?: number;
}

export interface QueryResult {
  columns: QueryColumn[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
  affectedRows?: number;
  isSelect: boolean;
  warnings?: string[];
}

// Data preview
export interface TablePreviewRequest {
  limit?: number;
  offset?: number;
  orderBy?: {
    column: string;
    direction: 'ASC' | 'DESC';
  };
  filters?: TableFilter[];
}

export interface TablePreviewResult {
  columns: QueryColumn[];
  rows: any[][];
  totalRows: number;
  hasMore: boolean;
  queryExecuted: string;
}

// State management types
export interface PostgreSQLState {
  // Connections
  connections: PostgreSQLConnection[];
  selectedConnection: PostgreSQLConnection | null;
  isConnecting: boolean;
  connectionError: string | null;

  // Schema discovery
  schemas: PostgreSQLSchema[];
  selectedSchema: string | null;
  tables: PostgreSQLTable[];
  selectedTables: PostgreSQLTable[];
  isLoadingSchemas: boolean;
  isLoadingTables: boolean;
  schemaError: string | null;

  // Queries
  queryResults: QueryResult[];
  isExecutingQuery: boolean;
  queryError: string | null;
  queryHistory: QueryHistoryEntry[];

  // UI state
  schemaTreeExpanded: Record<string, boolean>;
  tableDetailsCache: Record<string, PostgreSQLTableInfo>;
}

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  connectionId: string;
  connectionName: string;
  executedAt: string;
  executionTime: number;
  rowCount: number;
  success: boolean;
  error?: string;
}

// API Response types
export interface CreateConnectionRequest {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  schema: string;
  sslEnabled: boolean;
  connectionTimeout: number;
  queryTimeout: number;
}

export interface UpdateConnectionRequest
  extends Partial<CreateConnectionRequest> {
  id: string;
}

export interface TestConnectionRequest {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled: boolean;
  connectionTimeout: number;
}

// Import/Export types (for integration with DataKit)
export interface PostgreSQLImportResult {
  data: any[][];
  columnTypes: any[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType: 'postgres';
  loadedToDuckDB: boolean;
  tableName: string;
  isRemote: true;
  remoteProvider: 'postgresql';
  remoteURL: string;
  postgresql: {
    connectionId: string;
    connectionName: string;
    schema: string;
    table: string;
    originalRowCount: number;
    queryUsed: string;
  };
}

// Component Props
export interface PostgreSQLPanelProps {
  onImport: (result: PostgreSQLImportResult) => void;
}
