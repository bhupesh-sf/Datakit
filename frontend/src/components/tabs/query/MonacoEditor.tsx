// src/components/tabs/query/MonacoEditor.tsx
import React, { useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useDuckDBStore } from '@/store/duckDBStore';

// Define props for the Monaco editor component
interface MonacoEditorProps {
  /** Current SQL query value */
  value: string;
  /** Callback when the query changes */
  onChange: (value: string) => void;
  /** Callback to execute the query */
  onExecute?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Enhanced SQL editor component using Monaco Editor
 */
const MonacoEditor: React.FC<MonacoEditorProps> = ({ 
  value, 
  onChange, 
  onExecute,
  className = '' 
}) => {
  const { getAvailableTables } = useDuckDBStore();
  
  // Handle editor mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Add keyboard shortcut for query execution
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onExecute) onExecute();
    });
    
    // Configure SQL language for autocompletion
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };
        
        // Get table names for autocompletion
        const tables = getAvailableTables();
        
        // SQL keywords for autocompletion
        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING',
          'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
          'OUTER JOIN', 'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE',
          'IS NULL', 'IS NOT NULL', 'AS', 'UNION', 'ALL', 'DISTINCT',
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'CASE', 'WHEN',
          'THEN', 'ELSE', 'END', 'BETWEEN', 'EXISTS', 'INSERT', 'INTO',
          'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'VIEW',
          'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX', 'PRIMARY KEY',
          'FOREIGN KEY', 'REFERENCES', 'DEFAULT', 'NULL', 'NOT NULL',
          'WITH', 'RECURSIVE', 'USING'
        ];
        
        // DuckDB specific functions
        const functions = [
          'DATE_PART', 'EXTRACT', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
          'STRFTIME', 'CONCAT', 'STRING_AGG', 'SUBSTRING', 'REGEXP_MATCHES',
          'COALESCE', 'NULLIF', 'IFF', 'IF', 'TYPEOF', 'LIST', 'STRUCT', 'MAP',
          'MAP_EXTRACT', 'LIST_EXTRACT', 'STRUCT_EXTRACT'
        ];
        
        // Create completion suggestions
        const suggestions = [
          ...keywords.map(keyword => ({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range
          })),
          ...functions.map(func => ({
            label: func,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: func,
            range
          })),
          ...tables.map(table => ({
            label: table,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: `"${table}"`,
            range
          }))
        ];
        
        return { suggestions };
      }
    });
  };
  
  return (
    <div className={`h-full ${className}`}>
      <Editor
        height="100%"
        defaultLanguage="sql"
        defaultValue={value}
        value={value}
        onChange={(value) => onChange(value || '')}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          automaticLayout: true,
          tabSize: 2,
          fontSize: 14,
          fontFamily: 'JetBrains Mono, monospace',
          insertSpaces: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          glyphMargin: false,
          folding: true,
          contextmenu: true,
          quickSuggestions: true,
          suggest: {
            showKeywords: true,
            showSnippets: true,
          }
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

export default MonacoEditor;