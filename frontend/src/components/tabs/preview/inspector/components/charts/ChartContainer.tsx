
import React from 'react';

interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  height?: number;
}

 export const ChartContainer: React.FC<ChartContainerProps> = ({ 
  title, 
  children, 
  height = 170 
}) => {
  return (
    <div className="mt-3 p-3 bg-card/20 rounded-lg">
      <div className="text-xs text-white/60 mb-3">{title}</div>
      <div style={{ height: `${height}px` }}>
        {children}
      </div>
    </div>
  );
};

