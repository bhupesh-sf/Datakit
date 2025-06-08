import React, { useEffect, useRef, useMemo, useCallback } from "react";
import Editor, { OnMount, useMonaco } from "@monaco-editor/react";
import { useDuckDBStore } from "@/store/duckDBStore";
import { format } from "sql-formatter";

import { DUCKDB_FUNCTIONS, SQL_KEYWORDS, SQL_SNIPPETS } from './constants';

interface DatabaseObject {
  name: string;
  type: "table" | "view";
  columns: string[];
}

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
  className = "",
}) => {
  const { getAvailableTables, registeredTables, executeQuery, getObjectType, lastTableRefresh } = useDuckDBStore();
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const schemaLoadedRef = useRef<string>("");

  const schemaDependencyKey = useMemo(() => {
    const tableNames = getAvailableTables().sort().join(',');
    const registeredKeys = Array.from(registeredTables.keys()).sort().join(',');
    return `${tableNames}-${registeredKeys}-${lastTableRefresh}`;
  }, [getAvailableTables, registeredTables, lastTableRefresh]);

  const formatSql = useCallback(() => {
    if (!editorRef.current) return;

    try {
      const formatted = format(editorRef.current.getValue(), {
        language: "sql",
        keywordCase: "upper",
        indentStyle: "standard",
        logicalOperatorNewline: "before",
      });

      editorRef.current.setValue(formatted);
    } catch (err) {
      console.error("Error formatting SQL:", err);
    }
  }, []);

  const loadSchemaData = useCallback(async () => {
    if (!monaco) return null;

    try {
      console.log("[MonacoEditor] Loading schema data...");
      const objectNames = getAvailableTables();

      console.log('objectNames', objectNames);
      // Process objects in parallel for better performance
      const objectPromises = objectNames.map(async (objectName) => {
        try {
          const objectType = await getObjectType(objectName);
          console.log(
            `[MonacoEditor] Object ${objectName} detected as: ${objectType}`
          );

          const result = await executeQuery(`DESCRIBE "${objectName}"`);

          if (result && objectType) {
            const columns = result
              .toArray()
              .map((row) => row.column_name || row.name || "");

            console.log(`[MonacoEditor] Columns for ${objectName}:`, columns);

            return {
              name: objectName,
              type: objectType,
              columns,
            };
          } else {
            console.warn(
              `[MonacoEditor] Missing result or objectType for ${objectName}:`,
              { result: !!result, objectType }
            );
          }
        } catch (err) {
          console.warn(
            `[MonacoEditor] Failed to load schema for ${objectName}:`,
            err
          );
        }

        return null;
      });
      
      const results = await Promise.all(objectPromises);
      const validObjects = results.filter(
        (obj): obj is DatabaseObject => obj !== null
      );

      console.log("[MonacoEditor] Loaded schema data:", {
        total: validObjects.length,
        tables: validObjects.filter((o) => o.type === "table").length,
        views: validObjects.filter((o) => o.type === "view").length,
      });

      return { objects: validObjects };
    } catch (err) {
      console.error("[MonacoEditor] Error loading schema data:", err);
      return { objects: [] };
    }
  }, [monaco, getAvailableTables, getObjectType, executeQuery]);

  const registerLanguageProviders = useCallback((schema: { objects: DatabaseObject[] }) => {
    if (!monaco) return;

    // Dispose existing providers to prevent memory leaks
    monaco.languages.getLanguages().forEach(lang => {
      if (lang.id === 'sql') {
        // Clean up existing providers if needed
      }
    });

    // Register completionItemProvider
    const completionDisposable = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [" ", ".", '"', "'"],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Base suggestions array
        const suggestions: any[] = [];

        // Add SQL keywords
        SQL_KEYWORDS.forEach((keyword) => {
          suggestions.push({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range,
          });
        });

        // Add DuckDB functions
        DUCKDB_FUNCTIONS.forEach((func) => {
          suggestions.push({
            label: func,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: func,
            range,
          });
        });

        // Add SQL snippets
        SQL_SNIPPETS.forEach((snippet) => {
          suggestions.push({
            ...snippet,
            range,
          });
        });

        schema.objects.forEach((obj) => {
          const kind =
            obj.type === "view"
              ? monaco.languages.CompletionItemKind.Interface
              : monaco.languages.CompletionItemKind.Class;

          const detail = obj.type === "view" ? "View" : "Table";

          suggestions.push({
            label: obj.name,
            kind: kind,
            insertText: `"${obj.name}"`,
            range,
            detail: detail,
            documentation: `${detail}: ${obj.columns.join(", ")}`,
          });
        });

        // Check if we're typing a column name after a table/view reference
        const objectMatch = textUntilPosition.match(
          /from\s+"?([a-zA-Z0-9_]+)"?\s+(?:as\s+)?([a-zA-Z0-9_]+)?.*?(?:where|$)/i
        );
        if (objectMatch) {
          const objectName = objectMatch[1];
          const objectAlias = objectMatch[2] || objectName;

          // Find the database object (table or view)
          const dbObject = schema.objects.find(
            (obj) => obj.name === objectName
          );

          // If we're after objectName. or objectAlias., suggest columns
          const columnPrefixMatch = textUntilPosition.match(
            new RegExp(`${objectAlias}\\.([a-zA-Z0-9_]*)$`)
          );

          if (columnPrefixMatch || textUntilPosition.match(/SELECT\s+/i)) {
            if (dbObject) {
              dbObject.columns.forEach((column) => {
                suggestions.push({
                  label: column,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: column,
                  range,
                  detail: `Column from ${dbObject.name} (${dbObject.type})`,
                });
              });
            }
          }
        }

        return { suggestions };
      },
    });

    const hoverDisposable = monaco.languages.registerHoverProvider("sql", {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const wordText = word.word.toLowerCase();

        const dbObject = schema.objects.find(
          (obj) => obj.name.toLowerCase() === wordText
        );

        if (dbObject) {
          const typeLabel = dbObject.type === "view" ? "View" : "Table";

          return {
            contents: [
              { value: `**${dbObject.name}** (${typeLabel})` },
              { value: `Columns: ${dbObject.columns.join(", ")}` },
              {
                value: `Type: ${
                  dbObject.type.charAt(0).toUpperCase() +
                  dbObject.type.slice(1)
                }`,
              },
            ],
          };
        }

        // Check if it's a SQL keyword
        if (SQL_KEYWORDS.some((k) => k.toLowerCase() === wordText)) {
          const keyword = SQL_KEYWORDS.find(
            (k) => k.toLowerCase() === wordText
          );

          const keywordDocs: Record<string, string> = {
            select: "Retrieves data from one or more tables or views",
            from: "Specifies the table(s) or view(s) to query",
            where: "Filters rows based on a condition",
            join: "Combines rows from two or more tables or views",
            "group by": "Groups rows that have the same values",
            having: "Filters groups based on a condition",
            "order by": "Sorts the result set",
            limit: "Limits the number of rows returned",
            "create view":
              "Creates a virtual table based on a SELECT statement",
            "drop view": "Removes a view from the database",
          };

          return {
            contents: [
              { value: `**${keyword}**` },
              { value: keywordDocs[wordText] || "SQL keyword" },
            ],
          };
        }

        // Check if it's a DuckDB function
        if (DUCKDB_FUNCTIONS.some((f) => f.toLowerCase() === wordText)) {
          const func = DUCKDB_FUNCTIONS.find(
            (f) => f.toLowerCase() === wordText
          );

          return {
            contents: [
              { value: `**${func}**` },
              { value: "DuckDB SQL function" },
            ],
          };
        }

        return null;
      },
    });

    // Store disposables for cleanup if needed
    return () => {
      completionDisposable.dispose();
      hoverDisposable.dispose();
    };
  }, [monaco]);

  // Only load schema and register providers when dependencies actually change
  useEffect(() => {
    if (!monaco || schemaDependencyKey === schemaLoadedRef.current) {
      return;
    }

    schemaLoadedRef.current = schemaDependencyKey;

    loadSchemaData().then((schema) => {
      if (schema) {
        registerLanguageProviders(schema);
      }
    });
  }, [schemaDependencyKey, monaco, loadSchemaData, registerLanguageProviders]);

  // Handle editor mount
  const handleEditorDidMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor;

    // Add keyboard shortcut for query execution
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      () => {
        if (onExecute) onExecute();
      }
    );

    // Add keyboard shortcut for SQL formatting
    editor.addCommand(
      monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF,
      () => {
        formatSql();
      }
    );

    // Add context menu for formatting
    editor.addAction({
      id: "format-sql",
      label: "Format SQL",
      keybindings: [monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF],
      contextMenuGroupId: "modification",
      run: formatSql,
    });
  }, [onExecute, formatSql]);

  return (
    <div className={`h-full ${className}`}>
      <Editor
        height="100%"
        defaultLanguage="sql"
        defaultValue={value}
        value={value}
        onChange={(value) => onChange(value || "")}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          wrappingIndent: "indent",
          automaticLayout: true,
          tabSize: 2,
          fontSize: 14,
          fontFamily: "JetBrains Mono, monospace",
          insertSpaces: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderLineHighlight: "all",
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
          lineNumbers: "on",
          lineDecorationsWidth: 10,
          renderWhitespace: "selection",
          bracketPairColorization: {
            enabled: true,
          },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

export default MonacoEditor;