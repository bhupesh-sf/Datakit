# DataKit Project Overview

## 1. Introduction

DataKit is a modern web-based data analysis tool that leverages WebAssembly and DuckDB to process large datasets (up to 4-5GB) directly in the browser without requiring server-side processing. It provides a powerful, client-side SQL engine with visualization capabilities, enabling users to work with CSV and JSON files efficiently.

## 2. Architecture Overview

### 2.1 Core Technologies

- **Frontend Framework**: React with TypeScript
- **Data Processing**: DuckDB-wasm (WebAssembly-based SQL engine)
- **Data Parsing**: Custom streaming parsers + PapaParse
- **File Handling**: File System Access API + standard File API
- **State Management**: Zustand
- **UI Components**: Custom components with Tailwind CSS
- **Visualization**: D3.js integration

### 2.2 Architectural Patterns

- **Singleton Pattern**: Global DuckDB instance via Zustand store
- **Custom Hooks**: Encapsulated functionality in React hooks
- **Component Composition**: Modular UI components
- **Streaming Data Processing**: Chunked parsing for large files

## 3. Core Components

### 3.1 Data Processing

#### 3.1.1 DuckDB Integration (`duckDBStore.ts`)
- Centralized DuckDB instance management
- Table creation and management
- SQL query execution
- Direct file import capabilities

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

#### 3.2.2 Data Visualization
- `CSVGrid.tsx`: Grid display for tabular data
- `JSONGrid.tsx`: Specialized display for JSON data

#### 3.2.3 Query Interface
- `QueryPanel.tsx`: SQL editor and results viewer
- `QueryButton.tsx`: Query execution control
- `QueryResults.tsx`: Results display

#### 3.2.4 File Handling
- `FileUploadButton.tsx`: File selection and upload
- `DownloadButton.tsx`: Results export

## 4. Data Flow

### 4.1 File Import Process

1. **File Selection**: User selects a file via `FileUploadButton`
2. **Direct Import**: For CSV files, direct import to DuckDB via `registerFileHandle`
3. **Table Creation**: DuckDB creates a table from the imported file
4. **Data Sampling**: Sample of data (1000 rows) loaded for UI display
5. **Schema Detection**: Column types detected from table schema
6. **UI Update**: Data grid and query panel updated with file info

### 4.2 Query Execution Flow

1. **Query Input**: User writes SQL in `QueryPanel`
2. **Query Processing**: Query sent to DuckDB via store
3. **Result Handling**: Results transformed for display
4. **Visualization**: Results displayed in `QueryResults` component
5. **Export Option**: Results can be downloaded as CSV

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

### 5.3 User Experience

- **Recent Files**: Track and quickly reopen recent files
- **File Previews**: View data samples before full processing
- **Progress Indicators**: Detailed status during operations
- **Error Handling**: Clear error messages with recovery options

## 6. Technical Implementation Details

### 6.1 DuckDB Integration

```typescript
// Singleton DuckDB store (Zustand)
export const useDuckDBStore = create<DuckDBState>((set, get) => ({
  // State properties
  db: null,
  connection: null,
  isInitialized: false,
  
  // Initialize DuckDB instance
  initialize: async () => {
    // DuckDB initialization logic
  },
  
  // Direct file import
  importFileDirectly: async (file: File) => {
    // Register file with DuckDB
    // Create table from file
    // Return table info
  },
  
  // Query execution
  executeQuery: async (sql: string) => {
    // Execute SQL query against DuckDB
    // Return results
  }
}));


## TODO

0.1> XSLX
0> ICONS
1> Recent files
2> query panel and all the buttons, etc in it
3> visual
4> llm

TS issues



Real Solution: Client-Side Conversion
For the most reliable experience, consider implementing a client-side conversion approach:

Use SheetJS (xlsx.js) to parse Excel files in the browser
Convert parsed data to CSV format
Import the resulting CSV instead of the original Excel file

Implementation Phases
Phase 1: Tab Interface & Navigation System
Objective: Replace the current panel approach with a full-width tabbed interface featuring unique styling.
Key Components:

Create a TabNavigation component with custom-styled tabs that slide/fade content
Implement state management for active tab selection
Refactor Home.tsx to use the tab-based layout instead of the panel approach
Create placeholders for Query and Visualization tabs

Design Approach:

Use a horizontal navigation bar with animated indicators
Implement subtle transitions between tab content
Ensure responsive behavior across different screen sizes

Phase 2: Query Tab Enhancement
Objective: Transform the current query panel into a full-featured query tab with improved SQL editing capabilities.
Key Components:

Enhance CodeEditor with more advanced syntax highlighting and autocomplete
Create a more spacious query execution environment
Add query history functionality
Implement improved query result visualization
Add schema browser for easier table/column reference

Design Approach:

Split the query area into editor and results sections
Add collapsible schema browser on the side
Implement keyboard shortcuts for common operations

Phase 3: Visualization System
Objective: Create a visualization tab that leverages DuckDB query results to generate interactive charts.
Key Components:

Develop a chart configuration interface
Create a library of basic chart types (line, bar, scatter, pie)
Implement color customization tools
Build an integration layer between DuckDB query results and chart data
Add chart export/sharing capabilities

Design Approach:

Create a wizard-like interface for chart creation
Allow direct SQL input or visual query builder
Implement a chart gallery for quick selection
Enable drag-and-drop customization of chart elements