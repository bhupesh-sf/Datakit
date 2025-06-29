import React, { useState } from "react";
import { 
  Copy, 
  Download, 
  Play, 
  Clock, 
  DollarSign, 
  CheckCircle,
  AlertTriangle,
  Code,
  BarChart,
  FileText,
  Sparkles,
  Bot,
  Eye
} from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { useAIOperations } from "@/hooks/ai/useAIOperations";
import { useDuckDBStore } from "@/store/duckDBStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import QueryResults from "@/components/tabs/query/query-results/QueryResults";

interface ResultsPanelProps {
  isFullscreen?: boolean;
}

// Mock data for demonstration
const MOCK_RESPONSE = {
  id: "1",
  prompt: "Show me the top 5 customers by revenue",
  response: `Based on your data analysis, here are the top 5 customers by revenue:

## Analysis Results

Looking at your customer data, I found some interesting patterns:

1. **Enterprise Corp** - $156,420 total revenue
   - Highest volume customer with consistent monthly orders
   - Primary product category: Enterprise software

2. **Tech Solutions Inc** - $142,890 total revenue  
   - Strong growth trend over the past 6 months
   - Focus on cloud services and consulting

3. **Global Industries** - $128,340 total revenue
   - Long-term customer with steady purchasing pattern
   - Diverse product portfolio

4. **Innovation Labs** - $115,670 total revenue
   - Recent customer but high-value transactions
   - Potential for expansion

5. **Digital Dynamics** - $98,520 total revenue
   - Seasonal purchasing patterns
   - Strong Q4 performance

## SQL Query Generated

\`\`\`sql
SELECT 
  customer_name,
  SUM(revenue) as total_revenue,
  COUNT(*) as order_count,
  AVG(revenue) as avg_order_value
FROM sales_data 
GROUP BY customer_name 
ORDER BY total_revenue DESC 
LIMIT 5;
\`\`\`

## Key Insights

- Top 5 customers represent 45% of total revenue
- Enterprise customers show higher order values
- Strong correlation between order frequency and total revenue
- Opportunity to upsell to mid-tier customers

Would you like me to generate a visualization of this data or analyze any specific customer segment in more detail?`,
  generatedSQL: `SELECT 
  customer_name,
  SUM(revenue) as total_revenue,
  COUNT(*) as order_count,
  AVG(revenue) as avg_order_value
FROM sales_data 
GROUP BY customer_name 
ORDER BY total_revenue DESC 
LIMIT 5;`,
  model: "claude-3-opus-20240229",
  provider: "anthropic" as const,
  timestamp: new Date(),
  executionTime: 2840,
  tokens: { input: 145, output: 425 },
  cost: 0.0089
};

