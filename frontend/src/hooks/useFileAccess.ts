import { useState, useEffect, useCallback } from "react";

export interface FileAccessEntry {
  name: string;
  size: number;
  type: string; // 'csv', 'json', etc.
  lastAccessed: number; // timestamp
  handle?: FileSystemFileHandle; // Will be undefined in browsers without File System Access API
}

export function useFileAccess() {
  const [recentFiles, setRecentFiles] = useState<FileAccessEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load recent files from localStorage on component mount
  useEffect(() => {
    try {
      const storedFiles = localStorage.getItem("datakit_recent_files");
      if (storedFiles) {
        // Parse the stored files - remove handle which can't be serialized
        const parsedFiles = JSON.parse(storedFiles) as FileAccessEntry[];
        setRecentFiles(parsedFiles);
      }
    } catch (err) {
      console.error("Failed to load recent files:", err);
    }
  }, []);

  // Update localStorage when recentFiles changes
  useEffect(() => {
    if (recentFiles.length > 0) {
      try {
        // Store files without handle property
        const storable = recentFiles.map(({ handle, ...rest }) => rest);
        localStorage.setItem("datakit_recent_files", JSON.stringify(storable));
      } catch (err) {
        console.error("Failed to save recent files:", err);
      }
    }
  }, [recentFiles]);

  // Add a file to recent files list
  const addRecentFile = useCallback(
    (file: File, handle?: FileSystemFileHandle) => {
      const fileType = file.name.split(".").pop()?.toLowerCase() || "";

      const newEntry: FileAccessEntry = {
        name: file.name,
        size: file.size,
        type: fileType,
        lastAccessed: Date.now(),
        handle,
      };

      setRecentFiles((prev) => {
        // Add to the beginning, remove duplicates, keep only the 10 most recent
        const filtered = prev.filter((f) => f.name !== file.name);
        return [newEntry, ...filtered].slice(0, 10);
      });

      return newEntry;
    },
    []
  );

  const requestFileHandle = useCallback(async (): Promise<{
    handle: FileSystemFileHandle;
    file: File;
  } | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if File System Access API is supported
      if (!("showOpenFilePicker" in window)) {
        throw new Error("File System Access API not supported");
      }

      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Data Files",
            accept: {
              "text/csv": [".csv"],
              "application/json": [".json"],
              "application/vnd.apache.parquet": [".parquet"],
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              "application/vnd.ms-excel": [".xls"],
              "text/plain": [".txt"],
            },
          },
        ],
        multiple: false,
      });

      // Only get file for metadata, not for processing
      const file = await fileHandle.getFile();
      addRecentFile(file, fileHandle);
      setIsLoading(false);
      return { handle: fileHandle, file };
    } catch (err) {
      // Don't show error if user cancelled
      if (err instanceof Error && err.name === "AbortError") {
        setIsLoading(false);
        return null;
      }

      const errorMessage =
        err instanceof Error ? err.message : "Unknown error accessing file";
      setError(errorMessage);
      console.error("Error accessing file:", err);
      setIsLoading(false);
      return null;
    }
  }, [addRecentFile]);

  // Request file using File System Access API (legacy method)
  const requestFile = useCallback(async (): Promise<File | null> => {
    const result = await requestFileHandle();
    return result?.file || null;
  }, [requestFileHandle]);

  // Get file streams for efficient processing
  const getFileStream = useCallback(
    async (file: File): Promise<ReadableStream<Uint8Array>> => {
      try {
        return file.stream();
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unknown error getting file stream";
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  // Get file stream from a file handle (if available)
  const getStreamFromHandle = useCallback(
    async (
      fileHandle: FileSystemFileHandle
    ): Promise<ReadableStream<Uint8Array> | null> => {
      try {
        const file = await fileHandle.getFile();
        return file.stream();
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unknown error getting file from handle";
        setError(errorMessage);
        console.error("Error getting file from handle:", err);
        return null;
      }
    },
    []
  );

  // 🆕 NEW: Get file handle from recent files
  const getRecentFileHandle = useCallback(
    async (fileEntry: FileAccessEntry): Promise<{
      handle: FileSystemFileHandle;
      file: File;
    } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        if (fileEntry.handle) {
          // Get a fresh file object from the handle for metadata
          const file = await fileEntry.handle.getFile();

          // Update last accessed time
          setRecentFiles((prev) =>
            prev.map((f) =>
              f.name === fileEntry.name ? { ...f, lastAccessed: Date.now() } : f
            )
          );

          setIsLoading(false);
          return { handle: fileEntry.handle, file };
        } else {
          throw new Error(
            "File is no longer accessible. Please bring it again."
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unknown error opening recent file";
        setError(errorMessage);
        console.error("Error opening recent file:", err);
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  const openRecentFile = useCallback(
    async (fileEntry: FileAccessEntry): Promise<File | null> => {
      const result = await getRecentFileHandle(fileEntry);
      return result?.file || null;
    },
    [getRecentFileHandle]
  );

  // Clear recent files list
  const clearRecentFiles = useCallback(() => {
    setRecentFiles([]);
    localStorage.removeItem("datakit_recent_files");
  }, []);

  return {
    recentFiles,
    isLoading,
    error,
    addRecentFile,
    requestFile,
    requestFileHandle,
    getFileStream,
    getStreamFromHandle,
    openRecentFile,
    getRecentFileHandle,
    clearRecentFiles,
  };
}

export default useFileAccess;