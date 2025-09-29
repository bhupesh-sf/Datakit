import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import {
  BarChart4,
  LineChart,
  PieChart,
  ScatterChart,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Settings,
  Copy,
  ArrowRight,
  Link2,
} from "lucide-react";

import { useAppStore } from "@/store/appStore";
import { selectHasFiles } from "@/store/selectors/appSelectors";
import { useChartsStore, ChartType } from "@/store/chartsStore";
import { Button } from "@/components/ui/Button";

import ChartCanvas from "./visualization/ChartCanvas";
import ChartConfigPanel from "./visualization/ChartConfigPanel";
import ExportModal from "./visualization/ExportModal";
import ChartGallery from "./visualization/ChartGallery";

// TODO: Postgres and motherduck should get in place later on depending on the future of this tab
//
interface DataSource {
  type: "file" | "postgresql";
  fileId: string;
  fileName: string;
  data: any[][];
  columns: string[];
  rowCount: number;
  // PostgreSQL specific fields
  postgresql?: {
    connectionId: string;
    schema: string;
    table: string;
  };
}

/**
 * Compact chart type selector
 */
const ChartTypeRow: React.FC = () => {
  const { currentChart, updateCurrentChart } = useChartsStore();

  const { t } = useTranslation();
  
  const chartTypes = [
    { type: "bar", icon: BarChart4, label: t('tabs.visualization.chartTypes.bar') },
    { type: "line", icon: LineChart, label: t('tabs.visualization.chartTypes.line') },
    { type: "area", icon: TrendingUp, label: t('tabs.visualization.chartTypes.area') },
    { type: "pie", icon: PieChart, label: t('tabs.visualization.chartTypes.pie') },
    { type: "scatter", icon: ScatterChart, label: t('tabs.visualization.chartTypes.scatter') },
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
  const { t } = useTranslation();
  const hasFiles = useAppStore(selectHasFiles);
  const { setActiveTab, activeFileId, setActiveFile, files } = useAppStore();
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
      // Only auto-select regular CSV/Excel files with data array
      let firstFileWithData = files.find(
        (file) => file.id === activeFileId && file.data && Array.isArray(file.data) && file.data.length > 1 && file.data[0]
      );
      
      // If active file doesn't have data, try to find any file with data
      if (!firstFileWithData) {
        firstFileWithData = files.find(
          (file) => file.data && Array.isArray(file.data) && file.data.length > 1 && file.data[0]
        );
      }
      
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
            {t('tabs.visualization.noDataAvailable')}
          </h3>
          <p className="text-white/70 mb-4">
            {t('tabs.visualization.importDataMessage')}
          </p>
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
            title={showLeftPanel ? t('tabs.visualization.hidePanel') : t('tabs.visualization.showPanel')}
          >
            {showLeftPanel ? (
              <ChevronLeft className="w-4 h-4 text-white/70" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/70" />
            )}
          </button>

          {/* Data source selection */}
          {/* // TODO: Do we need this? */}
          {/*  */}
          {/* <DataSourceDropdown
            selectedSource={selectedDataSource}
            onSourceChange={(file) => {
              setSelectedDataSource(file);
              setActiveFile(file.fileId);
            }}
          /> */}

          {/* Chart type selection */}
          <ChartTypeRow />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {hasVisualizationData && (
            <>
              <span className="text-xs text-white/50">
                {t('tabs.visualization.pointsCount', { count: filteredData?.length })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExportModal(true)}
              >
                <Copy className="w-4 h-4 mr-1" />
                {t('tabs.visualization.export')}
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
                  {t('tabs.visualization.chartConfiguration')}
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
                <p className="text-white/70">{t('tabs.visualization.selectDataSource')}</p>
              </div>
            </div>
          ) : !hasVisualizationData ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BarChart4 className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/70">{t('tabs.visualization.selectColumns')}</p>
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
