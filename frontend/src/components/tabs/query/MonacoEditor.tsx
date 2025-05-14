import React, { useEffect, useRef } from 'react';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { format } from 'sql-formatter';

// SQL keywords for syntax highlighting and autocompletion
const SQL_KEYWORDS = [
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
const DUCKDB_FUNCTIONS = [
  'DATE_PART', 'EXTRACT', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  'STRFTIME', 'CONCAT', 'STRING_AGG', 'SUBSTRING', 'REGEXP_MATCHES',
  'COALESCE', 'NULLIF', 'IFF', 'IF', 'TYPEOF', 'LIST', 'STRUCT', 'MAP',
  'MAP_EXTRACT', 'LIST_EXTRACT', 'STRUCT_EXTRACT', 'TO_TIMESTAMP',
  'TO_DATE', 'ROUND', 'FLOOR', 'CEIL', 'GREATEST', 'LEAST', 'ABS',
  'REPLACE', 'TRANSLATE', 'TRIM', 'LTRIM', 'RTRIM', 'LOWER', 'UPPER'
];

// Common SQL snippets
const SQL_SNIPPETS = [
  {
    label: 'sel',
    detail: 'SELECT ... FROM ... WHERE ...',
    insertText: 'SELECT $1\nFROM $2\nWHERE $3;',
    insertTextRules: 4, // Explicitly use snippets
    kind: 15 // Snippet
  },
  {
    label: 'selall',
    detail: 'SELECT * FROM ...',
    insertText: 'SELECT *\nFROM $1\nWHERE $2;',
    insertTextRules: 4,
    kind: 15
  },
  {
    label: 'join',
    detail: 'SELECT ... FROM ... JOIN ... ON ...',
    insertText: 'SELECT $1\nFROM $2\nJOIN $3 ON $4;',
    insertTextRules: 4,
    kind: 15
  },
  {
    label: 'groupby',
    detail: 'SELECT ... FROM ... GROUP BY ...',
    insertText: 'SELECT $1\nFROM $2\nGROUP BY $3;',
    insertTextRules: 4,
    kind: 15
  }
];

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

const MonacoEditor: React.FC<MonacoEditorProps> = ({ 
  value, 
  onChange, 
  onExecute,
  className = '' 
}) => {
  const { getAvailableTables, executeQuery } = useDuckDBStore();
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  
  // Format SQL query
  const formatSql = () => {
    if (!editorRef.current) return;
    
    try {
      const formatted = format(editorRef.current.getValue(), {
        language: 'sql',
        keywordCase: 'upper',
        indentStyle: 'standard',
        logicalOperatorNewline: 'before',
      });
      
      editorRef.current.setValue(formatted);
    } catch (err) {
      console.error('Error formatting SQL:', err);
    }
  };
  
  // Load schema for autocompletion
  const loadSchemaData = async () => {
    if (!monaco) return;
    
    const tableNames = getAvailableTables();
    const schemaData: Record<string, string[]> = {};
    
    for (const tableName of tableNames) {
      try {
        const result = await executeQuery(`DESCRIBE "${tableName}"`);
        if (result) {
          const columns = result.toArray().map(row => 
            row.column_name || row.name || ''
          );
          schemaData[tableName] = columns;
        }
      } catch (err) {
        console.error(`Error fetching schema for ${tableName}:`, err);
      }
    }
    
    return { tables: tableNames, columns: schemaData };
  };
  
  // Configure Monaco editor on mount
  useEffect(() => {
    if (!monaco) return;
        
    // Register SQL language features
    loadSchemaData().then(schema => {
      if (!schema) return;
      
      // Register completionItemProvider
      monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: [' ', '.', '"', "'"],
        provideCompletionItems: (model, position) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });
          
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          
          // Base suggestions array
          const suggestions: any[] = [];
          
          // Add SQL keywords
          SQL_KEYWORDS.forEach(keyword => {
            suggestions.push({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              range
            });
          });
          
          // Add DuckDB functions
          DUCKDB_FUNCTIONS.forEach(func => {
            suggestions.push({
              label: func,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: func,
              range
            });
          });
          
          // Add SQL snippets
          SQL_SNIPPETS.forEach(snippet => {
            suggestions.push({
              ...snippet,
              range
            });
          });
          
          // Add table names
          schema.tables.forEach(table => {
            suggestions.push({
              label: table,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `"${table}"`,
              range,
              detail: 'Table'
            });
          });
          
          // Check if we're typing a column name after a table reference
          const tableMatch = textUntilPosition.match(/from\s+"?([a-zA-Z0-9_]+)"?\s+(?:as\s+)?([a-zA-Z0-9_]+)?.*?(?:where|$)/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            const tableAlias = tableMatch[2] || tableName;
            
            // If we're after tableName. or tableAlias., suggest columns
            const columnPrefixMatch = textUntilPosition.match(new RegExp(`${tableAlias}\\.([a-zA-Z0-9_]*)$`));
            // src/components/tabs/query/MonacoEditor.tsx (continued)

          // Check if we're typing a column name after a table reference
          const tableMatch = textUntilPosition.match(/from\s+"?([a-zA-Z0-9_]+)"?\s+(?:as\s+)?([a-zA-Z0-9_]+)?.*?(?:where|$)/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            const tableAlias = tableMatch[2] || tableName;
            
            // If we're after tableName. or tableAlias., suggest columns
            const columnPrefixMatch = textUntilPosition.match(new RegExp(`${tableAlias}\\.([a-zA-Z0-9_]*)$`));
            
            if (columnPrefixMatch || textUntilPosition.match(/SELECT\s+/i)) {
              const tableColumns = schema.columns[tableName] || [];
              
              tableColumns.forEach(column => {
                suggestions.push({
                  label: column,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: column,
                  range,
                  detail: `Column from ${tableName}`
                });
              });
            }
          }
          
          return { suggestions };
        }
      }});
      
      // Register hover provider
      monaco.languages.registerHoverProvider('sql', {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;
          
          const wordText = word.word.toLowerCase();
          
          // Check if it's a known table name
          if (schema.tables.some(t => t.toLowerCase() === wordText)) {
            const tableName = schema.tables.find(t => t.toLowerCase() === wordText);
            if (tableName) {
              const columns = schema.columns[tableName] || [];
              
              return {
                contents: [
                  { value: `**${tableName}**` },
                  { value: `Columns: ${columns.join(', ')}` }
                ]
              };
            }
          }
          
          // Check if it's a SQL keyword
          if (SQL_KEYWORDS.some(k => k.toLowerCase() === wordText)) {
            const keyword = SQL_KEYWORDS.find(k => k.toLowerCase() === wordText);
            
            const keywordDocs: Record<string, string> = {
              'select': 'Retrieves data from one or more tables',
              'from': 'Specifies the table(s) to query',
              'where': 'Filters rows based on a condition',
              'join': 'Combines rows from two or more tables',
              'group by': 'Groups rows that have the same values',
              'having': 'Filters groups based on a condition',
              'order by': 'Sorts the result set',
              'limit': 'Limits the number of rows returned'
            };
            
            return {
              contents: [
                { value: `**${keyword}**` },
                { value: keywordDocs[wordText] || 'SQL keyword' }
              ]
            };
          }
          
          // Check if it's a DuckDB function
          if (DUCKDB_FUNCTIONS.some(f => f.toLowerCase() === wordText)) {
            const func = DUCKDB_FUNCTIONS.find(f => f.toLowerCase() === wordText);
            
            return {
              contents: [
                { value: `**${func}**` },
                { value: 'DuckDB SQL function' }
              ]
            };
          }
          
          return null;
        }
      });
    });
  }, [monaco, getAvailableTables, executeQuery]);
  
  // Handle editor mount
  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    
    // Add keyboard shortcut for query execution
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      if (onExecute) onExecute();
    });
    
    // Add keyboard shortcut for SQL formatting
    editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF, () => {
      formatSql();
    });
    
    // Add context menu for formatting
    editor.addAction({
      id: 'format-sql',
      label: 'Format SQL',
      keybindings: [monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF],
      contextMenuGroupId: 'modification',
      run: formatSql
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
            preview: true,
          },
          parameterHints: {
            enabled: true,
          },
          formatOnPaste: true,
          formatOnType: false,
          lineNumbers: 'on',
          lineDecorationsWidth: 10,
          renderWhitespace: 'selection',
          bracketPairColorization: {
            enabled: true,
          },
          guides: {
            bracketPairs: true,
            indentation: true,
          }
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

export default MonacoEditor;