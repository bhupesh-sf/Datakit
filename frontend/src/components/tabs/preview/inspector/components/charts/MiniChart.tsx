import React from 'react';

import { ChartContainer, NumericHistogram, CategoricalBarChart } from './index';

export const MiniChart: React.FC<{ 
  column: InspectorMetrics['columnMetrics'][0];
  metrics: InspectorMetrics;
}> = ({ column, metrics }) => {
  console.log(`[Chart Debug] Analyzing ${column.name}:`, {
    type: column.type,
    hasNumericStats: !!column.numericStats,
    hasHistogramData: !!column.histogramData,
    histogramLength: column.histogramData?.length || 0,
    uniqueCount: column.uniqueCount,
    nullCount: column.nullCount
  });

  const frequentValues = metrics.frequentValues.find(fv => fv.column === column.name);
  console.log(`[Chart Debug] Frequent values for ${column.name}:`, {
    found: !!frequentValues,
    count: frequentValues?.values.length || 0,
    values: frequentValues?.values.slice(0, 3) // First 3 for debugging
  });

  // Priority 1: Numeric columns with histogram data
  if (column.numericStats && column.histogramData && column.histogramData.length > 0) {
    console.log(`[Chart Debug] Rendering histogram for ${column.name}`);
    return (
      <ChartContainer title="Distribution" height={140}>
        <NumericHistogram 
          data={column.histogramData}
          color="hsl(175, 100%, 36%)"
        />
      </ChartContainer>
    );
  }
  
  // Priority 2: Any column with frequent values (including text!)
  if (frequentValues && frequentValues.values.length > 0) {
    console.log(`[Chart Debug] Rendering categorical chart for ${column.name}`);
    return (
      <ChartContainer title="Top Values" height={140}>
        <CategoricalBarChart 
          data={frequentValues.values.slice(0, 7)}
          colors={[
            'hsl(271, 75%, 53%)', // secondary
            'hsl(175, 100%, 36%)', // primary  
            'hsl(167, 53%, 49%)', // tertiary
            'hsl(271, 75%, 63%)', // secondary lighter
            'hsl(175, 100%, 46%)', // primary lighter
            'hsl(167, 53%, 59%)', // tertiary lighter
            'hsl(271, 75%, 73%)', // secondary even lighter
          ]}
        />
      </ChartContainer>
    );
  }
  
  // Priority 3: Numeric stats fallback (for numbers without histograms)
  if (column.numericStats) {
    console.log(`[Chart Debug] Rendering stats fallback for ${column.name}`);
    return (
      <div className="mt-3 p-3 bg-card/20 rounded-lg">
        <div className="text-xs text-white/60 mb-2">Statistics</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/60">Min:</span>
            <span className="text-white font-mono">{column.numericStats.min.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Max:</span>
            <span className="text-white font-mono">{column.numericStats.max.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Mean:</span>
            <span className="text-white font-mono">{column.numericStats.mean.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Median:</span>
            <span className="text-white font-mono">{column.numericStats.median.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Priority 4: Text statistics for text columns
  if (column.textStats) {
    console.log(`[Chart Debug] Rendering text stats for ${column.name}`);
    return (
      <div className="mt-3 p-3 bg-card/20 rounded-lg">
        <div className="text-xs text-white/60 mb-2">Text Statistics</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/60">Avg Length:</span>
            <span className="text-white font-mono">{column.textStats.avgLength.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Max Length:</span>
            <span className="text-white font-mono">{column.textStats.maxLength}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Empty:</span>
            <span className="text-white font-mono">{column.textStats.emptyStrings}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Total Chars:</span>
            <span className="text-white font-mono">{column.textStats.totalChars.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Priority 5: Empty state with correct reasoning
  console.log(`[Chart Debug] No chart data available for ${column.name}`, {
    hasAnyStats: !!(column.numericStats || column.textStats),
    isAllNull: column.nullCount === column.uniqueCount,
    hasLowCardinality: column.uniqueCount <= 1
  });

  // Determine the real reason for no chart
  let reason: 'no-data' | 'inappropriate' | 'error' = 'no-data';
  let message = '';

  if (column.nullCount >= (column.uniqueCount * 0.9)) {
    reason = 'no-data';
    message = 'Column is mostly empty (90%+ null values)';
  } else if (column.uniqueCount <= 1) {
    reason = 'inappropriate';
    message = 'All values are the same - no distribution to show';
  } else if (column.uniqueCount === column.nullCount && column.nullCount > 0) {
    reason = 'no-data';
    message = 'No valid data found for visualization';
  } else {
    reason = 'error';
    message = 'Chart generation failed - data may be too complex';
  }

  return (
    <div className="mt-3 p-3 bg-card/10 rounded-lg border border-yellow-500/20">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-yellow-400">⚠️ No Chart Available</span>
      </div>
      <div className="text-xs text-white/70 mb-2">
        {message}
      </div>
      <div className="text-xs text-white/50">
        Column: {column.name} • Type: {column.type} • Unique: {column.uniqueCount} • Nulls: {column.nullCount}
      </div>
    </div>
  );
};