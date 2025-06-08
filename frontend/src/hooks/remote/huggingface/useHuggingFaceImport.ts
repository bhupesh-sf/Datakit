import { useState, useCallback } from "react";
import { useDuckDBStore } from "@/store/duckDBStore";

// Import modular utilities
import type { 
  HFImportResult, 
  HFImportOptions, 
  DatasetIdValidation 
} from "./types";
import { 
  parseDatasetId, 
  getDatasetInfo, 
  detectAvailableFormats, 
  searchDatasets as apiSearchDatasets,
  getDatasetSplits,
  testDatasetAccess as apiTestDatasetAccess
} from "./api";
import { 
  createImportStrategies, 
  executeStrategiesWithFallback,
  createStreamingView,
  importParquetDownload,
  validateDatasetCompatibility
} from "./importStrategies";
// import { monitorMemoryUsage } from "./memory";

/**
 * Hook for importing datasets from HuggingFace Hub with modular, well-documented utilities
 * 
 * @returns Object containing import functions, state, and utilities
 * 
 * @example
 * ```typescript
 * const {
 *   importWithProgressiveFallback,
 *   isImporting,
 *   importStatus,
 *   error
 * } = useHuggingFaceImport();
 * 
 * try {
 *   const result = await importWithProgressiveFallback("microsoft/DialoGPT-medium");
 *   console.log(`Imported ${result.rowCount} rows`);
 * } catch (error) {
 *   console.error("Import failed:", error);
 * }
 * ```
 */
