import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart4,
  LineChart,
  PieChart,
  ScatterChart,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  FileText,
  Settings,
  Copy,
  ArrowRight,
} from "lucide-react";

import { useAppStore } from "@/store/appStore";
import { selectHasFiles } from "@/store/selectors/appSelectors";
import { useChartsStore, ChartType } from "@/store/chartsStore";
import { Button } from "@/components/ui/Button";

import ChartCanvas from "./visualization/ChartCanvas";
import ChartConfigPanel from "./visualization/ChartConfigPanel";
import ExportModal from "./visualization/ExportModal";
import ChartGallery from "./visualization/ChartGallery";

interface DataSource {
  type: "file";
  fileId: string;
  fileName: string;
  data: any[][];
  columns: string[];
  rowCount: number;
}

/**
 * Minimal compact dropdown for data source selection
 */
const DataSourceDropdown: React.FC<{
  selectedSource: DataSource | null;
  onSourceChange: (source: DataSource) => void;
}> = ({ selectedSource, onSourceChange }) => {
  const { files } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  const dataSources = useMemo(() => {
    return files
      .filter((file) => file.data && file.data.length > 1)
      .map((file) => ({
        type: "file" as const,
        fileId: file.id,
        fileName: file.fileName,
        data: file.data,
        columns: file.data[0],
        rowCount: file.data.length - 1,
      }));
  }, [files]);

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1.5 bg-darkNav border border-white/10 rounded text-sm hover:bg-white/5 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FileText className="w-4 h-4 text-white/70" />
        <span className="text-white/90 truncate">
          {selectedSource ? selectedSource.fileName : "Select file"}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-white/50 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-black border border-white/10 rounded shadow-lg z-50 min-w-48">
          {dataSources.map((source) => (
            <button
              key={source.fileId}
              className="w-full px-3 py-2 text-left text-sm text-white/80 hover:text-white flex items-center gap-2 cursor-pointer"
              onClick={() => {
                onSourceChange(source);
                setIsOpen(false);
              }}
            >
              <FileText className="w-3 h-3 text-white/50" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{source.fileName}</div>
                <div className="text-xs text-white/50">
                  {source.rowCount} rows
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Compact chart type selector
 */
const ChartTypeRow: React.FC = () => {
  const { currentChart, updateCurrentChart } = useChartsStore();

  const chartTypes = [
    { type: "bar", icon: BarChart4, label: "Bar" },
    { type: "line", icon: LineChart, label: "Line" },
    { type: "area", icon: TrendingUp, label: "Area" },
    { type: "pie", icon: PieChart, label: "Pie" },
    { type: "scatter", icon: ScatterChart, label: "Scatter" },
  ];

  if (!currentChart) return null;

  return (
    <div className="flex gap-1">
      {chartTypes.map(({ type, icon: Icon, label }) => {
        const isActive = currentChart.type === type;

        return (
          <button
            key={type}
            className={`p-2 rounded border transition-colors cursor-pointer ${
              isActive
                ? "bg-primary/20 border-primary/30 text-primary"
                : "border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
            }`}
            onClick={() => updateCurrentChart({ type: type as ChartType })}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};

/**
 * Main visualization component - clean and minimal
 */
const VisualizationTab: React.FC = () => {
  const hasFiles = useAppStore(selectHasFiles);
  const { setActiveTab, files } = useAppStore();
  const {
    currentChart,
    createNewChart,
    loadChartsFromStorage,
    toggleExportModal,
  } = useChartsStore();

  const [selectedDataSource, setSelectedDataSource] =
    useState<DataSource | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<any[] | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);

  // Load saved charts on mount
  useEffect(() => {
    loadChartsFromStorage();
  }, [loadChartsFromStorage]);

  // Auto-select first file
  useEffect(() => {
    if (!selectedDataSource && files.length > 0) {
      const firstFileWithData = files.find(
        (file) => file.data && file.data.length > 1
      );
      if (firstFileWithData) {
        const source: DataSource = {
          type: "file",
          fileId: firstFileWithData.id,
          fileName: firstFileWithData.fileName,
          data: firstFileWithData.data,
          columns: firstFileWithData.data[0],
          rowCount: firstFileWithData.data.length - 1,
        };
        setSelectedDataSource(source);
        setSelectedColumns(source.columns.slice(0, 2));
      }
    }
  }, [files, selectedDataSource]);

  // Process data when source/columns change
  useEffect(() => {
    if (selectedDataSource?.data && selectedColumns.length > 0) {
      const headers = selectedDataSource.data[0];
      const rows = selectedDataSource.data.slice(1);

      const columnIndices = selectedColumns
        .map((col) => headers.indexOf(col))
        .filter((idx) => idx !== -1);

      const formattedData = rows.map((row) => {
        const obj: Record<string, any> = {};
        selectedColumns.forEach((column, index) => {
          const colIndex = columnIndices[index];
          if (colIndex !== -1) {
            const value = row[colIndex];
            obj[column] = isNaN(Number(value)) ? value : Number(value);
          }
        });
        return obj;
      });

      setFilteredData(formattedData);

      if (formattedData.length > 0 && !currentChart) {
        createNewChart("bar", formattedData);
      }
    } else {
      setFilteredData(null);
    }
  }, [selectedDataSource, selectedColumns, createNewChart, currentChart]);

  const hasVisualizationData = filteredData && filteredData.length > 0;

  // No files state
  if (!hasFiles) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <BarChart4 className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Data Available
          </h3>
          <p className="text-white/70 mb-4">
            Import data files to create visualizations.
          </p>
          <Button variant="outline" onClick={() => setActiveTab("preview")}>
            Import Data
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* CSS for chart styling */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .csv-grid-cell {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .csv-grid-header {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .csv-tooltip {
            background-color: color-mix(in srgb, var(--background) 90%, var(--primary) 10%);
            border: 1px solid var(--primary);
            border-radius: var(--radius);
            padding: 0.5rem;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            font-size: 0.75rem;
            max-width: 20rem;
            max-height: 15rem;
            overflow: auto;
            z-index: 9999;
          }
        `,
        }}
      />

      {/* Minimal Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-darkNav">
        <div className="flex items-center gap-4">
          {/* Left panel toggle */}
          <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className="p-1 hover:bg-white/10 rounded cursor-pointer"
            title={showLeftPanel ? "Hide panel" : "Show panel"}
          >
            {showLeftPanel ? (
              <ChevronLeft className="w-4 h-4 text-white/70" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/70" />
            )}
          </button>

          {/* Data source selection */}
          <DataSourceDropdown
            selectedSource={selectedDataSource}
            onSourceChange={setSelectedDataSource}
          />

          {/* Chart type selection */}
          <ChartTypeRow />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {hasVisualizationData && (
            <>
              <span className="text-xs text-white/50">
                {filteredData?.length} points
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExportModal(true)}
              >
                <Copy className="w-4 h-4 mr-1" />
                Export
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Collapsible Left Panel */}
        {showLeftPanel && (
          <div className="w-72 border-r border-white/10 bg-darkNav/50 overflow-hidden flex flex-col">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-white">
                  Chart Configuration
                </span>
              </div>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              <ChartConfigPanel selectedDataSource={selectedDataSource} />
            </div>
          </div>
        )}

        {/* Chart Canvas - Maximum Space */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedDataSource ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Database className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/70">Select a data source to begin</p>
              </div>
            </div>
          ) : !hasVisualizationData ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BarChart4 className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/70">Select columns to visualize</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4">
              <ChartCanvas />
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal />
    </div>
  );
};

export default VisualizationTab;
