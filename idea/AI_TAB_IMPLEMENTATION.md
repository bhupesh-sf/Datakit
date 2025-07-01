AI Tab Implementation Documentation

  Overview

  This document provides a comprehensive guide to the AI tab implementation in the DataKit application. The AI tab enables users to interact with AI models (OpenAI and
  Anthropic Claude) to generate SQL queries, analyze data, and get insights through natural language conversations.

  🎯 Features Implemented

  Core Features

  - Multi-Provider AI Support: OpenAI GPT-4/3.5 and Anthropic Claude integration
  - Natural Language to SQL: Convert user queries to executable SQL with real schema awareness
  - Auto-Execution: Automatically run generated SQL queries with validation
  - Real-time Streaming: Stream AI responses in real-time for better UX
  - Schema-Aware Context: AI knows actual table columns to generate accurate SQL
  - CORS-Safe API Calls: Browser-compatible API requests with proxy support
  - Syntax Highlighting: Prism.js integration for beautiful SQL display

  UI/UX Features

  - Modern Three-Zone Layout: Clean separation of prompt, response, and results
  - Collapsible Schema Browser: Integrated from query tab with toggle in prompt header
  - SQL Query Cards: Individual cards with syntax highlighting and run buttons
  - Intelligent Suggestions: Context-aware prompt suggestions
  - Full-Width Results: Collapsible results panel at bottom for better data visibility
  - Smooth Animations: Framer Motion for elegant transitions

  📁 File Structure and Purpose

  Core AI System

  src/
  ├── types/ai.ts                     # TypeScript definitions for AI system
  ├── lib/ai/
  │   ├── aiService.ts                # Main AI service orchestrator
  │   ├── corsProxy.ts                # CORS handling and proxy strategies
  │   ├── modelManager.ts             # Local model management (future)
  │   ├── types.ts                    # Internal AI library types
  │   ├── prompts/
  │   │   └── sqlPrompts.ts           # SQL generation prompt templates
  │   └── providers/
  │       ├── safeApiProvider.ts      # CORS-safe API wrapper
  │       ├── openai.ts               # OpenAI API integration
  │       ├── anthropic.ts            # Anthropic Claude API integration
  │       └── webllm.ts               # Local models (disabled, coming soon)
  ├── store/aiStore.ts                # Zustand state management for AI
  └── hooks/ai/
      ├── useAIOperations.ts          # Main AI operations hook
      └── useAIQueryExecution.ts      # AI-generated SQL execution

  UI Components

  src/components/tabs/ai/
  ├── AIWorkspace.tsx                 # Main container with three-zone layout
  ├── PromptPanel.tsx                 # Left panel - prompt input with suggestions
  ├── ResponsePanel.tsx               # Right panel - AI response with SQL cards
  ├── ResultsPanel.tsx                # Bottom panel - query results (collapsible)
  ├── SQLQueryCard.tsx                # Individual SQL query display with actions
  ├── ContextBar.tsx                  # Top bar with table info and settings
  ├── ModelSelector.tsx               # AI model selection dropdown
  └── ApiKeyModal.tsx                 # API key configuration modal

  🔧 Technical Implementation Details

  1. Three-Zone Layout Architecture

  Layout Structure:
  ┌─────────────────────────────────────────────────┐
  │ Context Bar (table info, auto-execute, settings) │
  ├─────┬───────────────────┬───────────────────────┤
  │     │ Prompt Panel      │ Response Panel        │
  │ [▶] │ (40% width)       │ (60% width)           │
  │     │ - Input area      │ - AI response text    │
  │     │ - Suggestions     │ - SQL query cards     │
  │     │ - Model selector  │ - Syntax highlighting │
  ├─────┴───────────────────┴───────────────────────┤
  │ Results Panel (collapsible, full width)          │
  │ - Query results table with pagination            │
  └─────────────────────────────────────────────────┘

  2. Schema-Aware SQL Generation

  Real-time Schema Fetching:
  const getDataContext = useCallback(async () => {
    const result = await executeQuery(`DESCRIBE "${tableName}"`);
    const schema = result ? result.toArray().map((row: any) => ({
      name: row.column_name || row.name || "",
      type: row.column_type || row.type || "",
    })) : [];

    return { tableName, schema, rowCount, description };
  }, [tableName, activeFileInfo, executeQuery]);

  3. State Management Updates

  Centralized Streaming State:
  interface AIState {
    // ... existing state
    currentResponse: string | null;
    streamingResponse: string;  // New: shared streaming state
    queryResults: QueryResults | null;
  }

  4. Enhanced SQL Extraction

  Flexible Pattern Matching:
  // Handles various code block formats
  const sqlBlockMatches = response.match(/```sql\s*\n([\s\S]*?)\n\s*```/gi) ||
                         response.match(/```\s*\n([\s\S]*?)\n\s*```/gi);

  // Multi-line SQL detection for non-code-block queries
  let inQuery = false;
  let currentQuery: string[] = [];
  for (const line of lines) {
    if (/^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)/i.test(line.trim())) {
      inQuery = true;
      // ... collect lines until query ends
    }
  }

  5. Auto-Execution with Validation

  Smart Query Validation:
  const autoExecuteSQLQueries = useCallback(async (response: string) => {
    if (!autoExecuteSQL) return;

    const queries = extractSQLQueries(response);
    if (queries.length === 0) return;

    const firstQuery = queries[0];

    // Validate before executing
    if (firstQuery && firstQuery.length > 20 && !firstQuery.endsWith('SELECT')) {
      await handleRunSQL(firstQuery);
    }
  }, [autoExecuteSQL, extractSQLQueries, handleRunSQL]);

  🎨 UI/UX Enhancements

  Prompt Panel Features

  - Collapsible schema browser toggle integrated in header
  - Clean prompt input with auto-resize
  - Smart suggestions that disappear when typing
  - Compact model selector in header
  - API key setup prompt when no key configured

  Response Panel Features

  - Real-time streaming display
  - Automatic text/SQL separation
  - SQL query cards with:
    - Prism.js syntax highlighting
    - Copy button with feedback
    - Run button for execution
    - Primary query indicator

  Results Panel Features

  - Collapsible design with smooth animations
  - Resizable height with drag handle
  - Auto-expand on query execution (if enabled)
  - Full QueryResults integration
  - Show/hide toggle when collapsed

  🔍 Key Improvements

  1. Fixed Streaming Response Display

  - Moved streaming state to Zustand store for proper sharing
  - ResponsePanel now correctly displays streaming content
  - Clear separation between streaming and completed responses

  2. Schema Integration

  - Schema browser from query tab is reused
  - Toggle button integrated into prompt panel header
  - Collapsible design saves space

  3. Error Prevention

  - SQL extraction validates query completeness
  - Auto-execution skips malformed queries
  - Better error messages for debugging

  4. Clean Component Architecture

  // AIWorkspace manages layout
  <ContextBar onOpenApiKeyModal={() => setShowApiKeyModal(true)} />
  <PromptPanel 
    onToggleSchema={() => setSchemaBrowserOpen(!schemaBrowserOpen)}
    schemaBrowserOpen={schemaBrowserOpen}
  />
  <ResponsePanel />
  <ResultsPanel height={resultsPanelHeight} />

  🚀 Setup and Configuration

  1. Dependencies

  npm install prismjs  # For SQL syntax highlighting

  2. Required Vite Proxy Configuration

  // vite.config.ts
  server: {
    proxy: {
      '/api/openai': {
        target: 'https://api.openai.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
      },
      '/api/anthropic': {
        target: 'https://api.anthropic.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      },
    },
  }

  🔧 Integration Points

  DuckDB Integration

  - Schema fetching: Real-time DESCRIBE queries
  - Pagination: Proper executePaginatedQuery usage
  - Error handling: Graceful fallbacks for schema errors

  Component Reuse

  - SchemaBrowser: Imported from query tab
  - QueryResults: Full integration with existing component
  - ModelSelector: Compact mode in prompt header
  - Button/UI components: Consistent with DataKit design

  🐛 Common Issues & Solutions

  1. Response Not Displaying

  - Issue: Streaming state not shared between components
  - Solution: Moved to Zustand store for proper state management

  2. SQL Not Executing

  - Issue: AI generates SQL with non-existent columns
  - Solution: Implemented real schema fetching and context

  3. Invalid Query Execution

  - Issue: Partial queries like "SELECT" being executed
  - Solution: Added validation before auto-execution

  4. API Key Modal Error

  - Issue: toggleApiKeyModal not defined
  - Solution: Updated to use onClose prop consistently

  📊 Performance Optimizations

  1. Streaming Performance: Direct state updates without re-renders
  2. Schema Caching: Avoid repeated DESCRIBE queries
  3. Lazy Component Loading: Results panel only renders when needed
  4. Smooth Animations: Hardware-accelerated transitions

  🎉 Summary

  The AI tab now provides a clean, modern interface for AI-powered data analysis with:

  - Intuitive three-zone layout for natural workflow
  - Real-time streaming with proper state management
  - Schema-aware SQL generation for accurate queries
  - Beautiful SQL display with syntax highlighting
  - Smooth UX with collapsible panels and animations
  - Robust error handling and validation

  The implementation successfully balances powerful features with a simple, comfortable user experience, making AI-assisted data analysis accessible and efficient.