import React, { useRef } from 'react';
import { useChartsStore } from '@/store/chartsStore';
import { Download, Copy, Save, BarChart4 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Component for chart controls like export, save, and download
 */
const ChartControls: React.FC = () => {
  const { 
    currentChart, 
    toggleSaveModal, 
    toggleExportModal 
  } = useChartsStore();
  
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Don't show controls if no chart
  if (!currentChart) {
    return (
      <div className="flex justify-center items-center p-3">
        <div className="text-sm text-white/50 flex items-center">
          <BarChart4 size={16} className="mr-2" />
          No chart selected
        </div>
      </div>
    );
  }
  
  return (
    <div ref={chartRef} className="flex justify-between items-center">
      <div className="text-sm text-white/70">
        {currentChart.data.length} data points
        {currentChart.isModified && (
          <span className="ml-2 text-primary">● Unsaved changes</span>
        )}
      </div>
      
      <div className="flex space-x-2">
        <Button 
          variant="ghost" 
          onClick={() => toggleExportModal(true)}
        >
          <Copy size={16} className="mr-1" />
          Copy/Export
        </Button>

       {/* TODO: For next iterations  */}
        {/* <Button 
          variant="primary" 
          onClick={() => toggleSaveModal(true)}
        >
          <Save size={16} className="mr-1" />
          Save Chart
        </Button> */}
      </div>
    </div>
  );
};

export default ChartControls;