import React from 'react';
import { useAppStore } from '@/store/appStore';
import { 
  selectActiveFile,
  selectFileTabs,
  selectHasFiles,
  selectData,
  selectSourceType,
  selectRawData,
  selectJsonSchema,
  selectRemoteURL,
  selectRemoteProvider,
  selectGoogleSheets
} from '@/store/selectors/appSelectors';
import CSVGrid from '@/components/data-grid/CSVGrid';
import JSONGrid from '@/components/data-grid/JSONGrid';
import FileTabs from '@/components/data-grid/FileTabs';
import EmptyDataState from '@/components/data-grid/EmptyDataState';
import GoogleSheetsMetadata from '@/components/common/GoogleSheetsMetadata';
import { DataSourceType } from '@/types/json';

const DataPreviewTab: React.FC = () => {
  // Use selectors for reactive data access
  const hasFiles = useAppStore(selectHasFiles);
  const activeFile = useAppStore(selectActiveFile);
  const fileTabs = useAppStore(selectFileTabs);
  const data = useAppStore(selectData);
  const sourceType = useAppStore(selectSourceType);
  const rawData = useAppStore(selectRawData);
  const jsonSchema = useAppStore(selectJsonSchema);
  const remoteURL = useAppStore(selectRemoteURL);
  const remoteProvider = useAppStore(selectRemoteProvider);
  const googleSheets = useAppStore(selectGoogleSheets);
  
  // Get UI state
  const { jsonViewMode, setActiveFile, removeFile, closeAllFiles, closeOthersFiles } = useAppStore();


  const handleTabClick = (fileId: string) => {
    setActiveFile(fileId);
  };

  const handleTabClose = (fileId: string) => {
    removeFile(fileId);
  };

  const handleCloseAll = () => {
    closeAllFiles();
  };

  const handleCloseOthers = (keepFileId: string) => {
    closeOthersFiles(keepFileId);
  };

  // Debug logging
  console.log('DataPreviewTab state:', {
    hasFiles,
    activeFile,
    fileTabs,
    data: data?.length || 0,
    sourceType
  });

  // Show empty state if no files are loaded
  if (!hasFiles) {
    return <EmptyDataState />;
  }

  // Show file tabs and active file content
  return (
    <div className="h-full flex flex-col">
      {/* File Tabs */}
      <FileTabs
        tabs={fileTabs}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onCloseAll={handleCloseAll}
        onCloseOthers={handleCloseOthers}
      />
      
      {/* Active File Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeFile && 
         remoteProvider === 'google_sheets' && 
         googleSheets && (
          <div className="px-3 pt-3">
            <GoogleSheetsMetadata 
              metadata={googleSheets}
              url={remoteURL || ''}
              className="mb-0"
              compact={true}
            />
          </div>
        )}
        
        {/* Data grid component based on source type */}
        <div className="flex-1 overflow-hidden">
          {activeFile ? (
            sourceType === DataSourceType.JSON && jsonViewMode === 'tree' && rawData ? (
              <JSONGrid data={rawData} schema={jsonSchema} />
            ) : (
              <CSVGrid />
            )
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-white/70">
                <p className="text-lg mb-2">No data to preview</p>
                <p className="text-sm">Select a file tab to view its contents</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataPreviewTab;