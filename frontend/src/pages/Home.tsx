import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";

import CSVGrid from "@/components/data-grid/CSVGrid";
import JSONGrid from "@/components/data-grid/JSONGrid";
import { QueryButton } from "@/components/common/query/QueryButton";
import { QueryPanel } from "@/components/common/query/QueryPanel";

import { ColumnType } from "@/types/csv";
import { DataSourceType, DataParseResult, JsonSchema } from "@/types/json";
import { DataLoadWithDuckDBResult } from "@/components/layout/Sidebar";

/**
 * Statistics about the loaded dataset
 */
interface DataStats {
  /** Total number of rows in the dataset */
  rows: number;
  /** Total number of columns in the dataset */
  columns: number;
  /** Whether the data is loaded into DuckDB for querying */
  inDuckDB?: boolean;
  /** Name of the DuckDB table (if loaded) */
  tableName?: string;
}

/**
 * Main application home page component
 * Manages the display of data grids and query interfaces
 */
const Home = () => {
  // State for grid data display
  const [data, setData] = useState<string[][]>();
  const [columnTypes, setColumnTypes] = useState<ColumnType[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [sourceType, setSourceType] = useState<DataSourceType>(
    DataSourceType.CSV
  );
  const [rawData, setRawData] = useState<any>(null);
  const [jsonSchema, setJsonSchema] = useState<JsonSchema | null>(null);
  const [stats, setStats] = useState<DataStats | null>(null);

  // UI state
  const [showQueryPanel, setShowQueryPanel] = useState(false);
  const [jsonViewMode, setJsonViewMode] = useState<"table" | "tree">("table");

  /**
   * Handle data load from sidebar
   * @param result - Parsed data result including DuckDB information
   */
  const handleDataLoad = (result: DataLoadWithDuckDBResult) => {
    setData(result.data);
    setColumnTypes(result.columnTypes);
    setFileName(result.fileName);
    setSourceType(result.sourceType || DataSourceType.CSV);

    // Handle JSON-specific data
    if (result.sourceType === DataSourceType.JSON) {
      setRawData(result.rawData || null);
      setJsonSchema("schema" in result ? result.schema : null);

      // If the JSON is nested, default to tree view
      if ("schema" in result && result.schema && result.schema.isNested) {
        setJsonViewMode("tree");
      }
    } else {
      // Reset JSON-specific data when loading CSV
      setRawData(null);
      setJsonSchema(null);
    }

    // Set stats including DuckDB information
    setStats({
      rows: result.rowCount,
      columns: result.columnCount,
      inDuckDB: result.loadedToDuckDB,
      tableName: result.tableName,
    });

    // If data was loaded into DuckDB, default to showing query panel
    if (result.loadedToDuckDB) {
      setShowQueryPanel(true);
    }
  };

  /**
   * Toggle the query panel visibility
   */
  const toggleQueryPanel = () => {
    setShowQueryPanel(!showQueryPanel);
  };

  /**
   * Handle DuckDB operations from the grid
   * @param operation - Type of DuckDB operation to perform
   * @param params - Optional parameters for the operation
   */
  const handleDuckDBOperation = (
    operation: "query" | "export",
    params?: any
  ) => {
    switch (operation) {
      case "query":
        setShowQueryPanel(true);
        break;
      case "export":
        // Handle export operation
        console.log("Export operation requested", params);
        break;
    }
  };

  /**
   * Get status text for the current dataset
   */
  const getStatusText = () => {
    if (!data) {
      return "Upload a CSV, XSLX or JSON file to get started.";
    }

    const baseText = `${stats?.rows.toLocaleString()} rows × ${stats?.columns.toLocaleString()} columns | ${
      sourceType === DataSourceType.JSON ? "JSON data" : "CSV data"
    }`;

    const duckDBText = stats?.inDuckDB
      ? ` | Loaded in DuckDB (table: ${stats.tableName})`
      : "";

    const interactionText =
      sourceType === DataSourceType.CSV || jsonViewMode === "table"
        ? " | Use SQL queries for analysis."
        : " | Explore the JSON structure.";

    return baseText + duckDBText + interactionText;
  };

  return (
    <MainLayout onDataLoad={handleDataLoad}>
      <div className="p-6 h-full flex flex-col bg-background">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-heading font-semibold">
              {fileName ? `Viewing: ${fileName}` : "Playground"}
            </h2>
            <p className="text-white text-opacity-70 text-sm">
              {getStatusText()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* JSON View Mode Toggle (only show for JSON data) */}
            {sourceType === DataSourceType.JSON && jsonSchema?.isNested && (
              <div className="border border-white border-opacity-20 rounded overflow-hidden">
                <button
                  className={`px-3 py-1 text-xs ${
                    jsonViewMode === "table"
                      ? "bg-primary text-white"
                      : "text-white text-opacity-70"
                  }`}
                  onClick={() => setJsonViewMode("table")}
                >
                  Table
                </button>
                <button
                  className={`px-3 py-1 text-xs ${
                    jsonViewMode === "tree"
                      ? "bg-primary text-white"
                      : "text-white text-opacity-70"
                  }`}
                  onClick={() => setJsonViewMode("tree")}
                >
                  Tree
                </button>
              </div>
            )}

            {/* Query Panel Button */}

            <QueryButton onClick={toggleQueryPanel} isActive={showQueryPanel} />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex relative">
          {/* Main grid with conditional padding when panel is open */}
          <div
            className={`flex-1 overflow-hidden ${showQueryPanel ? "mr-4" : ""}`}
          >
            {sourceType === DataSourceType.JSON ? (
              <JSONGrid
                data={data}
                columnTypes={columnTypes}
                rawData={rawData}
                schema={jsonSchema || undefined}
                viewMode={jsonViewMode}
              />
            ) : (
              <CSVGrid
                data={data}
                columnTypes={columnTypes}
                onDuckDBOperation={handleDuckDBOperation}
              />
            )}
          </div>

          {/* Query panel - always render but control visibility with classes */}
          <div className="absolute right-0 top-0 h-full overflow-hidden">
            <QueryPanel
              data={data || []}
              headers={data?.[0] || []}
              fileName={fileName}
              sourceType={sourceType}
              rawData={rawData}
              tableName={stats?.tableName}
              onClose={() => setShowQueryPanel(false)}
              isVisible={showQueryPanel}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;
