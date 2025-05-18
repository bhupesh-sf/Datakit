import React, { useState, useEffect } from "react";
import {
  BarChart4,
  LineChart,
  PieChart,
  ScatterChart,
  TrendingUp,
  InfoIcon,
  ArrowRight,
} from "lucide-react";

import { useAppStore } from "@/store/appStore";
import { useChartsStore, ChartType } from "@/store/chartsStore";
import { Button } from '@/components/ui/Button';

import ChartCanvas from "./visualization/ChartCanvas";
import ChartControls from "./visualization/ChartControls";
import ChartConfigPanel from "./visualization/ChartConfigPanel";
import ChartGallery from "./visualization/ChartGallery";
import SaveChartModal from "./visualization/SaveChartModal";
import ExportModal from "./visualization/ExportModal";

/**
 * Main visualization tab component that orchestrates the chart creation and visualization process
 */
const VisualizationTab: React.FC = () => {
  const { data: queryData, tableName, setActiveTab } = useAppStore();
  const {
    currentChart,
    createNewChart,
    loadChartsFromStorage
  } = useChartsStore();

  const [selectedTab, setSelectedTab] = useState<"config" | "gallery">(
    "config"
  );

  // Load saved charts on mount
  useEffect(() => {
    loadChartsFromStorage();
  }, [loadChartsFromStorage]);

  // Initialize with data from the query tab if available
  useEffect(() => {
    if (queryData && queryData.length > 0 && !currentChart) {
      // Convert the 2D array to an array of objects
      const headers = queryData[0];
      const rows = queryData.slice(1);

      const formattedData = rows.map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          // Try to convert to number if possible
          const value = row[index];
          obj[header] = isNaN(Number(value)) ? value : Number(value);
        });
        return obj;
      });

      // Create a new chart with the data
      createNewChart("bar", formattedData);
    }
  }, [queryData, currentChart, createNewChart]);

  // Check if we have visualization data
  const hasData = queryData && queryData.length > 1;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top header area - fixed height */}
      <div className="bg-darkNav py-2 px-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-heading font-semibold">
            Data Visualization
          </h2>

          {currentChart && currentChart.data && hasData && (
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-md flex items-center text-sm">
              <InfoIcon size={14} className="mr-2 text-blue-400 flex-shrink-0" />
              <div>
                <span className="font-medium">{currentChart.data.length}</span>{" "}
                data points shown
              </div>
            </div>
          )}
        </div>

        <div className="flex border-b border-white/10 mt-2">
          <button
            className={`px-4 py-1.5 text-sm ${
              selectedTab === "config"
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-white/70 hover:text-white/90"
            }`}
            onClick={() => setSelectedTab("config")}
          >
            Chart Configuration
          </button>
        </div>
      </div>

      {/* Main content area - has proper overflow constraints */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: Chart configuration or gallery - with scrollable content */}
        <div className="w-80 border-r border-white/10 bg-darkNav/50 overflow-y-auto flex-shrink-0">
          {selectedTab === "config" ? <ChartConfigPanel /> : <ChartGallery />}
        </div>

        {/* Right panel: Chart preview - with flex column and proper constraints */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chart type selection - fixed height */}
          <div className="px-4 py-2 border-b border-white/10 bg-darkNav/30 flex items-center flex-shrink-0">
            <div className="flex items-center mr-4">
              <h3 className="text-sm font-medium flex items-center whitespace-nowrap">
                <BarChart4 size={16} className="mr-2 text-primary" />
                Choose Chart Type
              </h3>
            </div>
            <div className="flex space-x-2 overflow-x-auto py-1 scrollbar-hide">
              <ChartTypeButton
                type="bar"
                icon={<BarChart4 size={18} />}
                label="Bar"
                description="Best for comparing categories"
              />
              <ChartTypeButton
                type="line"
                icon={<LineChart size={18} />}
                label="Line"
                description="Best for trends over time"
              />
              <ChartTypeButton
                type="area"
                icon={<TrendingUp size={18} />}
                label="Area"
                description="Best for part-to-whole over time"
              />
              <ChartTypeButton
                type="pie"
                icon={<PieChart size={18} />}
                label="Pie"
                description="Best for proportions of a whole"
              />
              <ChartTypeButton
                type="scatter"
                icon={<ScatterChart size={18} />}
                label="Scatter"
                description="Best for correlations between variables"
              />
            </div>
          </div>

          {/* Chart canvas - with flex-1 and min-height-0 */}
          <div className="flex-1 p-4 bg-background overflow-hidden min-h-0">
            {/* No data message or chart canvas */}
            {!hasData ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md p-8  rounded-lg  shadow-xl">
                  <BarChart4 size={64} className="mx-auto mb-4 text-primary/70" />
                  <h2 className="text-xl font-heading font-semibold mb-2">No Data to Visualize</h2>
                  <p className="text-white/70 mb-6">
                    {tableName ? (
                      <>Run a query on the <span className="text-primary">{tableName}</span> table to visualize your data.</>
                    ) : (
                      <>Open a file to create visualizations.</>
                    )}
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab('query')}>
                    Go to Query Tab
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              <ChartCanvas />
            )}
          </div>

          {/* Chart controls - fixed height */}
          <div className="p-3 border-t border-white/10 bg-darkNav/30 flex-shrink-0">
            <ChartControls />
          </div>
        </div>
      </div>

      {/* Modals */}
      <SaveChartModal />
      <ExportModal />
    </div>
  );
};

/**
 * Chart type selection button
 */
interface ChartTypeButtonProps {
  type: ChartType;
  icon: React.ReactNode;
  label: string;
  description: string;
}

const ChartTypeButton: React.FC<ChartTypeButtonProps> = ({
  type,
  icon,
  label,
  description,
}) => {
  const { currentChart, updateCurrentChart } = useChartsStore();

  const isActive = currentChart?.type === type;

  const handleClick = () => {
    if (currentChart) {
      updateCurrentChart({ type });
    }
  };

  return (
    <button
      className={`flex flex-col items-center p-2 rounded cursor-pointer transition-all flex-shrink-0 ${
        isActive
          ? "bg-primary/20 text-primary border border-primary/30"
          : "text-white/70 hover:bg-white/5 hover:text-white/90 border border-transparent"
      }`}
      onClick={handleClick}
      title={description}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
};

export default VisualizationTab;