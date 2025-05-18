import { useState } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useChartsStore } from '@/store/chartsStore';

interface ChartGenerationOptions {
  tableName: string;
  dimension: string;
  measure: string;
  chartType?: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  limit?: number;
  filters?: {field: string, operator: string, value: string}[];
}

export const useChartGeneration = () => {
  const { executeChartQuery } = useDuckDBStore();
  const { createNewChart, updateCurrentChart, currentChart } = useChartsStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const generateChart = async (options: ChartGenerationOptions) => {
    const { 
      tableName, 
      dimension, 
      measure, 
      chartType = currentChart?.type || 'bar',
      aggregation = 'sum',
      limit = 100,
      filters = []
    } = options;
    
    if (!tableName || !dimension || !measure) {
      setError('Missing required parameters');
      return;
    }
    
    try {
      setIsGenerating(true);
      setError(null);
      
      // Execute DuckDB query to get aggregated data
      const chartData = await executeChartQuery(
        tableName,
        dimension,
        measure,
        aggregation,
        limit,
        filters
      );
      
      // Format data for visualization
      const formattedData = chartData.map(item => ({
        [dimension]: item.dimension,
        [measure]: item.value,
        count: item.count
      }));
      
      // Create or update chart
      if (!currentChart) {
        createNewChart(chartType, formattedData);
      } else {
        updateCurrentChart({
          data: formattedData,
          originalData: [...formattedData],
          title: `${aggregation.toUpperCase()} of ${measure} by ${dimension}`,
          xAxis: {
            ...currentChart.xAxis,
            field: dimension,
            label: formatFieldLabel(dimension),
            dataKey: dimension
          },
          yAxis: {
            ...currentChart.yAxis,
            field: measure,
            label: `${aggregation.toUpperCase()} of ${formatFieldLabel(measure)}`,
            dataKey: measure
          }
        });
      }
      
      return formattedData;
    } catch (err) {
      console.error('Chart generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate chart');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };
  
  return {
    generateChart,
    isGenerating,
    error
  };
};

// Helper function
function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, c => c.toUpperCase());
}