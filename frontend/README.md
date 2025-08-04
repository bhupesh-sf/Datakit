# DataKit Project Overview

## 1. Introduction

DataKit is a modern web-based data analysis tool that leverages WebAssembly and DuckDB to process large datasets (multi GBs) directly in the browser without requiring server-side processing. It provides a powerful, client-side SQL engine with visualization capabilities and data inspection panel, enabling users to work with CSV, XLSX, PARQUET JSON files efficiently. Users could have chat with your files through chat panel and have the generated queries from ai panel ran over their queies. There's also notebooks. You can bridge to your DuckDB from your notebook and write the sql, make plots, etc. Additionally, transformers from Hugging Face are loaded by default in the environment.
For now the supported models are from: https://huggingface.co/Xenova/models

## 2. Architecture Overview

### 2.1 Core Technologies

- **Frontend Framework**: React with TypeScript
- **Data Processing**: DuckDB-wasm (WebAssembly-based SQL engine)
- **Data Parsing**: Custom streaming parsers + PapaParse
- **File Handling**: File System Access API + standard File API
- **State Management**: Zustand
- **UI Components**: Custom components with Tailwind CSS
- **Visualization**: D3.js integration
- **Code Editing**: Monaco Editor with SQL support

### 2.2 Architectural Patterns

- **Singleton Pattern**: Global DuckDB instance via Zustand store
- **Custom Hooks**: Encapsulated functionality in React hooks
- **Component Composition**: Modular UI components
- **Streaming Data Processing**: Chunked parsing for large files
- **Virtualized Rendering**: Efficient display of large result sets
- **Server-Side Pagination**: Paginated query execution for large datasets

## 3. Core Components

### 3.1 Data Processing

#### 3.1.1 DuckDB Integration (`duckDBStore.ts`)
- Centralized DuckDB instance management
- Table creation and management
- SQL query execution with pagination
- Direct file import capabilities
- BigInt handling for large datasets

#### 3.1.2 File Processing
- `useStreamingCSVParser.ts`: Efficient CSV parsing with chunking
- `useStreamingJSONParser.ts`: JSON parsing with streaming support
- `useDataParser.ts`: Unified interface for different file formats

#### 3.1.3 File System Integration
- `useFileAccess.ts`: File system access and recent files management
- `streamReader.ts`: Efficient stream processing utilities
- `useDirectFileImport.ts`: Direct file import to DuckDB

### 3.2 User Interface

#### 3.2.1 Layout Components
- `MainLayout.tsx`: Application layout structure
- `Sidebar.tsx`: Navigation and file management
- `QueryWorkspace.tsx`: Flexible, resizable query workspace with panels

#### 3.2.2 Data Visualization
- `CSVGrid.tsx`: Grid display for tabular data
- `JSONGrid.tsx`: Specialized display for JSON data
- `QueryResults.tsx`: Virtualized results view with pagination

#### 3.2.3 Query Interface
- `MonacoEditor.tsx`: SQL editor with syntax highlighting and autocomplete
- `QueryHistory.tsx`: History of executed queries
- `SchemaBrowser.tsx`: Database schema exploration
- `QueryTemplates.tsx`: Pre-defined SQL query templates

#### 3.2.4 File Handling
- `FileUploadButton.tsx`: File selection and upload
- `DownloadButton.tsx`: Results export

### 3.3 Custom Hooks

#### 3.3.1 Query Management Hooks
- `useQueryExecution.ts`: Execute queries with pagination and error handling
- `useQueryHistory.ts`: Manage query history and favorites
- `useQueryOptimization.ts`: Analyze and optimize SQL queries

#### 3.3.2 UI Hooks
- `useResizable.ts`: Resize panels and track dimensions

## 4. Data Flow

### 4.1 File Import Process

