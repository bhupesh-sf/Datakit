import React from 'react';
import { useAppStore } from '@/store/appStore';
import CSVGrid from '@/components/data-grid/CSVGrid';
import JSONGrid from '@/components/data-grid/JSONGrid';
import { DataSourceType } from '@/types/json';
import GoogleSheetsMetadata from '@/components/common/GoogleSheetsMetadata';

const DataPreviewTab: React.FC = () => {
  const { 
    data, 
    sourceType, 
    jsonViewMode, 
    rawData, 
    jsonSchema,
    // Google Sheets metadata from app store
    remoteURL,
    remoteProvider,
    googleSheets
  } = useAppStore();

  // TODO:
  // if (!data || data.length === 0) {
  //   return (
  //     <div className="flex items-center justify-center h-full">
  //       <div className="text-center p-8 max-w-md">
  //         <h3 className="text-lg font-heading font-medium text-white mb-2">No Data Loaded</h3>
  //         <p className="text-white/70">
  //           Bring in a CSV, Excel, or JSON file using the sidebar to view and analyze your data.
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="h-full flex flex-col">
      {/* Google Sheets metadata banner - show only for Google Sheets imports */}
      {remoteProvider === 'google_sheets' && googleSheets && (
        <GoogleSheetsMetadata 
          metadata={googleSheets}
          url={remoteURL || ''}
          className="mb-3"
        />
      )}
      
      {/* Data grid component based on source type */}
      <div className="flex-1 overflow-hidden">
        {sourceType === DataSourceType.JSON && jsonViewMode === 'tree' && rawData ? (
          <JSONGrid data={rawData} schema={jsonSchema} />
        ) : (
          <CSVGrid data={data} />
        )}
      </div>
    </div>
  );
};

export default DataPreviewTab;