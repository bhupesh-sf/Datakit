import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface CategoricalData {
  value: string;
  count: number;
  percentage: number;
}

interface NivoCategoricalChartProps {
  data: CategoricalData[];
  colors?: string[];
  height?: number;
  interactive?: boolean;
  exportable?: boolean;
  onExport?: (format: string) => void;
  maxItems?: number;
}

const NivoCategoricalChart: React.FC<NivoCategoricalChartProps> = ({
  data,
  colors = [
    '#a855f7', // purple-500
    '#2dd4bf', // teal-400
    '#06b6d4', // cyan-500
    '#8b5cf6', // violet-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
  ],
  height = 180,
  interactive = true,
  exportable = false,
  onExport,
  maxItems = 7
}) => {
  // Limit data to maxItems and ensure we have data
  const limitedData = data.slice(0, maxItems);
  
  // Handle empty data case
  if (!limitedData || limitedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/60 text-sm">
        No categorical data available
      </div>
    );
  }

  const theme = {
    background: 'transparent',
    text: {
      fontSize: 11,
      fill: 'rgba(255, 255, 255, 0.8)',
    },
    axis: {
      domain: {
        line: {
          stroke: 'rgba(255, 255, 255, 0.1)',
          strokeWidth: 1,
        },
      },
      legend: {
        text: {
          fontSize: 12,
          fill: 'rgba(255, 255, 255, 0.8)',
        },
      },
      ticks: {
        line: {
          stroke: 'rgba(255, 255, 255, 0.1)',
          strokeWidth: 1,
        },
        text: {
          fontSize: 10,
          fill: 'rgba(255, 255, 255, 0.6)',
        },
      },
    },
    grid: {
      line: {
        stroke: 'rgba(255, 255, 255, 0.05)',
        strokeWidth: 1,
      },
    },
    tooltip: {
      container: {
        background: 'rgba(0, 0, 0, 0.95)',
        color: 'white',
        fontSize: 12,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      },
    },
  };

  const CustomTooltip = ({ id, value, data }: any) => (
    <div className="bg-black/95 border border-white/20 rounded-lg p-3 shadow-xl">
      <div className="text-sm font-medium text-white mb-1 max-w-48 truncate">
        {data.value}
      </div>
      <div className="text-sm text-white/80">
        Count: <span className="font-mono text-secondary">{value.toLocaleString()}</span>
      </div>
      <div className="text-sm text-white/80">
        {data.percentage.toFixed(1)}% of total
      </div>
    </div>
  );

  const getColor = (index: number) => colors[index % colors.length];

  return (
    <div className="relative w-full" style={{ height }}>
      {exportable && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={() => onExport?.('png')}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white/70 hover:text-white transition-colors"
          >
            PNG
          </button>
          <button
            onClick={() => onExport?.('svg')}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white/70 hover:text-white transition-colors"
          >
            SVG
          </button>
        </div>
      )}
      
      <ResponsiveBar
        data={limitedData}
        keys={['count']}
        indexBy="value"
        margin={{ top: 10, right: 20, bottom: 10, left: 80 }}
        padding={0.2}
        layout="horizontal"
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={({ index }) => getColor(index)}
        theme={theme}
        borderRadius={3}
        borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: null,
          legendPosition: 'middle',
          legendOffset: 32,
          format: (value) => value.toLocaleString(),
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: null,
          legendPosition: 'middle',
          legendOffset: -40,
          format: (value: string) => value.length > 12 ? value.slice(0, 12) + '...' : value,
        }}
        enableGridY={false}
        enableGridX={true}
        enableLabel={false}
        isInteractive={interactive}
        tooltip={CustomTooltip}
        animate={true}
        motionConfig="gentle"
        role="application"
        ariaLabel="Categorical data distribution"
        barAriaLabel={function(e) {
          return e.id + ": " + e.formattedValue + " for " + e.indexValue;
        }}
      />
    </div>
  );
};

export default NivoCategoricalChart;