1. **File Selection**: User selects a file via `FileUploadButton`
2. **Direct Import**: For CSV files, direct import to DuckDB via `registerFileHandle`
3. **Table Creation**: DuckDB creates a table from the imported file
4. **Data Sampling**: Sample of data (1000 rows) loaded for UI display
5. **Schema Detection**: Column types detected from table schema
6. **UI Update**: Data grid and query panel updated with file info

### 4.2 Query Execution Flow

1. **Query Input**: User writes SQL in the Monaco Editor
2. **Query Analysis**: Query is analyzed for optimizations and warnings
3. **Server-Side Pagination**: Query executed with LIMIT/OFFSET for pagination
4. **Result Handling**: Only current page of results loaded into memory
5. **Virtualized Rendering**: Results displayed efficiently using react-window
6. **Export Option**: Results can be downloaded as CSV

## 5. Key Features

### 5.1 Large File Processing

- **Streaming Parsers**: Process files larger than browser memory
- **Chunked Processing**: Parse and load files in manageable chunks
- **Progress Tracking**: Show detailed progress during operations
- **Direct DuckDB Import**: Efficiently import CSV files directly to DuckDB

### 5.2 SQL Capabilities

- **Full SQL Support**: Leverage DuckDB's rich SQL dialect
- **Complex Queries**: Join, aggregate, filter and transform data
- **Fast Execution**: Efficient query processing via WebAssembly
- **SQL Templates**: Pre-defined queries for common operations
- **Schema Browser**: Explore tables and columns for easier query writing

### 5.3 User Experience

- **Recent Files**: Track and quickly reopen recent files
- **File Previews**: View data samples before full processing
- **Progress Indicators**: Detailed status during operations
- **Error Handling**: Clear error messages with recovery options
- **Query History**: Save and reuse previous queries
- **Query Optimization**: Suggestions for better query performance
- **Resizable Layout**: Customize workspace with resizable panels
- **Fullscreen Mode**: Focus on editor or results as needed

### 5.4 Performance Optimizations

- **Server-Side Pagination**: Only load current page of data
- **Virtualized Rendering**: Efficient display of large tables
- **BigInt Handling**: Special handling for large numeric values
- **Lazy Loading**: Components and functionality loaded on-demand
- **Memory Management**: Careful handling of large datasets

## 6. Technical Implementation Details

### 6.1 DuckDB Integration

```typescript
// Paginated query execution
executePaginatedQuery: async (sql, page, pageSize) => {
  // Get total row count
  const countQuery = `SELECT COUNT(*) as total_rows FROM (${sql}) as count_query`;
  const countResult = await connection.query(countQuery);
  const totalRows = Number(countResult.toArray()[0].total_rows);
  
  // Execute paginated query
  const offset = (page - 1) * pageSize;
  const paginatedSQL = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
  const result = await connection.query(paginatedSQL);
  
  // Process results handling BigInt conversion
  const data = processDuckDBResult(result.toArray());
  
  return {
    data,
    columns: result.schema.fields.map(f => f.name),
    totalRows,
    page,
    pageSize,
    totalPages: Math.ceil(totalRows / pageSize)
  };
}
```

### 6.2 Virtualized Results View

```tsx
// Efficient rendering of large result sets
<AutoSizer>
  {({ height, width }) => (
    <List
      height={height}
      width={width}
      itemCount={results.length}
      itemSize={28}
      overscanCount={10}
    >
      {RowRenderer}
    </List>
  )}
</AutoSizer>
```

### 6.3 Custom Hooks for UI Management

```typescript
// Query optimization hook
const {
  suggestions,
  hasWarnings,
  analyzeQuery,
  optimizeQuery
} = useQueryOptimization();
```

## 7. Future Enhancements

- **Advanced Visualizations**: More chart types and customization options
- **Exportable Reports**: Generate reports from query results
- **Data Transformation**: Visual data transformation capabilities
- **Custom Functions**: User-defined functions in SQL
- **Collaborative Features**: Shared queries and results
- **Persistent Storage**: Save queries and results between sessions
- **Dashboard Creation**: Build custom dashboards from queries