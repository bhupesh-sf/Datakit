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



___

Phase 2: Query Tab Enhancement - Design and Implementation Plan
For Phase 2, we'll transform the current query panel into a full-featured, professional-grade SQL workspace. Let's explore the vision and approach before diving into implementation.
Vision for the Enhanced Query Tab
The enhanced Query Tab will provide a modern, IDE-like experience for querying data with SQL, featuring:

Split Layout: A flexible, resizable split between editor and results
Robust SQL Editor: Syntax highlighting, autocompletion, and formatting
Schema Browser: Collapsible panel showing table structure
Query History: Save and reuse previous queries
Keyboard Shortcuts: Power-user productivity shortcuts
Result Visualization: Tabular and chart visualization options

Design Concept
Visually, the Query Tab will follow a three-panel layout:
+----------------------------------------------------------------+
|                           HEADER                               |
+----------------+-----------------------+------------------------|
|                |                       |                        |
|                |                       |                        |
|  SCHEMA        |    SQL EDITOR         |   SAVED QUERIES       |
|  BROWSER       |                       |                        |
|                |                       |                        |
|                |                       |                        |
|                |                       |                        |
|                +-----------------------+                        |
|                |                       |                        |
|                |                       |                        |
|                |    RESULTS            |                        |
|                |                       |                        |
|                |                       |                        |
+----------------+-----------------------+------------------------+
The layout will be responsive with:

Collapsible side panels
Resizable split between editor and results
Full-screen option for editor or results

Key Components in Detail
1. Enhanced SQL Editor
We'll significantly improve the CodeEditor component with:

Monaco Editor Integration: Visual Studio Code's editor for advanced IDE features
SQL-Specific Features:

Syntax highlighting with better color contrast and keyword recognition
Autocompletion for SQL keywords, table names, and columns
Error detection and linting
Code folding for large queries


Toolbar: Formatting, copy, save, and run buttons
Keyboard Shortcuts:

Ctrl+Enter / Cmd+Enter: Execute query
Ctrl+S / Cmd+S: Save query
Ctrl+F / Cmd+F: Find in query
Ctrl+. / Cmd+.: Format query



2. Schema Browser
A collapsible panel showing:

Tables: List of available tables with expand/collapse
Columns: For each table, show columns with data types
Metadata: Additional info like row counts, indexes
Quick Actions:

Insert table name
Generate SELECT statement
Show sample data



3. Query History & Saved Queries
A panel to:

Track History: Automatically save executed queries
Save Favorites: Let users save and name queries
Organize: Group queries by tags or folders
Share: Export queries for sharing

4. Results Panel
Enhanced visualization of query results:

Tabular View: Advanced data grid with sorting and filtering
Pagination: For large result sets
Export Options: CSV, JSON, Excel
Statistics: Execution time, row count, data size

Technical Implementation Approach
1. Component Architecture
We'll create several new components:

QueryWorkspace: Main container component
SchemaBrowser: Left panel showing schema
EnhancedSQLEditor: Improved editor (potentially using Monaco)
QueryHistory: Right panel for saved queries
QueryResults: Enhanced results visualization
StatusBar: Shows execution status and statistics

2. State Management
Extend our Zustand store with:

Schema state: Table and column information
Query history: Previous queries
Saved queries: User-saved queries with names
Editor state: Current query, selected text
Results state: Current results, selected cells

3. API Integration
Enhance interaction with DuckDB:

Load schema information automatically
Provide execution statistics
Support for query cancellation
Improved error handling

Implementation Phases
Let's break down the implementation into smaller parts:

Basic Layout: Create the split layout with placeholders
Schema Browser: Implement the collapsible schema panel
Enhanced Editor: Integrate Monaco or enhance our custom editor
Query History: Add query history functionality
Results Enhancement: Improve results visualization
Polish & Refinement: Add keyboard shortcuts and final polish

Key Technical Decisions
Before implementation, we need to decide on:

Editor Technology: Monaco vs custom editor enhancement
Layout Library: React-Split vs CSS Grid/Flexbox for resizable panels
Storage Approach: How to persist saved queries (localStorage, IndexedDB)
Feature Prioritization: Which features to implement first

Next Steps
Based on this design, would you like to:

Move forward with a specific part of this implementation?
Adjust or refine any aspects of the design?
Focus on a particular technical aspect first?

I recommend we start with the basic layout and schema browser implementation, as they'll provide the foundation for the enhanced query experience.RetryClaude does not have the ability to run the code it generates yet.Claude can make mistakes. Please double-check responses.
___



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



