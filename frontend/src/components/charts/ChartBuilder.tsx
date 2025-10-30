import React, { useState, useMemo, useCallback } from 'react';
import { BarChart, LineChart, PieChart, ScatterChart, AreaChart, Download, HelpCircle } from 'lucide-react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

import { Tooltip } from '@/components/ui/Tooltip';
import { ChartSuggestion, parseChartSuggestion, prepareChartData, suggestChartType } from './utils/chartParser';

interface ChartBuilderProps {
  data: any[][];
  columnTypes: Array<{ name: string; type: string }>;
  aiSuggestion?: string; // From AI response
  className?: string;
}

const ChartBuilder: React.FC<ChartBuilderProps> = ({
  data,
  columnTypes,
  aiSuggestion,
  className = ''
}) => {

  // Get available columns
  const headers = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data[0].slice(1); // Skip row number column
  }, [data]);

  const numericColumns = useMemo(() => {
    return columnTypes.filter(col => 
      ['INTEGER', 'DOUBLE', 'FLOAT', 'DECIMAL', 'BIGINT'].includes(col.type.toUpperCase())
    ).map(col => col.name);
  }, [columnTypes]);

  const categoricalColumns = useMemo(() => {
    return columnTypes.filter(col => 
      ['VARCHAR', 'TEXT', 'STRING', 'DATE', 'DATETIME', 'TIMESTAMP'].includes(col.type.toUpperCase())
    ).map(col => col.name);
  }, [columnTypes]);

  // Parse AI suggestion or auto-detect with fallback defaults
  const initialSuggestion = useMemo(() => {
    if (aiSuggestion) {
      const parsed = parseChartSuggestion(aiSuggestion);
      if (parsed && parsed.type !== 'none') return parsed;
    }
    
    const autoSuggestion = suggestChartType(data, columnTypes);
    if (autoSuggestion.type !== 'none') return autoSuggestion;
    
    // Fallback: create a sensible default chart configuration
    const firstCategorical = categoricalColumns[0] || headers[0];
    const firstNumeric = numericColumns[0] || headers[1];
    
    return {
      type: 'bar' as const,
      xAxis: firstCategorical,
      yAxis: firstNumeric,
      description: 'Default bar chart configuration'
    };
  }, [data, columnTypes, aiSuggestion, categoricalColumns, numericColumns, headers]);

  const [activeChart, setActiveChart] = useState<ChartSuggestion>(initialSuggestion);

  // Prepare chart data
  const chartData = useMemo(() => {
    return prepareChartData(data, activeChart);
  }, [data, activeChart]);

  const chartTypes = [
    { type: 'bar' as const, icon: BarChart, label: 'Bar' },
    { type: 'line' as const, icon: LineChart, label: 'Line Chart' },
    { type: 'pie' as const, icon: PieChart, label: 'Pie Chart' },
    { type: 'scatter' as const, icon: ScatterChart, label: 'Scatter Plot' },
    { type: 'area' as const, icon: AreaChart, label: 'Area Chart' },
  ];

  const handleChartTypeChange = (type: ChartSuggestion['type']) => {
    setActiveChart(prev => ({ ...prev, type }));
  };

  const handleAxisChange = (axis: 'xAxis' | 'yAxis' | 'colorBy', value: string) => {
    setActiveChart(prev => ({ ...prev, [axis]: value }));
  };

  // Format numbers with units and significant digits
  const formatNumber = useCallback((value: number): string => {
    if (value === 0) return '0';
    
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    
    // Handle very small numbers with scientific notation
    if (absValue < 0.0001 && absValue > 0) {
      return value.toExponential(2);
    }
    
    // Handle large numbers with units
    if (absValue >= 1000000000) {
      return `${sign}${(absValue / 1000000000).toFixed(absValue >= 10000000000 ? 0 : 1)}B`;
    }
    if (absValue >= 1000000) {
      return `${sign}${(absValue / 1000000).toFixed(absValue >= 10000000 ? 0 : 1)}M`;
    }
    if (absValue >= 1000) {
      return `${sign}${(absValue / 1000).toFixed(absValue >= 10000 ? 0 : 1)}k`;
    }
    
    // Handle decimal numbers with significant digits
    if (absValue < 1) {
      return value.toPrecision(3);
    }
    
    // Handle regular numbers (up to 4 significant digits)
    if (absValue >= 100) {
      return Math.round(value).toString();
    }
    if (absValue >= 10) {
      return value.toFixed(1);
    }
    
    return value.toFixed(2);
  }, []);

  const handleChartExport = useCallback(async (format: 'png' | 'svg' = 'png') => {
    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer) return;

    try {
      if (format === 'svg') {
        // For SVG export, we need to extract the SVG from the Nivo chart
        const svgElement = chartContainer.querySelector('svg');
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `chart_${activeChart.type}_${Date.now()}.svg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } else {
        // For PNG export, use html2canvas with transparent background
        const html2canvas = await import('html2canvas');
        const canvas = await html2canvas.default(chartContainer as HTMLElement, {
          backgroundColor: null, // Transparent background
          scale: 2, // Higher resolution
          useCORS: true,
        });
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `chart_${activeChart.type}_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        });
      }
    } catch (error) {
      console.error('Failed to export chart:', error);
    }
  }, [activeChart.type]);

  const renderChart = () => {
    if (!chartData || chartData.length === 0 || activeChart.type === 'none') {
      return (
        <div className="h-full flex items-center justify-center text-white/50">
          <div className="text-center">
            <p className="mb-2">No chart data available</p>
            <p className="text-sm">Configure chart settings to visualize your data</p>
          </div>
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      theme: {
        background: 'transparent',
        text: { fill: '#ffffff' },
        axis: {
          ticks: { text: { fill: '#ffffff' } },
          legend: { text: { fill: '#ffffff' } }
        },
        grid: { line: { stroke: '#374151' } },
        tooltip: {
          container: {
            background: '#1f2937',
            color: '#ffffff',
            border: '1px solid #374151'
          }
        }
      },
      margin: { top: 50, right: 130, bottom: 50, left: 60 },
      // Add number formatting to all charts
      valueFormat: (value: number) => formatNumber(value)
    };

    switch (activeChart.type) {
      case 'bar':
        return (
          <ResponsiveBar
            {...commonProps}
            keys={activeChart.yAxis ? [activeChart.yAxis] : []}
            indexBy={activeChart.xAxis || 'id'}
            colors={{ scheme: 'nivo' }}
            padding={0.3}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
            axisTop={null}
            axisRight={null}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              format: formatNumber
            }}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          />
        );

      case 'line':
        const lineData = [{
          id: activeChart.yAxis || 'series',
          data: chartData.map(d => ({
            x: d[activeChart.xAxis || 'id'],
            y: d[activeChart.yAxis || 'value'] || 0
          }))
        }];
        return (
          <ResponsiveLine
            {...commonProps}
            data={lineData}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
            axisTop={null}
            axisRight={null}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              format: formatNumber
            }}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0
            }}
            pointSize={10}
            pointColor={{ theme: 'background' }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            useMesh={true}
          />
        );

      case 'pie':
        const pieData = chartData.map(d => ({
          id: d[activeChart.xAxis || 'id'],
          label: d[activeChart.xAxis || 'id'],
          value: d[activeChart.yAxis || 'value'] || 1
        }));
        return (
          <ResponsivePie
            {...commonProps}
            data={pieData}
            innerRadius={0.5}
            padAngle={0.7}
            cornerRadius={3}
            activeOuterRadiusOffset={8}
            borderWidth={1}
            borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
            enableArcLinkLabels={true}
            arcLinkLabelsSkipAngle={10}
            arcLinkLabelsTextColor="#ffffff"
            arcLinkLabelsThickness={2}
            arcLinkLabelsColor={{ from: 'color' }}
            arcLabelsTextColor="#ffffff"
            valueFormat={formatNumber}
          />
        );

      case 'scatter':
        const scatterData = [{
          id: 'data',
          data: chartData.map(d => ({
            x: parseFloat(d[activeChart.xAxis || 'id']) || 0,
            y: parseFloat(d[activeChart.yAxis || 'value']) || 0
          }))
        }];
        return (
          <ResponsiveScatterPlot
            {...commonProps}
            data={scatterData}
            xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
            yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
            blendMode="multiply"
            axisTop={null}
            axisRight={null}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              format: formatNumber
            }}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              format: formatNumber
            }}
          />
        );

      default:
        return (
          <div className="h-full flex items-center justify-center text-white/50">
            <p>Chart type not supported yet</p>
          </div>
        );
    }
  };

  return (
    <div className={`h-full flex flex-col bg-background ${className}`}>
      {/* Chart Configuration - Single Row */}
      <div className="flex-shrink-0 p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Chart Builder</h3>
          <div className="flex gap-1">
            <Tooltip placement='bottom' content="PNG">
              <button
                onClick={() => handleChartExport('png')}
                className="p-1 rounded transition-colors text-white/50 hover:text-white hover:bg-white/10"
              >
                <Download className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Chart Types and Axis Configuration in one row */}
        <div className="flex items-end gap-6">
          {/* Chart Type Buttons */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs font-medium text-white/70">Chart Type</span>
            </div>
            <div className="flex gap-1">
              {chartTypes.map(({ type, icon: Icon, label }) => (
                <Tooltip placement='bottom' key={type} content={label}>
                  <button
                    onClick={() => handleChartTypeChange(type)}
                    className={`p-2 rounded transition-colors ${
                      activeChart.type === type
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-white/50 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* X Axis */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs font-medium text-white/70">X Axis</span>
              <Tooltip placement="top" content="Choose the column for horizontal axis (categories, dates, or labels)">
                <HelpCircle className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
              </Tooltip>
            </div>
            <select
              value={activeChart.xAxis || ''}
              onChange={(e) => handleAxisChange('xAxis', e.target.value)}
              className="w-full p-1 text-xs bg-white/5 border border-white/10 rounded text-white"
            >
              <option value="">Select column</option>
              {headers.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          {/* Y Axis */}
          {activeChart.type !== 'pie' && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-medium text-white/70">Y Axis</span>
                <Tooltip placement="top" content="Choose the column for vertical axis (values, measurements, or counts)">
                  <HelpCircle className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                </Tooltip>
              </div>
              <select
                value={activeChart.yAxis || ''}
                onChange={(e) => handleAxisChange('yAxis', e.target.value)}
                className="w-full p-1 text-xs bg-white/5 border border-white/10 rounded text-white"
              >
                <option value="">Select column</option>
                {headers.map(col => (
                  <option key={col} value={col}>
                    {col}
                    {numericColumns.includes(col) ? ' (numeric)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* AI Suggestion */}
        {aiSuggestion && (
          <div className="mt-3 p-2 bg-primary/10 border border-primary/20 rounded text-xs">
            <span className="text-primary/80">AI Suggestion:</span>
            <span className="text-white/70 ml-1">{aiSuggestion}</span>
          </div>
        )}
      </div>

      {/* Chart Area */}
      <div className="flex-1 p-4">
        <div className="chart-container h-full">
          {renderChart()}
        </div>
      </div>
    </div>
  );
};

export default ChartBuilder;