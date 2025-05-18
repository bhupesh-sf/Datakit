import React, { useState, useEffect } from 'react';
import { BarChart4, LineChart, PieChart, ScatterChart, TrendingUp } from 'lucide-react';

import { useAppStore } from '@/store/appStore';
import { useChartsStore, ChartType } from '@/store/chartsStore';

import ChartCanvas from './visualization/ChartCanvas';
import ChartControls from './visualization/ChartControls';
import ChartConfigPanel from './visualization/ChartConfigPanel';
import ChartGallery from './visualization/ChartGallery';
import SaveChartModal from './visualization/SaveChartModal';
import ExportModal from './visualization/ExportModal';
import NoDataView from './visualization/NoDataView';

/**
 * Main visualization tab component that orchestrates the chart creation and visualization process
 */
const VisualizationTab: React.FC = () => {
  const { data: queryData, tableName } = useAppStore();
  const { 
    currentChart, 
    createNewChart,
    loadChartsFromStorage
  } = useChartsStore();
  
  const [selectedTab, setSelectedTab] = useState<'config' | 'gallery'>('config');
  
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
      
      const formattedData = rows.map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          // Try to convert to number if possible
          const value = row[index];
          obj[header] = isNaN(Number(value)) ? value : Number(value);
        });
        return obj;
      });
      
      // Create a new chart with the data
      createNewChart('bar', formattedData);
    }
  }, [queryData, currentChart, createNewChart]);
  
  // If no data is available, show a message
  if (!queryData || queryData.length <= 1) {
    return <NoDataView tableName={tableName} />;
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="bg-darkNav p-4 border-b border-white/10">
        <h2 className="text-xl font-heading font-semibold mb-4">Data Visualization</h2>
        
        <div className="flex border-b border-white/10">
          <button
            className={`px-4 py-2 text-sm ${
              selectedTab === 'config' 
                ? 'text-primary border-b-2 border-primary -mb-px' 
                : 'text-white/70 hover:text-white/90'
            }`}
            onClick={() => setSelectedTab('config')}
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
          {selectedTab === 'config' ? (
            <ChartConfigPanel />
          ) : (
            <ChartGallery />
          )}
        </div>
        
        {/* Right panel: Chart preview */}
        <div className="flex-1 flex flex-col">
          {/* Chart type selection */}
          <div className="p-4 border-b border-white/10 bg-darkNav/30 flex items-center">
            <h3 className="text-sm font-medium mr-4">Chart Type:</h3>
            <div className="flex space-x-2">
              <ChartTypeButton type="bar" icon={<BarChart4 size={18} />} label="Bar" />
              <ChartTypeButton type="line" icon={<LineChart size={18} />} label="Line" />
              <ChartTypeButton type="area" icon={<TrendingUp size={18} />} label="Area" />
              <ChartTypeButton type="pie" icon={<PieChart size={18} />} label="Pie" />
              <ChartTypeButton type="scatter" icon={<ScatterChart size={18} />} label="Scatter" />
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
}

const ChartTypeButton: React.FC<ChartTypeButtonProps> = ({ type, icon, label }) => {
  const { currentChart, updateCurrentChart } = useChartsStore();
  
  const isActive = currentChart?.type === type;
  
  const handleClick = () => {
    if (currentChart) {
      updateCurrentChart({ type });
    }
  };
  
  return (
    <button
      className={`flex flex-col items-center p-2 rounded cursor-pointer ${
        isActive 
          ? 'bg-primary/20 text-primary' 
          : 'text-white/70 hover:bg-white/5 hover:text-white/90'
      }`}
      onClick={handleClick}
      title={`Switch to ${label} Chart`}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
};

export default VisualizationTab;