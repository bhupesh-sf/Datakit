import React from "react";

import CSVGrid from "@/components/data-grid/CSVGrid";
import JSONGrid from "@/components/data-grid/JSONGrid";

import { useAppStore } from "@/store/appStore";

import { DataSourceType } from "@/types/json";

/**
 * DataPreviewTab displays the appropriate grid component based on data type
 */
const DataPreviewTab: React.FC = () => {
  const { sourceType } = useAppStore();

  return (
    <div className="h-full w-full">
      {sourceType === DataSourceType.JSON ? (
        <JSONGrid />
      ) : (
        <CSVGrid />
      )}
    </div>
  );
};

export default DataPreviewTab;