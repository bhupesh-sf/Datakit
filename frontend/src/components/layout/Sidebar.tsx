import React from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  // FileUp,
  ExternalLink,
} from "lucide-react";
import { FileUploadButton } from "@/components/common/FileUploadButton";
import { ThemeColorPicker } from "@/components/common/ThemeColorPicker";
import { RemoteFileImport } from "@/components/common/RemoteFileImport";
import useFileAccess from "@/hooks/useFileAccess";
import { useDuckDBStore } from "@/store/duckDBStore";
import useDirectFileImport from "@/hooks/useDirectFileImport";
import { useAppStore } from "@/store/appStore";
import { motion, AnimatePresence } from "framer-motion";
// import { Tooltip } from "@/components/ui/Tooltip";
import usePopover from "@/hooks/usePopover";

import useRemoteFileImport, {
  RemoteSourceProvider,
} from "@/hooks/useRemoteFileImport";

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
  isRemote?: boolean;
  remoteURL?: string;
  remoteProvider?: RemoteSourceProvider;
}

interface SidebarProps {
  onDataLoad?: (result: DataLoadWithDuckDBResult) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onDataLoad }) => {
  const { recentFiles } = useFileAccess();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  // Use our custom hook for the upload popover
  const uploadPopover = usePopover();

  // Local file import hooks
  const {
    handleRecentFileSelect,
    processFile,
    isProcessing: isProcessingLocalFile,
    loadingStatus: localFileLoadingStatus,
    processingError: localFileProcessingError,
  } = useDirectFileImport();

  // Remote file import hooks
  const {
    importFromURL,
    isImporting: isProcessingRemoteFile,
    importStatus: remoteFileImportStatus,
    error: remoteFileImportError,
  } = useRemoteFileImport();

  // DuckDB store
  const {
    isLoading: duckDBLoading,
    processingProgress: duckDBProgress,
    error: duckDBError,
  } = useDuckDBStore();

  // Handle remote file import
  const handleURLSubmit = async (
    url: string,
    provider: RemoteSourceProvider
  ) => {
    if (!onDataLoad) return;

    try {
      const result = await importFromURL(url, provider);

      if (result) {
        onDataLoad({
          ...result,
          isRemote: true,
          remoteURL: url,
          remoteProvider: provider,
        });
      }
    } catch (error) {
      console.error("Error importing remote file:", error);
    }
  };

  // Determine if any loading state is active
  const isLoading =
    isProcessingLocalFile || isProcessingRemoteFile || duckDBLoading;

  // Determine current loading status message
  const loadingStatus = remoteFileImportStatus || localFileLoadingStatus;

  // Determine current error message
  const errorMessage =
    remoteFileImportError || localFileProcessingError || duckDBError;

  // Variants for framer-motion animations
  const sidebarVariants = {
    expanded: { width: "16rem" }, // w-64 = 16rem
    collapsed: { width: "4rem" }, // mini sidebar width
  };

  // File upload popup for collapsed mode
  const renderFileUploadPopup = () => (
    <div className="absolute left-16 top-0 bg-darkNav rounded-lg shadow-lg border border-white/10 p-3 w-64">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-white mb-1">Upload File</h3>
        <p className="text-xs text-white/70">
          Import your data file for analysis
        </p>
      </div>

      <FileUploadButton
        onFileSelect={(file) => {
          uploadPopover.close();
          return onDataLoad ? processFile(file, onDataLoad) : processFile(file);
        }}
        isLoading={isProcessingLocalFile}
        className="w-full"
        supportLargeFiles={true}
      />

      {(isLoading || loadingStatus) && (
        <div className="mt-3 bg-background/30 p-2 border border-white/5 rounded-md">
          {loadingStatus && (
            <div className="text-xs font-medium text-white text-opacity-80 mb-2 flex items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 animate-pulse"></div>
              {loadingStatus}
            </div>
          )}

          {isLoading && (
            <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, duckDBProgress * 100)}%` }}
              ></div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Define what to show in collapsed mode - only icons with functionality
  const renderCollapsedContent = () => (
    <>
      <div className="p-4 flex justify-center border-b border-white/10">
        {/* TODO: Figuring out what's wrong here? */}
        {/* <Tooltip content="Expand sidebar"> */}
        <button
          onClick={toggleSidebar}
          className="text-white text-opacity-70 hover:text-opacity-100 transition-custom p-1 cursor-pointer hover:bg-white/5 rounded"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>
        {/* </Tooltip> */}
      </div>

      <div className="flex flex-col items-center gap-4 p-2 mt-2">
        {/* File Upload Button with Dropdown */}
        <div className="relative" ref={uploadPopover.ref}>
          {/* <Tooltip content="Upload File">
            <button
              onClick={uploadPopover.toggle}
              className="p-2 hover:bg-background hover:bg-opacity-30 rounded transition-custom text-white text-opacity-70 hover:text-primary"
              aria-label="Upload File"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <FileUp size={20} />
              )}
            </button>
          </Tooltip> */}

          <AnimatePresence>
            {uploadPopover.isOpen && (
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.2 }}
              >
                <>{renderFileUploadPopup()}</>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-auto p-4 flex flex-col items-center gap-4 border-t border-white/10">
        {/* External Links */}
        {/* <Tooltip content="Made by Amin"> */}
        <a
          href="https://amin.contact"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary-foreground transition-custom p-2 hover:bg-background hover:bg-opacity-30 rounded"
          aria-label="Visit WaveQuery"
        >
          <ExternalLink size={16} />
        </a>
        {/* </Tooltip> */}
      </div>
    </>
  );

  // Define expanded sidebar content
  const renderExpandedContent = () => (
    <>
      {/* Header with logo and title */}
      <div className="px-5 py-4 border-b border-white border-opacity-10 flex items-center justify-between">
        <h1 className="text-white font-heading font-medium text-lg">DataKit</h1>
        <button
          onClick={toggleSidebar}
          className="text-white text-opacity-70 hover:text-opacity-100 transition-custom p-1 cursor-pointer hover:bg-white/5 rounded"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Introduction text */}
      <div className="px-5 py-4">
        <p className="text-sm text-white text-opacity-70">
          Datakit leverages WebAssembly to process large datasets directly in
          your browser, without uploading your data to any server.
        </p>
      </div>

      {/* File Upload section */}
      <div className="px-5 pt-2 pb-2">
        <FileUploadButton
          onFileSelect={(file) => {
            return onDataLoad
              ? processFile(file, onDataLoad)
              : processFile(file);
          }}
          isLoading={isProcessingLocalFile}
          className="w-full"
          supportLargeFiles={true}
        />

        <div className="mt-2 mb-2 flex items-center">
          <div className="w-8 text-center">
            <span className="text-xs font-medium text-white/40">OR</span>
          </div>
          <div className="flex-1">
            <RemoteFileImport
              disabled={true}
              onURLSubmit={handleURLSubmit}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Loading Status - Combined for both local and remote */}
        {(isLoading || loadingStatus) && (
          <div className="mt-3 bg-background/30 p-3 border border-white/5 rounded-md">
            {loadingStatus && (
              <div className="text-xs font-medium text-white text-opacity-80 mb-2 flex items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 animate-pulse"></div>
                {loadingStatus}
              </div>
            )}

            {isLoading && (
              <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, duckDBProgress * 100)}%` }}
                ></div>
              </div>
            )}

            {errorMessage && (
              <div className="text-destructive text-xs mt-2 p-2 rounded bg-background/50 border border-destructive/20">
                {errorMessage}
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
        <h3 className="text-xs font-medium text-white text-opacity-50 tracking-wider mb-3">
          <span className="flex items-center">
            <span className="uppercase">Recent Files</span>
            <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded ml-1.5">
              from localStorage
            </span>
          </span>
        </h3>

        {recentFiles.length > 0 ? (
          <ul className="space-y-1">
            {recentFiles.slice(0, 5).map((file) => {
              // Determine file type styling
              const fileExt = file.name.split(".").pop()?.toLowerCase();
              const typeClasses =
                {
                  csv: "text-primary",
                  json: "text-secondary",
                  xlsx: "text-tertiary",
                  xls: "text-tertiary",
                  parquet: "text-violet-400",
                }[fileExt || ""] || "text-white text-opacity-70";

              return (
                <li key={file.name + file.lastAccessed}>
                  <button
                    // TODO:
                    // onClick={() => handleRecentFileSelect?.(file, onDataLoad)}
                    disabled={isLoading}
                    className="w-full text-left flex items-center p-2 rounded text-xs text-white text-opacity-80 hover:bg-background hover:bg-opacity-30 transition-custom"
                  >
                    <FileText
                      size={14}
                      className={`${typeClasses} mr-2 flex-shrink-0`}
                    />
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
    </>
  );

  return (
    <motion.div
      className="bg-darkNav flex flex-col h-full border-r border-white border-opacity-10 overflow-hidden"
      initial={sidebarCollapsed ? "collapsed" : "expanded"}
      animate={sidebarCollapsed ? "collapsed" : "expanded"}
      variants={sidebarVariants}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {sidebarCollapsed ? renderCollapsedContent() : renderExpandedContent()}
    </motion.div>
  );
};

export default Sidebar;
