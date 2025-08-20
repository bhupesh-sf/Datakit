import { useState, useCallback, useEffect } from "react";
import { useAIStore } from "@/store/aiStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import { useAppStore } from "@/store/appStore";
import { selectTableName, selectActiveFileInfo } from "@/store/selectors/appSelectors";
import { useAIQueryExecution } from "./useAIQueryExecution";
import { aiService } from "@/lib/ai/aiService";
import { DataKitProvider } from "@/lib/ai/providers/datakit";
import { useAuth } from "@/hooks/auth/useAuth";
import { AIQuery, QueryIntent } from "@/types/ai";
import { createMultiTableSystemPrompt } from "@/lib/ai/prompts/sqlPrompts";

export const useAIOperations = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  
  const {
    activeProvider,
    activeModel,
    apiKeys,
    autoExecuteSQL,
    currentConversation,
    addMessageToConversation,
    setProcessing,
    addQueryToHistory,
    currentResponse,
    streamingResponse,
    setCurrentResponse,
    setStreamingResponse,
    setCurrentTokenUsage,
    setVisualizationTokenUsage,
    setCurrentError,
    multiTableContexts,
  } = useAIStore();

  const { executeQuery, executePaginatedQuery } = useDuckDBStore();
  const { executeAIGeneratedSQL, previewSQL, validateSQL } = useAIQueryExecution();
  const tableName = useAppStore(selectTableName);
  const activeFileInfo = useAppStore(selectActiveFileInfo);
  const { isAuthenticated } = useAuth();

  // Initialize AI service with API keys and DataKit provider
  useEffect(() => {
    // Set up regular API key providers
    for (const [provider, key] of apiKeys) {
      if (key && provider !== 'datakit') {
        aiService.setApiKey(provider, key, activeModel || undefined);
      }
    }
    
    // Set up DataKit provider if authenticated
    if (isAuthenticated && activeModel && (activeModel === 'datakit-smart' || activeModel === 'datakit-fast')) {
      const datakitProvider = new DataKitProvider(activeModel);
      aiService.setProvider('datakit', datakitProvider);
    }
  }, [apiKeys, activeModel, isAuthenticated]);

  const getDataContext = useCallback(async () => {
    if (!tableName || !activeFileInfo) {
      return null;
    }

    // Get actual schema from DuckDB
    try {
      const result = await executeQuery(`DESCRIBE "${tableName}"`);
      const schema = result ? result.toArray().map((row: any) => ({
        name: row.column_name || row.name || "",
        type: row.column_type || row.type || "",
      })) : [];
      
      return {
        tableName,
        schema,
        rowCount: activeFileInfo.rowCount,
        description: `${activeFileInfo.fileType} file with ${activeFileInfo.columnCount} columns`,
      };
    } catch (error) {
      console.error('Failed to get table schema:', error);
      return {
        tableName,
        schema: [],
        rowCount: activeFileInfo.rowCount,
        description: `${activeFileInfo.fileType} file with ${activeFileInfo.columnCount} columns`,
      };
    }
  }, [tableName, activeFileInfo, executeQuery]);

  const getMultiTableContext = useCallback(async () => {
    const selectedTables = multiTableContexts.filter(ctx => ctx.isSelected);
    
    if (selectedTables.length === 0) {
      return null;
    }

    // Get schemas for all selected tables
    const tablesWithSchemas = await Promise.all(
      selectedTables.map(async (table) => {
        try {
          const result = await executeQuery(`DESCRIBE "${table.tableName}"`);
          const schema = result ? result.toArray().map((row: any) => ({
            name: row.column_name || row.name || "",
            type: row.column_type || row.type || "",
          })) : table.schema;
          
          return {
            tableName: table.tableName,
            schema,
            rowCount: table.rowCount,
            description: table.description,
          };
        } catch (error) {
          console.error(`Failed to get schema for table ${table.tableName}:`, error);
          // Use cached schema if query fails
          return {
            tableName: table.tableName,
            schema: table.schema,
            rowCount: table.rowCount,
            description: table.description,
          };
        }
      })
    );

    return { tables: tablesWithSchemas };
  }, [multiTableContexts, executeQuery]);

  const detectIntent = useCallback((prompt: string): QueryIntent => {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('chart') || lowerPrompt.includes('graph') || lowerPrompt.includes('plot')) {
      return {
        type: 'visualization',
        confidence: 0.8,
        explanation: 'Request appears to be asking for a visualization',
      };
    }
    
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('pattern') || lowerPrompt.includes('insight')) {
      return {
        type: 'analysis',
        confidence: 0.9,
        explanation: 'Request appears to be asking for data analysis',
      };
    }
    
    if (lowerPrompt.includes('show') || lowerPrompt.includes('get') || lowerPrompt.includes('find')) {
      return {
        type: 'query',
        confidence: 0.7,
        explanation: 'Request appears to be asking for data retrieval',
      };
    }
    
    return {
      type: 'query',
      confidence: 0.6,
      explanation: 'Default interpretation as data query',
    };
  }, []);

  // Extract SQL queries from AI response text
  const extractSQLQueries = useCallback((response: string): string[] => {
    const queries: string[] = [];
    
    // Look for SQL code blocks (with flexible whitespace)
    const sqlBlockMatches = response.match(/```sql\s*\n([\s\S]*?)\n\s*```/gi) || 
                          response.match(/```\s*\n([\s\S]*?)\n\s*```/gi); // Also check plain code blocks
    if (sqlBlockMatches) {
      sqlBlockMatches.forEach(match => {
        const query = match.replace(/```(?:sql)?\s*\n?/gi, '').replace(/\n?\s*```/gi, '').trim();
        // Check if it looks like SQL
        if (query && query.length > 10 && /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)/i.test(query)) {
          queries.push(query);
        }
      });
    }
    
    // If no code blocks found, look for SQL-like statements
    if (queries.length === 0) {
      const lines = response.split('\n');
      let inQuery = false;
      let currentQuery: string[] = [];
      
      for (const line of lines) {
        if (/^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)/i.test(line.trim())) {
          inQuery = true;
          currentQuery = [line];
        } else if (inQuery) {
          // Continue collecting lines until we hit an empty line or a clear end marker
          if (line.trim() === '' || 
              /^This query|^The query|^This will|^The result/i.test(line.trim()) ||
              /^\d+\./.test(line.trim()) ||
              (line.trim().endsWith(';') && !line.includes('SELECT') && !line.includes('FROM'))) {
            if (currentQuery.length > 0) {
              const query = currentQuery.join('\n').trim();
              if (query.length > 10) {
                queries.push(query);
              }
            }
            inQuery = false;
            currentQuery = [];
          } else {
            currentQuery.push(line);
          }
        }
      }
      
      // Don't forget the last query if still in progress
      if (inQuery && currentQuery.length > 0) {
        const query = currentQuery.join('\n').trim();
        if (query.length > 10) {
          queries.push(query);
        }
      }
    }
    
    return queries;
  }, []);

  const generateSQL = useCallback(async (prompt: string) => {
    // For backward compatibility, use single table context for this function
    const context = await getDataContext();
    if (!context) {
      throw new Error('No data context available');
    }

    if (!aiService.isProviderReady(activeProvider)) {
      if (activeProvider === 'datakit') {
        throw new Error('Please sign in to use DataKit AI');
      }
      throw new Error(`AI provider ${activeProvider} not configured`);
    }

    return await aiService.generateSQL(activeProvider, prompt, context);
  }, [activeProvider, getDataContext]);

  const analyzeData = useCallback(async (prompt: string, data?: any[]) => {
    // For backward compatibility, use single table context for this function
    const context = await getDataContext();
    if (!context) {
      throw new Error('No data context available');
    }

    if (!aiService.isProviderReady(activeProvider)) {
      if (activeProvider === 'datakit') {
        throw new Error('Please sign in to use DataKit AI');
      }
      throw new Error(`AI provider ${activeProvider} not configured`);
    }

    return await aiService.analyzeData(activeProvider, prompt, context, data);
  }, [activeProvider, getDataContext]);

  const executeAIQueryStream = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      throw new Error('Prompt cannot be empty');
    }

    setIsExecuting(true);
    setProcessing(true);
    setStreamingResponse("");
    setCurrentTokenUsage(null);
    setVisualizationTokenUsage(null);
    setCurrentError(null);

    const startTime = Date.now();
    
    try {
      const multiContext = await getMultiTableContext();
      if (!multiContext || multiContext.tables.length === 0) {
        throw new Error('No data context available');
      }

      // Build system message with multi-table context
      const systemPrompt = createMultiTableSystemPrompt(multiContext);
      const systemMessage = {
        role: 'system' as const,
        content: systemPrompt,
      };

      // Create the new user message
      const userMessage = {
        role: 'user' as const,
        content: prompt,
      };

      // Build messages array: system + conversation history + new message
      const messages = [
        systemMessage,
        ...currentConversation,
        userMessage,
      ];

      let fullResponse = "";
      
      await aiService.generateCompletionStream(
        activeProvider,
        messages,
        (chunk) => {
          if (!chunk.done) {
            setStreamingResponse(chunk.content);
            fullResponse = chunk.content;
          } else {
            // Stream completed
            const executionTime = Date.now() - startTime;
            
            // Add messages to conversation
            addMessageToConversation(userMessage);
            addMessageToConversation({
              role: 'assistant',
              content: fullResponse,
            });
            
            const query: AIQuery = {
              id: Date.now().toString(),
              prompt,
              model: activeModel || 'unknown',
              provider: activeProvider,
              response: fullResponse,
              timestamp: new Date(),
              executionTime,
              tokens: chunk.usage,
              cost: chunk.usage ? aiService.calculateCost(activeProvider, chunk.usage) : 0,
            };

            addQueryToHistory(query);
            setCurrentResponse(fullResponse);
            setStreamingResponse(""); // Clear streaming response

            // Set current token usage
            if (chunk.usage) {
              setCurrentTokenUsage({
                input: chunk.usage.promptTokens,
                output: chunk.usage.completionTokens,
              });
            }

            // Handle DataKit metadata if present
            if (activeProvider === 'datakit' && (chunk as any)._datakit) {
              const datakitData = (chunk as any)._datakit;
              console.log('DataKit metadata:', datakitData);
              // You can add additional DataKit-specific handling here
            }
            
            // Auto-execute SQL if enabled
            if (autoExecuteSQL) {
              const queries = extractSQLQueries(fullResponse);
              if (queries.length > 0) {
                // Auto-execute the first query
                const firstQuery = queries[0];
                
                // Validate the query before executing
                if (firstQuery && firstQuery.length > 20 && !firstQuery.endsWith('SELECT')) {
                  console.log('[Auto-execute] Running query:', firstQuery.substring(0, 50) + '...');
                  handleRunSQL(firstQuery);
                } else {
                  console.log('[Auto-execute] Skipping invalid query:', firstQuery);
                }
              }
            }
          }
        },
        { temperature: 0.1, maxTokens: 8000 }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const errorQuery: AIQuery = {
        id: Date.now().toString(),
        prompt,
        model: activeModel || 'unknown',
        provider: activeProvider,
        error: errorMessage,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
      };

      addQueryToHistory(errorQuery);
      setCurrentError(errorMessage);
      throw error;
      
    } finally {
      setIsExecuting(false);
      setProcessing(false);
    }
  }, [
    activeProvider,
    activeModel,
    currentConversation,
    addMessageToConversation,
    getMultiTableContext,
    addQueryToHistory,
    setProcessing,
    setCurrentResponse,
    setStreamingResponse,
    setCurrentTokenUsage,
    setCurrentError,
    autoExecuteSQL,
    extractSQLQueries,
    executePaginatedQuery,
  ]);

  const executeGeneratedSQL = useCallback(async (sql: string, switchToQueryTab = true) => {
    return await executeAIGeneratedSQL(sql, switchToQueryTab);
  }, [executeAIGeneratedSQL]);

  const canExecute = useCallback(() => {
    if (!activeProvider || !activeModel) {
      return false;
    }
    
    if (activeProvider === 'datakit') {
      // For DataKit provider, check if user is authenticated
      return isAuthenticated;
    }
    
    if (activeProvider === 'local') {
      // For local provider, check if model is actually loaded
      return aiService.isLocalModelLoaded();
    }
    
    // For cloud providers, check if API key is available
    return apiKeys.has(activeProvider) && !!apiKeys.get(activeProvider);
  }, [activeProvider, apiKeys, activeModel, isAuthenticated]);

  // Handle running SQL from the UI
  const handleRunSQL = useCallback(async (sql: string) => {
    try {
      const result = await executePaginatedQuery(sql, 1, 100);
      
      if (result.data && result.data.length >= 0) {
        // Update the AI store with results
        const { setQueryResults } = useAIStore.getState();
        
        const columns = result.columns || (result.data.length > 0 ? Object.keys(result.data[0]) : []);
        const totalRows = result.totalRows || result.data.length;
        const totalPages = result.totalPages || Math.ceil(totalRows / 100);
        
        setQueryResults({
          data: result.data,
          columns,
          totalRows,
          totalPages,
          currentPage: result.page || 1,
          rowsPerPage: result.pageSize || 100,
          isLoading: false,
          error: null,
        });
      } else {
        const { setQueryResults } = useAIStore.getState();
        setQueryResults({
          data: null,
          columns: null,
          totalRows: 0,
          totalPages: 0,
          currentPage: 1,
          rowsPerPage: 100,
          isLoading: false,
          error: 'No data returned from query',
        });
      }
    } catch (error) {
      console.error('Failed to execute SQL:', error);
      const { setQueryResults } = useAIStore.getState();
      setQueryResults({
        data: null,
        columns: null,
        totalRows: 0,
        totalPages: 0,
        currentPage: 1,
        rowsPerPage: 100,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }, [executePaginatedQuery]);


  return {
    // State
    isExecuting,
    currentResponse,
    streamingResponse,
    canExecute: canExecute(),
    isLoading: isExecuting,
    
    // Actions
    executeAIQueryStream,
    executeGeneratedSQL,
    generateSQL,
    analyzeData,
    detectIntent,
    previewSQL,
    validateSQL,
    handleRunSQL,
    
    // Utilities
    extractSQLQueries,
    clearResponse: () => {
      setCurrentResponse(null);
      setStreamingResponse("");
      setCurrentError(null);
    },
  };
};