const ResultsPanel: React.FC<ResultsPanelProps> = ({ isFullscreen = false }) => {
  const [activeTab, setActiveTab] = useState<'response' | 'sql' | 'results'>('response');
  const [isCopied, setIsCopied] = useState(false);
  const [queryResults, setQueryResults] = useState<{
    data: any[] | null;
    columns: string[] | null;
    isLoading: boolean;
    error: string | null;
    totalRows: number;
    currentPage: number;
    totalPages: number;
    rowsPerPage: number;
  }>({
    data: null,
    columns: null,
    isLoading: false,
    error: null,
    totalRows: 0,
    currentPage: 1,
    totalPages: 0,
    rowsPerPage: 100,
  });
  
  const { 
    queryHistory, 
    isProcessing,
    activeProvider,
    activeModel 
  } = useAIStore();

  const {
    currentResponse,
    streamingResponse,
    executeGeneratedSQL,
    previewSQL,
    validateSQL,
    extractSQLQueries,
  } = useAIOperations();

  const { executeQuery, executePaginatedQuery } = useDuckDBStore();

  // Get the latest query response - use streaming/current response if available, otherwise latest from history
  const latestResponse = streamingResponse || currentResponse 
    ? {
        id: 'current',
        prompt: 'Current query',
        response: streamingResponse || currentResponse,
        generatedSQL: extractSQLQueries(streamingResponse || currentResponse)[0] || null,
        model: activeModel || 'unknown',
        provider: activeProvider,
        timestamp: new Date(),
      }
    : queryHistory.length > 0 
      ? {
          ...queryHistory[0],
          generatedSQL: queryHistory[0].generatedSQL || extractSQLQueries(queryHistory[0].response || '')[0] || null
        }
      : null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleRunSQL = async () => {
    if (!latestResponse?.response) return;
    
    const queries = extractSQLQueries(latestResponse.response);
    if (queries.length === 0) return;
    
    // Run the first query by default
    await handleRunSpecificSQL(queries[0]);
  };

  const handleRunSpecificSQL = async (sql: string) => {
    setQueryResults(prev => ({ ...prev, isLoading: true, error: null }));
    setActiveTab('results'); // Switch to results tab
    
    try {
      const result = await executePaginatedQuery(sql, 1, 100);
      
      if (result.success && result.data) {
        // Extract columns from the first row if available
        const columns = result.data.length > 0 ? Object.keys(result.data[0]) : [];
        const totalRows = result.totalRows || result.data.length;
        const totalPages = Math.ceil(totalRows / queryResults.rowsPerPage);
        
        setQueryResults({
          data: result.data,
          columns,
          totalRows,
          totalPages,
          currentPage: 1,
          rowsPerPage: queryResults.rowsPerPage,
          isLoading: false,
          error: null,
        });
      } else {
        setQueryResults({
          data: null,
          columns: null,
          totalRows: 0,
          totalPages: 0,
          currentPage: 1,
          rowsPerPage: queryResults.rowsPerPage,
          isLoading: false,
          error: result.error || 'Query execution failed',
        });
      }
    } catch (error) {
      console.error('Failed to execute SQL:', error);
      setQueryResults({
        data: null,
        columns: null,
        totalRows: 0,
        totalPages: 0,
        currentPage: 1,
        rowsPerPage: queryResults.rowsPerPage,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handlePreviewSQL = async () => {
    if (latestResponse?.generatedSQL) {
      try {
        const result = await previewSQL(latestResponse.generatedSQL);
        if (result.success) {
          console.log('SQL preview generated:', result.message);
          // TODO: Show preview in modal or expand results
        } else {
          console.error('SQL preview failed:', result.message);
          // TODO: Show error toast
        }
      } catch (error) {
        console.error('Failed to preview SQL:', error);
      }
    }
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Exporting results');
  };

  const EmptyState = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-heading font-medium text-white mb-2">
          AI Assistant Ready
        </h3>
        <p className="text-white/70 mb-4">
          Ask a question about your data to see AI-generated insights, SQL queries, and analysis.
        </p>
        <div className="text-sm text-white/50 space-y-1">
          <div>• Natural language to SQL conversion</div>
          <div>• Data insights and patterns</div>
          <div>• Automated analysis and recommendations</div>
        </div>
      </div>
    </div>
  );

  const LoadingState = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center p-8">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>
        <h3 className="text-lg font-heading font-medium text-white mb-2">
          AI Thinking...
        </h3>
        <p className="text-white/70">
          Analyzing your data and generating insights
        </p>
        <div className="mt-4 flex justify-center">
          <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isProcessing) {
    return <LoadingState />;
  }

  if (!latestResponse) {
    return <EmptyState />;
  }

  const tabs = [
    { id: 'response', label: 'AI Response', icon: <Bot className="h-4 w-4" /> },
    { id: 'sql', label: 'Generated SQL', icon: <Code className="h-4 w-4" /> },
    { id: 'results', label: 'Query Results', icon: <BarChart className="h-4 w-4" /> },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Response Header */}
      <div className="p-3 bg-darkNav border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">
                {latestResponse.model}
              </div>
              <div className="text-xs text-white/60">
                {latestResponse.provider.charAt(0).toUpperCase() + latestResponse.provider.slice(1)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {latestResponse.executionTime && (
              <div className="flex items-center text-xs text-white/60">
                <Clock size={12} className="mr-1" />
                <span>{latestResponse.executionTime}ms</span>
              </div>
            )}
            
            {latestResponse.cost && (
              <div className="flex items-center text-xs text-white/60">
                <DollarSign size={12} className="mr-1" />
                <span>${latestResponse.cost.toFixed(4)}</span>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(latestResponse.response || '')}
              className="h-7"
            >
              {isCopied ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="h-7"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'response' && (
          <div className="p-4">
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                {latestResponse.response}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sql' && latestResponse?.response && (
          <div className="p-4">
            {(() => {
              const allQueries = extractSQLQueries(latestResponse.response);
              
              if (allQueries.length === 0) {
                return (
                  <div className="text-center py-8 text-white/60">
                    <Code className="h-8 w-8 mx-auto mb-2" />
                    <p>No SQL queries found in this response</p>
                  </div>
                );
              }
              
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-white">
                      Generated SQL {allQueries.length > 1 ? `Queries (${allQueries.length})` : 'Query'}
                    </h4>
                    {allQueries.length > 1 && (
                      <div className="text-xs text-white/60">
                        Multiple queries detected. Run them individually below.
                      </div>
                    )}
                  </div>
                  
                  {allQueries.map((query, index) => (
                    <div key={index} className="border border-white/10 rounded-lg">
                      <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/10">
                        <div className="text-sm font-medium text-white">
                          Query {index + 1}
                          {allQueries.length > 1 && index === 0 && (
                            <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(query)}
                            className="h-7"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleRunSpecificSQL(query)}
                            className="h-7"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Run
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-black/30">
                        <pre className="text-sm text-white/90 overflow-x-auto">
                          <code>{query}</code>
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="h-full">
            <QueryResults
              results={queryResults.data}
              columns={queryResults.columns}
              isLoading={queryResults.isLoading}
              error={queryResults.error}
              totalRows={queryResults.totalRows}
              currentPage={queryResults.currentPage}
              totalPages={queryResults.totalPages}
              rowsPerPage={queryResults.rowsPerPage}
              onPageChange={(page) => setQueryResults(prev => ({ ...prev, currentPage: page }))}
              onRowsPerPageChange={(rowsPerPage) => setQueryResults(prev => ({ ...prev, rowsPerPage }))}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPanel;