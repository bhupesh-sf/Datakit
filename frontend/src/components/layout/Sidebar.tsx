import React from "react";
import { FileText } from "lucide-react";
import { FileUploadButton } from "@/components/common/FileUploadButton";
import { ThemeColorPicker } from "@/components/common/ThemeColorPicker";
import useFileAccess from "@/hooks/useFileAccess";
import { useDuckDBStore } from "@/store/duckDBStore";
import useDirectFileImport from "@/hooks/useDirectFileImport";

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";

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
    handleRecentFileSelect,
    processFile,
    isProcessing,
    loadingStatus,
    processingError,
  } = useDirectFileImport();

  const {
    isLoading: duckDBLoading,
    processingProgress: duckDBProgress,
    error: duckDBError,
  } = useDuckDBStore();

  return (
    <div className="bg-darkNav w-64 flex flex-col h-full border-r border-white border-opacity-10">
      {/* Header with logo and title */}
      <div className="px-5 py-4 border-b border-white border-opacity-10 flex items-center">
        <h1 className="text-white font-heading font-medium text-lg">DataKit</h1>
      </div>

      {/* Introduction text */}
      <div className="px-5 py-4">
        <p className="text-sm text-white text-opacity-70">
          Datakit leverages WebAssembly to process large datasets
          directly in your browser, without uploading your data to any server.
        </p>
      </div>

      {/* File Upload section */}
      <div className="px-5 pt-2 pb-5">
        <FileUploadButton
          onFileSelect={(file) => {
            return onDataLoad ? processFile(file, onDataLoad) : processFile(file);
          }}
          isLoading={isProcessing}
          className="w-full"
          supportLargeFiles={true}
        />

        {/* Loading Status */}
        {(isProcessing || loadingStatus) && (
          <div className="mt-3 bg-background/30 p-3 border border-white/5">
            {loadingStatus && (
              <div className="text-xs font-medium text-white text-opacity-80 mb-2 flex items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 animate-pulse"></div>
                {loadingStatus}
              </div>
            )}

            {isProcessing && (
              <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, duckDBProgress * 100)}%` }}
                ></div>
              </div>
            )}

            {processingError && (
              <div className="text-destructive text-xs mt-2 p-2 rounded bg-background/50 border border-destructive/20">
                {processingError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="px-5">
        <div className="border-t border-white border-opacity-10"></div>
      </div>

      {/* Recent Files section */}
      <div className="px-5 py-3 flex-1 overflow-auto">
        <h3 className="text-xs font-medium text-white text-opacity-50 uppercase tracking-wider mb-3">
          Recent Files
        </h3>

        {recentFiles.length > 0 ? (
          <ul className="space-y-1">
            {recentFiles.slice(0, 5).map((file) => {
              // Determine file type styling
              const fileExt = file.name.split('.').pop()?.toLowerCase();
              const typeClasses = {
                csv: "text-primary",
                json: "text-secondary",
                xlsx: "text-tertiary",
                xls: "text-tertiary"
              }[fileExt || ""] || "text-white text-opacity-70";
              
              return (
                <li key={file.name + file.lastAccessed}>
                  <button
                    onClick={() => handleRecentFileSelect(file, onDataLoad)}
                    disabled={isProcessing}
                    className="w-full text-left flex items-center p-2 rounded text-xs text-white text-opacity-80 hover:bg-background hover:bg-opacity-30 transition-custom"
                  >
                    <FileText size={14} className={`${typeClasses} mr-2 flex-shrink-0`} />
                    <span className="truncate">{file.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-xs text-white text-opacity-60 p-3 text-center bg-background bg-opacity-20 rounded">
            No recent files
          </div>
        )}
      </div>

      {/* Footer area with ThemeColorPicker and status */}
      <div className="border-t border-white border-opacity-10">
        <div className="p-4 flex items-center justify-between">
          <ThemeColorPicker />
          
          <div className="h-6 w-px bg-white bg-opacity-10 mx-3"></div>
          
          <div className="flex items-center text-xs text-white text-opacity-60">
            <span>DuckDB:</span>
            {duckDBError ? (
              <span className="ml-1.5 text-destructive">Error</span>
            ) : duckDBLoading ? (
              <span className="ml-1.5 text-secondary">
                {Math.round(duckDBProgress * 100)}%
              </span>
            ) : (
              <span className="ml-1.5 text-primary">Ready</span>
            )}
          </div>
        </div>
        
        <div className="px-4 py-3 text-center border-t border-white border-opacity-5">
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
    </div>
  );
};

export default Sidebar;