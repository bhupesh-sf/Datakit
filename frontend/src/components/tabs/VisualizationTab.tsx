import React, { useState, useEffect } from "react";
import {
  BarChart4,
  LineChart,
  PieChart,
  ScatterChart,
  TrendingUp,
  InfoIcon,
} from "lucide-react";

import { useAppStore } from "@/store/appStore";
import { useChartsStore, ChartType } from "@/store/chartsStore";

import ChartCanvas from "./visualization/ChartCanvas";
import ChartControls from "./visualization/ChartControls";
import ChartConfigPanel from "./visualization/ChartConfigPanel";
import ChartGallery from "./visualization/ChartGallery";
import SaveChartModal from "./visualization/SaveChartModal";
import ExportModal from "./visualization/ExportModal";
import NoDataView from "./visualization/NoDataView";

/**
 * Main visualization tab component that orchestrates the chart creation and visualization process
 */
const VisualizationTab: React.FC = () => {
  const { data: queryData, tableName } = useAppStore();
  const {
    currentChart,
    createNewChart,
    loadChartsFromStorage,
    updateCurrentChart,
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

  // If no data is available, show a message
  if (!queryData || queryData.length <= 1) {
    return <NoDataView tableName={tableName} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="bg-darkNav py-2 px-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-heading font-semibold mb-4">
            Data Visualization
          </h2>

          {currentChart && currentChart.data && (
            <div className="mx-2 mt-1 mb-1 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md flex items-center text-sm">
              <InfoIcon size={16} className="mr-2 text-blue-400" />
              <div className="mr-auto">
                <span className="font-medium">{currentChart.data.length}</span>{" "}
                data points are shown in this visualization
              </div>
             
            </div>
          )}
        </div>

        <div className="flex border-b border-white/10">
          <button
            className={`px-4 py-2 text-sm ${
              selectedTab === "config"
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-white/70 hover:text-white/90"
            }`}
            onClick={() => setSelectedTab("config")}
          >
            Chart Configuration
          </button>
          {/* <button
            className={`px-4 py-2 text-sm ${
              selectedTab === 'gallery' 
                ? 'text-primary border-b-2 border-primary -mb-px' 
                : 'text-white/70 hover:text-white/90'
            }`}
            onClick={() => setSelectedTab('gallery')}
          >
            Chart Gallery
          </button> */}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Chart configuration or gallery */}
        <div className="w-80 border-r border-white/10 bg-darkNav/50 overflow-y-auto">
          {selectedTab === "config" ? <ChartConfigPanel /> : <ChartGallery />}
        </div>

        {/* Right panel: Chart preview */}
        <div className="flex-1 flex flex-col">
          {/* Chart type selection - Updated with better guidance */}
          <div className="px-4 py-2 border-b border-white/10 bg-darkNav/30 flex items-center">
            <div className="flex justify-between items-center mb-2 mr-4">
              <h3 className="text-sm font-medium flex items-center">
                <BarChart4 size={16} className="mr-2 text-primary" />
                Choose Chart Type
              </h3>
              {/* {currentChart && (
                <div className="text-xs text-white/70">
                  Select the most appropriate chart for your data visualization
                </div>
              )} */}
            </div>
            <div className="flex space-x-3">
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

          {/* Chart canvas */}
          <div className="flex-1 overflow-hidden p-6 bg-background">
            <ChartCanvas />
          </div>

          {/* Chart controls */}
          <div className="p-3 border-t border-white/10 bg-darkNav/30">
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
      className={`flex flex-col items-center p-2 rounded cursor-pointer transition-all ${
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
