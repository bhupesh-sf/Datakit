// src/components/tabs/QueryTab.tsx
import React, { useState, useEffect } from "react";
import { CodeEditor } from "@/components/common/CodeEditor";
import { QueryResults } from "@/components/common/query/QueryResults";
import { useDuckDBStore } from "@/store/duckDBStore";
import { useAppStore } from "@/store/appStore";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/Button";

const QueryTab: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [queryResults, setQueryResults] = useState<unknown[] | null>(null);
  const [resultColumns, setResultColumns] = useState<string[] | null>(null);
  
  // Get tableName from app store
  const { tableName } = useAppStore();
  
  const { 
    isLoading, 
    error, 
    executeQuery,
  } = useDuckDBStore();

  // Initial query based on table name
  useEffect(() => {
    if (tableName) {
      setQuery(`SELECT *\nFROM "${tableName}"\nLIMIT 10;`);
    }
  }, [tableName]);

  const handleRunQuery = async () => {
    if (!query.trim()) return;
    
    const result = await executeQuery(query);
    
    if (result) {
      setQueryResults(result.toArray());
      setResultColumns(result.schema.fields.map(f => f.name));
    } else {
      setQueryResults(null);
      setResultColumns(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">SQL Query</h3>
        <Button
          variant="primary"
          size="sm"
          onClick={handleRunQuery}
          disabled={isLoading}
        >
          <Play size={14} className="mr-1" />
          <span>Run Query</span>
        </Button>
      </div>
      
      <div className="mb-4">
        <CodeEditor
          value={query}
          onChange={setQuery}
        />
      </div>
      
      <div className="flex-1 overflow-auto">
        <h3 className="text-sm font-medium mb-3">Results</h3>
        <QueryResults
          results={queryResults}
          columns={resultColumns}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
};

export default QueryTab;