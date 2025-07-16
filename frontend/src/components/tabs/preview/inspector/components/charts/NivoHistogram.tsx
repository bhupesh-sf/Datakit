import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface HistogramData {
  bin: string;
  count: number;
  range: string;
  binStart: number;
  binEnd: number;
}

interface NivoHistogramProps {
  data: HistogramData[];
  color?: string;
  height?: number;
  interactive?: boolean;
  exportable?: boolean;
  onExport?: (format: string) => void;
}

const NivoHistogram: React.FC<NivoHistogramProps> = ({ 
  data, 
  color = '#2dd4bf', // primary color
  height = 180,
  interactive = true,
  exportable = false,
  onExport
}) => {
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
      <div className="text-sm font-medium text-white mb-1">
        Range: {data.range}
      </div>
      <div className="text-sm text-white/80">
        Count: <span className="font-mono text-primary">{value.toLocaleString()}</span>
      </div>
      <div className="text-xs text-white/60 mt-1">
        {data.binStart} → {data.binEnd}
      </div>
    </div>
  );

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
        data={data}
        keys={['count']}
        indexBy="bin"
        margin={{ top: 10, right: 10, bottom: 30, left: 40 }}
        padding={0.1}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={[color]}
        theme={theme}
        borderRadius={2}
        borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: null,
          legendPosition: 'middle',
          legendOffset: 32,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: null,
          legendPosition: 'middle',
          legendOffset: -40,
        }}
        enableGridY={true}
        enableGridX={false}
        enableLabel={false}
        isInteractive={interactive}
        tooltip={CustomTooltip}
        animate={true}
        motionConfig="gentle"
        role="application"
        ariaLabel="Data distribution histogram"
        barAriaLabel={function(e) {
          return e.id + ": " + e.formattedValue + " in range: " + e.indexValue;
        }}
      />
    </div>
  );
};

export default NivoHistogram;