export default function useHuggingFaceImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const duckDB = useDuckDBStore();

  /**
   * Updates import progress and status
   * 
   * @internal
   * @param progress - Progress value between 0 and 1
   * @param status - Current status message
   */
  const updateProgress = useCallback((progress: number, status: string) => {
    setImportProgress(progress);
    setImportStatus(status);
  }, []);

  /**
   * Resets error state
   * 
   * @example
   * ```typescript
   * const { resetError } = useHuggingFaceImport();
   * resetError(); // Clear any existing errors
   * ```
   */
  const resetError = useCallback(() => setError(null), []);

  /**
   * Validates a HuggingFace dataset ID format
   * 
   * @param datasetId - Dataset ID to validate (e.g., "microsoft/DialoGPT-medium")
   * @returns Validation result with extracted components
   * 
   * @example
   * ```typescript
   * const { validateDatasetId } = useHuggingFaceImport();
   * const result = validateDatasetId("microsoft/DialoGPT-medium");
   * 
   * if (result.isValid) {
   *   console.log(result.organization); // "microsoft"
   *   console.log(result.dataset);      // "DialoGPT-medium"
   * } else {
   *   console.error(result.error);
   * }
   * ```
   */
  const validateDatasetId = useCallback(
    (datasetId: string): DatasetIdValidation => parseDatasetId(datasetId),
    []
  );

  /**
   * Tests if a dataset is accessible with current credentials
   * 
   * @param datasetId - Dataset identifier to test
   * @param authToken - Optional authentication token
   * @returns Promise resolving to boolean indicating accessibility
   * 
   * @example
   * ```typescript
   * const { testDatasetAccess } = useHuggingFaceImport();
   * const canAccess = await testDatasetAccess("private/dataset", "hf_token");
   * ```
   */
  const testDatasetAccess = useCallback(
    async (datasetId: string, authToken?: string): Promise<boolean> => {
      return apiTestDatasetAccess(datasetId, authToken);
    },
    []
  );

  /**
   * Searches for datasets on HuggingFace Hub
   * 
   * @param query - Search query string
   * @param options - Search options including limit and auth token
   * @returns Promise resolving to search results
   * 
   * @example
   * ```typescript
   * const { searchDatasets } = useHuggingFaceImport();
   * const results = await searchDatasets("sentiment analysis", { limit: 10 });
   * ```
   */
  const searchDatasets = useCallback(
    async (
      query: string,
      options: { limit?: number; authToken?: string } = {}
    ): Promise<any[]> => {
      return apiSearchDatasets(query, options);
    },
    []
  );

  /**
   * Imports dataset using direct streaming (fastest method)
   * 
   * @param datasetId - HuggingFace dataset identifier
   * @param options - Import configuration options
   * @returns Promise resolving to import result
   * @throws {Error} When streaming is not supported or fails
   * 
   * @example
   * ```typescript
   * const { importFromHuggingFaceStreaming } = useHuggingFaceImport();
   * 
   * try {
   *   const result = await importFromHuggingFaceStreaming("microsoft/DialoGPT-medium");
   *   console.log(`Streaming view created with ${result.rowCount} rows`);
   * } catch (error) {
   *   console.log("Streaming failed, try download method");
   * }
   * ```
   */
  const importFromHuggingFaceStreaming = useCallback(
    async (
      datasetId: string,
      options: HFImportOptions = {}
    ): Promise<HFImportResult> => {
      try {
        setIsImporting(true);
        setError(null);
        updateProgress(0, "Validating dataset ID...");

        // Validate dataset ID
        const idValidation = parseDatasetId(datasetId);
        if (!idValidation.isValid) {
          throw new Error(idValidation.error || "Invalid dataset ID");
        }

        console.log(`[HFImport] Streaming import: ${datasetId}`);
        updateProgress(0.1, "Getting dataset metadata...");

        // Get dataset info and available formats
        const datasetInfo = await getDatasetInfo(datasetId, options.authToken);
        const { formats } = await detectAvailableFormats(datasetId, options.authToken);

        updateProgress(0.3, "Testing direct streaming access...");

        // Find parquet format for streaming
        const parquetFormat = formats.find(f => f.type === "parquet");
        if (!parquetFormat) {
          throw new Error("No parquet format available for streaming");
        }

        updateProgress(0.5, "Creating streaming view...");

        // Create streaming view
        const result = await createStreamingView(
          duckDB,
          datasetId,
          parquetFormat.url,
          {
            ...options,
            split: parquetFormat.split,
            datasetInfo,
            formats,
          }
        );

        updateProgress(1.0, "Successfully connected via direct streaming");
        console.log(`[HFImport] ✅ Streaming view created: ${result.tableName}`);
        
        return result;

      } catch (err) {
        console.error("[HFImport] Streaming import failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setIsImporting(false);
        // Reset progress after delay
        setTimeout(() => {
          setImportProgress(0);
          setImportStatus("");
        }, 2000);
      }
    },
    [duckDB, updateProgress]
  );

  /**
   * Imports dataset using standard download method (most reliable)
   * 
   * @param datasetId - HuggingFace dataset identifier
   * @param options - Import configuration options
   * @returns Promise resolving to import result
   * 
   * @example
   * ```typescript
   * const { importFromHuggingFace } = useHuggingFaceImport();
   * const result = await importFromHuggingFace("microsoft/DialoGPT-medium");
   * console.log(`Downloaded and imported ${result.rowCount} rows`);
   * ```
   */
  const importFromHuggingFace = useCallback(
    async (
      datasetId: string,
      options: HFImportOptions = {}
    ): Promise<HFImportResult> => {
      try {
        setIsImporting(true);
        setError(null);
        updateProgress(0, "Validating dataset ID...");

        // Validate dataset ID
        const idValidation = parseDatasetId(datasetId);
        if (!idValidation.isValid) {
          throw new Error(idValidation.error || "Invalid dataset ID");
        }

        console.log(`[HFImport] Download import: ${datasetId}`);
        updateProgress(0.2, "Starting parquet download...");

        // Use parquet download strategy
        const result = await importParquetDownload(duckDB, datasetId, options);

        updateProgress(1.0, `Successfully imported ${result.rowCount.toLocaleString()} rows`);
        console.log(`[HFImport] ✅ Download import completed: ${result.tableName}`);
        
        return result;

      } catch (err) {
        console.error("[HFImport] Download import failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setIsImporting(false);
        setTimeout(() => {
          setImportProgress(0);
          setImportStatus("");
        }, 2000);
      }
    },
    [duckDB, updateProgress]
  );

  /**
   * Imports dataset using progressive fallback strategies (recommended)
   * 
   * Tries multiple import methods in order of preference:
   * 1. Direct Streaming (fastest)
   * 2. Parquet Download (reliable)
   * 3. Alternative Formats (CSV/JSON fallback)
   * 
   * @param datasetId - HuggingFace dataset identifier
   * @param options - Import configuration options
   * @returns Promise resolving to import result
   * 
   * @example
   * ```typescript
   * const { importWithProgressiveFallback } = useHuggingFaceImport();
   * 
   * // This will automatically try the best available method
   * const result = await importWithProgressiveFallback("microsoft/DialoGPT-medium", {
   *   authToken: "hf_your_token",
   *   preferredFormat: "auto"
   * });
   * 
   * console.log(`Import successful: ${result.huggingface.method} method used`);
   * ```
   */
  const importWithProgressiveFallback = useCallback(
    async (
      datasetId: string,
      options: HFImportOptions = {}
    ): Promise<HFImportResult> => {
      try {
        setIsImporting(true);
        setError(null);
        updateProgress(0, "Validating dataset ID...");

        // Validate dataset ID
        const idValidation = parseDatasetId(datasetId);
        if (!idValidation.isValid) {
          throw new Error(idValidation.error || "Invalid dataset ID");
        }

        console.log(`[HFImport] Progressive fallback import: ${datasetId}`);
        updateProgress(0.1, "Analyzing dataset compatibility...");

        // Check dataset compatibility and memory safety
        const compatibility = await validateDatasetCompatibility(datasetId, options.authToken);
        if (!compatibility.isCompatible) {
          throw new Error(compatibility.reason || "Dataset not compatible");
        }

        updateProgress(0.2, "Creating import strategies...");

        // Create and execute strategies
        const strategies = await createImportStrategies(duckDB, datasetId, options);
        
        updateProgress(0.3, "Executing import strategies...");

        const result = await executeStrategiesWithFallback(
          strategies,
          (strategyName) => {
            updateProgress(0.4, `Trying ${strategyName}...`);
          },
          (strategyName, error) => {
            console.warn(`[HFImport] ${strategyName} failed:`, error.message);
            updateProgress(0.5, `${strategyName} failed, trying next method...`);
          }
        );

        updateProgress(1.0, `Successfully imported via ${result.huggingface.method} method`);
        console.log(`[HFImport] ✅ Progressive fallback completed: ${result.tableName}`);
        
        return result;

      } catch (err) {
        console.error("[HFImport] Progressive fallback failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setIsImporting(false);
        setTimeout(() => {
          setImportProgress(0);
          setImportStatus("");
        }, 2000);
      }
    },
    [duckDB, updateProgress]
  );

  return {
    // State
    isImporting,
    importProgress,
    importStatus,
    error,

    // Core import methods
    importFromHuggingFace,
    importFromHuggingFaceStreaming,
    importWithProgressiveFallback,

    // Utility methods
    validateDatasetId,
    testDatasetAccess,
    searchDatasets,
    getDatasetSplits,
    detectAvailableFormats,

    // Error handling
    resetError,
  };
}