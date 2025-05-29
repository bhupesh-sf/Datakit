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
      <div className="bg-gray-900/95 border border-white/20 rounded-lg p-2 shadow-lg">
        <p className="text-xs text-white font-medium truncate max-w-32">
          {data.value}
        </p>
        <p className="text-xs text-white/70">
          Count: <span className="text-secondary font-mono">{data.count.toLocaleString()}</span>
        </p>
        <p className="text-xs text-white/70">
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
  ]
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart 
        data={data} 
        layout="horizontal"
        margin={{ top: 5, right: 5, left: 60, bottom: 5 }}
      >
        <XAxis 
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'rgba(255, 255, 255, 0.6)' }}
        />
        <YAxis 
          type="category"
          dataKey="value"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'rgba(255, 255, 255, 0.6)' }}
          width={55}
        />
        <Tooltip content={<CategoricalTooltip />} />
        <Bar dataKey="count" radius={[0, 2, 2, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} opacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
