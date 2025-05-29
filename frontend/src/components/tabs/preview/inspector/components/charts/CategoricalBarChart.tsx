import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

interface CategoricalData {
  value: string;
  count: number;
  percentage: number;
}

interface CategoricalBarChartProps {
  data: CategoricalData[];
  colors?: string[];
}

const CategoricalTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-lg p-3 shadow-lg">
        <p className="text-sm text-white font-medium truncate max-w-48">
          {data.value}
        </p>
        <p className="text-sm text-white/80">
          Count: <span className="text-secondary font-mono">{data.count.toLocaleString()}</span>
        </p>
        <p className="text-sm text-white/80">
          {data.percentage.toFixed(1)}% of total
        </p>
      </div>
    );
  }
  return null;
};

export const CategoricalBarChart: React.FC<CategoricalBarChartProps> = ({
  data,
  colors = [
    'hsl(271, 75%, 53%)', // secondary
    'hsl(175, 100%, 36%)', // primary
    'hsl(167, 53%, 49%)', // tertiary
    'hsl(271, 75%, 63%)', // secondary lighter
    'hsl(175, 100%, 46%)', // primary lighter
    'hsl(167, 53%, 59%)', // tertiary lighter
    'hsl(271, 75%, 73%)', // secondary even lighter
  ],
}) => {
  // Fallback for no data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/60 text-sm">
        No categorical data available
      </div>
    );
  }

  // Ensure at least one bar for single data point
  const chartData = data.length === 1 ? [...data, { value: '', count: 0, percentage: 0 }] : data;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
      >
        <XAxis
          type="number"
          domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 1)]}
          tickFormatter={(value: number) => value.toLocaleString()}
          tick={{ fontSize: 10, fill: 'rgba(255, 255, 255, 0.6)' }}
          axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="value"
          tick={{ fontSize: 10, fill: 'rgba(255, 255, 255, 0.6)' }}
          axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CategoricalTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={20}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.count === 0 ? 'transparent' : colors[index % colors.length]}
              opacity={entry.count === 0 ? 0 : 0.9}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};