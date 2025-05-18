import React from 'react';
import { BarChart4, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';

interface NoDataViewProps {
  tableName?: string;
}

/**
 * Component displayed when no data is available for visualization
 */
const NoDataView: React.FC<NoDataViewProps> = ({ tableName }) => {
  const { setActiveTab } = useAppStore();
  
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="text-center max-w-md p-8 bg-darkNav/30 rounded-lg border border-white/10">
        <BarChart4 size={64} className="mx-auto mb-4 text-primary/70" />
        <h2 className="text-xl font-heading font-semibold mb-2">No Data to Visualize</h2>
        <p className="text-white/70 mb-6">
          {tableName ? (
            <>Run a query on the <span className="text-primary">{tableName}</span> table to visualize your data.</>
          ) : (
            <>Upload a data file to create visualizations.</>
          )}
        </p>
        <Button onClick={() => setActiveTab('query')}>
          Go to Query Tab
          <ArrowRight size={16} className="ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default NoDataView;