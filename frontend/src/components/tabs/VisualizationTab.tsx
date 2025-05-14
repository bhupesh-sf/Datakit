import React from "react";

import { useAppStore } from "@/store/appStore";

const VisualizationTab: React.FC = () => {
  const { tableName } = useAppStore();
  
  return (
    <div className="h-full flex flex-col items-center justify-center text-white/70">
      <div className="p-6 border border-white/10 rounded-lg bg-darkNav/50 max-w-md text-center">
        <h3 className="text-lg font-heading font-medium mb-2">Coming Soon</h3>
        <p className="mb-4">
          Data visualization features will be available soon.
        </p>
        {tableName && (
          <p className="text-sm">
            You'll be able to create charts and graphs from your <span className="text-primary">{tableName}</span> data.
          </p>
        )}
      </div>
    </div>
  );
};

export default VisualizationTab;