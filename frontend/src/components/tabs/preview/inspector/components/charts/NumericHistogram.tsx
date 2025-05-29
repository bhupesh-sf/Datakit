import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface HistogramData {
  bin: string;
  count: number;
  range: string;
}

interface NumericHistogramProps {
  data: HistogramData[];
  color?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-lg p-2 shadow-lg">
        <p className="text-xs text-white font-medium">{data.range}</p>
        <p className="text-xs text-white/70">
          Count: <span className="text-primary font-mono">{data.count.toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const NumericHistogram: React.FC<NumericHistogramProps> = ({ 
  data, 
  color = 'hsl(175, 100%, 36%)' // primary color
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <XAxis 
          dataKey="bin" 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'rgba(255, 255, 255, 0.6)' }}
          interval={0}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'rgba(255, 255, 255, 0.6)' }}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="count" 
          fill={color}
          radius={[2, 2, 0, 0]}
          opacity={0.8}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
