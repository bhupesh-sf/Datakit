import { useState, useCallback, useEffect } from "react";
import { useAIStore } from "@/store/aiStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import { useAppStore } from "@/store/appStore";
import { selectTableName, selectActiveFileInfo } from "@/store/selectors/appSelectors";
import { useAIQueryExecution } from "./useAIQueryExecution";
import { aiService } from "@/lib/ai/aiService";
import { AIQuery, QueryIntent } from "@/types/ai";

export const useAIOperations = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  
  const {
    activeProvider,
    activeModel,
    apiKeys,
    autoExecuteSQL,
    setProcessing,
    addQueryToHistory,
    currentResponse,
    streamingResponse,
    setCurrentResponse,
    setStreamingResponse,
    setCurrentTokenUsage,
  } = useAIStore();

  const { executeQuery, executePaginatedQuery } = useDuckDBStore();
  const { executeAIGeneratedSQL, previewSQL, validateSQL } = useAIQueryExecution();
  const tableName = useAppStore(selectTableName);
  const activeFileInfo = useAppStore(selectActiveFileInfo);

  // Initialize AI service with API keys
  useEffect(() => {
    for (const [provider, key] of apiKeys) {
      if (key) {
        aiService.setApiKey(provider, key, activeModel || undefined);
      }
    }
  }, [apiKeys, activeModel]);

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
    const context = await getDataContext();
    if (!context) {
      throw new Error('No data context available');
    }

    if (!aiService.isProviderReady(activeProvider)) {
      throw new Error(`AI provider ${activeProvider} not configured`);
    }

    return await aiService.generateSQL(activeProvider, prompt, context);
  }, [activeProvider, getDataContext]);

  const analyzeData = useCallback(async (prompt: string, data?: any[]) => {
    const context = await getDataContext();
    if (!context) {
      throw new Error('No data context available');
    }

    if (!aiService.isProviderReady(activeProvider)) {
      throw new Error(`AI provider ${activeProvider} not configured`);
    }

    return await aiService.analyzeData(activeProvider, prompt, context, data);
  }, [activeProvider, getDataContext]);

  const executeAIQuery = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      throw new Error('Prompt cannot be empty');
    }

    setIsExecuting(true);
    setProcessing(true);
    setCurrentResponse(null);
    setStreamingResponse("");

    const startTime = Date.now();
    
    try {
      const intent = detectIntent(prompt);
      let response = "";
      let generatedSQL: string | undefined;
      let usage: { promptTokens: number; completionTokens: number } | undefined;

      if (intent.type === 'query' || intent.type === 'visualization') {
        // Generate SQL for data queries and visualizations
        const sqlResult = await generateSQL(prompt);
        generatedSQL = sqlResult.sql;
        
        // Create a comprehensive response
        response = `Based on your request, I've generated the following SQL query:

\`\`\`sql
${sqlResult.sql}
\`\`\`

${sqlResult.explanation || ''}

${sqlResult.warnings && sqlResult.warnings.length > 0 ? 
  `**Warnings:**\n${sqlResult.warnings.map(w => `- ${w}`).join('\n')}` : 
  ''
}`;

      } else if (intent.type === 'analysis') {
        // For analysis requests, we might need to get data first
        const analysisResult = await analyzeData(prompt);
        response = analysisResult.analysis;
        
        if (analysisResult.suggestions && analysisResult.suggestions.length > 0) {
          response += `\n\n**Suggestions:**\n${analysisResult.suggestions.map(s => `- ${s}`).join('\n')}`;
        }
      }

      const executionTime = Date.now() - startTime;
      const cost = usage ? aiService.calculateCost(activeProvider, usage) : 0;

      // Create query record
      const query: AIQuery = {
        id: Date.now().toString(),
        prompt,
        model: activeModel || 'unknown',
        provider: activeProvider,
        response,
        generatedSQL,
        timestamp: new Date(),
        executionTime,
        tokens: usage,
        cost,
      };

      // Add to history
      addQueryToHistory(query);
      setCurrentResponse(response);
      
      return query;

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
      throw error;
      
    } finally {
      setIsExecuting(false);
      setProcessing(false);
    }
  }, [
    activeProvider,
    activeModel,
    detectIntent,
    generateSQL,
    analyzeData,
    addQueryToHistory,
    setProcessing,
  ]);

  const executeAIQueryStream = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      throw new Error('Prompt cannot be empty');
    }

    setIsExecuting(true);
    setProcessing(true);
    setStreamingResponse("");
    setCurrentTokenUsage(null);

    const startTime = Date.now();
    
    try {
      const context = await getDataContext();
      if (!context) {
        throw new Error('No data context available');
      }

      const messages = [
        {
          role: 'system' as const,
          content: `You are a SQL expert helping users query their data using DuckDB syntax. 
          
          Table: ${context.tableName}
          Schema: ${context.schema.map(col => `${col.name} (${col.type})`).join(', ')}
          
          IMPORTANT: Only use the column names listed in the schema above. Do not assume any other columns exist.
          
          Provide helpful, accurate responses with SQL queries when appropriate.`,
        },
        {
          role: 'user' as const,
          content: prompt,
        },
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
            
            // Auto-execute SQL if enabled
            autoExecuteSQLQueries(fullResponse);
          }
        },
        { temperature: 0.1, maxTokens: 2000 }
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
      throw error;
      
    } finally {
      setIsExecuting(false);
      setProcessing(false);
    }
  }, [
    activeProvider,
    activeModel,
    getDataContext,
    addQueryToHistory,
    setProcessing,
  ]);

  const executeGeneratedSQL = useCallback(async (sql: string, switchToQueryTab = true) => {
    return await executeAIGeneratedSQL(sql, switchToQueryTab);
  }, [executeAIGeneratedSQL]);

  const canExecute = useCallback(() => {
    if (!activeProvider || !activeModel) {
      return false;
    }
    
    if (activeProvider === 'local') {
      // For local provider, check if model is actually loaded
      return aiService.isLocalModelLoaded();
    }
    
    // For cloud providers, check if API key is available
    return apiKeys.has(activeProvider) && !!apiKeys.get(activeProvider);
  }, [activeProvider, apiKeys, activeModel]);

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

  // Auto-execute SQL queries if setting is enabled
  const autoExecuteSQLQueries = useCallback(async (response: string) => {
    if (!autoExecuteSQL) return;
    
    const queries = extractSQLQueries(response);
    if (queries.length === 0) return;
    
    // Auto-execute the first query
    const firstQuery = queries[0];
    
    // Validate the query before executing
    if (firstQuery && firstQuery.length > 20 && !firstQuery.endsWith('SELECT')) {
      console.log('[Auto-execute] Running query:', firstQuery.substring(0, 50) + '...');
      await handleRunSQL(firstQuery);
    } else {
      console.log('[Auto-execute] Skipping invalid query:', firstQuery);
    }
  }, [autoExecuteSQL, extractSQLQueries, handleRunSQL]);

  return {
    // State
    isExecuting,
    currentResponse,
    streamingResponse,
    canExecute: canExecute(),
    isLoading: isExecuting,
    
    // Actions
    executeAIQuery,
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
    },
  };
};