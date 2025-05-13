import React from "react";
import { FileText } from "lucide-react";
import { FileUploadButton } from "@/components/common/FileUploadButton";
import { ThemeColorPicker } from "@/components/common/ThemeColorPicker";
import useFileAccess from "@/hooks/useFileAccess";
import { useDuckDBStore } from "@/store/duckDBStore";
import useDirectFileImport from "@/hooks/useDirectFileImport";

import { ColumnType } from "@/types/csv";
import { DataSourceType, DataParseResult } from "@/types/json";

export interface DataLoadWithDuckDBResult {
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType?: DataSourceType;
  rawData?: any;
  schema?: any;
  loadedToDuckDB: boolean;
  tableName?: string;
}

interface SidebarProps {
  onDataLoad?: (result: DataLoadWithDuckDBResult) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onDataLoad }) => {
  const { recentFiles } = useFileAccess();

  const {
    handleUploadClick,
    handleRecentFileSelect,
    processFile,
    isProcessing,
    loadingStatus,
    loadingProgress,
    processingError,
  } = useDirectFileImport();

  // Monitor DuckDB state
  const {
    isLoading: duckDBLoading,
    processingProgress: duckDBProgress,
    error: duckDBError,
  } = useDuckDBStore();

  return (
    <div className="bg-darkNav w-64 flex flex-col h-full border-r border-white border-opacity-10">
      {/* Logo and title */}
      <div className="p-4 flex items-center border-b border-white border-opacity-10">
        <h1 className="text-white font-heading font-medium text-lg">DataKit</h1>
      </div>

      <div className="p-4 overflow-y-auto">
        <p className="text-sm text-white text-opacity-70 mb-4">
          Datakit leverages WebAssembly and DuckDB to process large datasets
          directly in your browser, without uploading your data to any server.
        </p>
      </div>

      {/* File Upload Section */}
      <div className="p-4">
        <FileUploadButton
          onFileSelect={(file) => {
            // Use processFile directly with the new file
            // This is cleaner than creating a fake FileAccessEntry
            return onDataLoad ? processFile(file, onDataLoad) : processFile(file);
          }}
          isLoading={isProcessing}
          className="w-full"
          supportLargeFiles={true}
        />

        {/* Loading Status */}
        {(isProcessing || loadingStatus) && (
          <div className="mt-3 text-xs">
            {loadingStatus && (
              <div className="text-white text-opacity-70 mb-1">
                {loadingStatus}
              </div>
            )}

            {isProcessing && (
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${duckDBProgress * 100}%` }}
                ></div>
              </div>
            )}

            {processingError && (
              <div className="text-red-400 mt-1">{processingError}</div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="mt-2 flex-1 overflow-auto">
        {/* Section Divider */}
        <div className="px-2 py-2 mt-2 w-full">
          <div className="border-t border-white border-opacity-10"></div>
        </div>

        {/* Recent Files */}
        <div className="px-4 py-2">
          <h3 className="text-xs font-medium text-white text-opacity-50 uppercase tracking-wider mb-2">
            Recent Files
          </h3>

          {recentFiles.length > 0 ? (
            <ul className="space-y-1">
              {recentFiles.slice(0, 5).map((file) => (
                <li key={file.name + file.lastAccessed}>
                  <button
                    onClick={() => handleRecentFileSelect(file, onDataLoad)}
                    disabled={isProcessing}
                    className="w-full text-left flex items-center p-1.5 rounded text-xs text-white text-opacity-80 hover:bg-background hover:bg-opacity-30"
                  >
                    <FileText size={12} className="mr-2 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-white text-opacity-60">
              No recent files
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="flex flex-col p-4">
        <ThemeColorPicker />
        <div className="flex items-center text-xs mt-4 text-white text-opacity-60">
          {/* <Database size={12} className="mr-1" /> */}
          <span>DuckDB</span>
          {duckDBError ? (
            <span className="ml-auto text-red-400">Error</span>
          ) : duckDBLoading ? (
            <span className="ml-auto">
              Loading ({Math.round(duckDBProgress * 100)}%)
            </span>
          ) : (
            <span className="ml-auto">Ready</span>
          )}
        </div>
      </div>
      <div className="p-4 border-t border-white border-opacity-10">
        <p className="text-xs text-white text-opacity-50">
          Powered by WebAssembly and DuckDB
          <br />
          <a
            href="https://amin.contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            by Amin
          </a>
          {" @ "}
          <a
            href="https://wavequery.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            WaveQuery
          </a>
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
