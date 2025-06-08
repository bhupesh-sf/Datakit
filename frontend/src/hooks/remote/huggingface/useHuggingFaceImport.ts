import { useState, useCallback } from "react";
import { useDuckDBStore } from "@/store/duckDBStore";

import type { 
  HFImportResult, 
  HFImportOptions, 
  DatasetIdValidation,
  DatasetConfig,
  DatasetSplit 
} from "./types";

import { 
  parseDatasetId, 
  getDatasetInfo, 
  detectAvailableFormats, 
  searchDatasets as apiSearchDatasets,
  getDatasetSplits as apiGetDatasetSplits,
  testDatasetAccess as apiTestDatasetAccess
} from "./api";

import { 
  createImportStrategies, 
  executeStrategiesWithFallback,
  createStreamingView,
  importParquetDownload,
  validateDatasetCompatibility
} from "./importStrategies";

/**
 * Hook for importing datasets from HuggingFace Hub with config/split support
 */
export default function useHuggingFaceImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const duckDB = useDuckDBStore();

  /**
   * Updates import progress and status
   */
  const updateProgress = useCallback((progress: number, status: string) => {
    setImportProgress(progress);
    setImportStatus(status);
  }, []);

  /**
   * Resets error state
   */
  const resetError = useCallback(() => setError(null), []);

  /**
   *  Dataset ID validation with config/split support
   */
  const validateDatasetId = useCallback(
    (datasetId: string): DatasetIdValidation & { config?: string; split?: string } => {
      return parseDatasetId(datasetId);
    },
    []
  );

  /**
   * Test dataset access
   */
  const testDatasetAccess = useCallback(
    async (datasetId: string, authToken?: string): Promise<boolean> => {
      return apiTestDatasetAccess(datasetId, authToken);
    },
    []
  );

  /**
   * Dataset search
   */
  const searchDatasets = useCallback(
    async (
      query: string,
      options: { 
        limit?: number; 
        author?: string;
        authToken?: string;
        sort?: "lastModified" | "downloads" | "likes";
      } = {}
    ): Promise<any[]> => {
      return apiSearchDatasets(query, options);
    },
    []
  );

  /**
   * Get dataset splits and configurations
   */
  const getDatasetSplits = useCallback(
    async (
      datasetId: string,
      authToken?: string
    ): Promise<{
      splits: DatasetSplit[];
      configs: DatasetConfig[];
    }> => {
      return apiGetDatasetSplits(datasetId, authToken);
    },
    []
  );

  /**
   * Detect available formats
   */
  const detectAvailableFormatsHook = useCallback(
    async (
      datasetId: string,
      authToken?: string
    ): Promise<{
      formats: any[];
      recommendedFormat: string;
      availableConfigs: DatasetConfig[];
    }> => {
      return detectAvailableFormats(datasetId, authToken);
    },
    []
  );

  /**
   * Enhanced streaming import with config/split support
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

        // Parse and validate dataset ID
        const parsedId = parseDatasetId(datasetId);
        if (!parsedId.isValid) {
          throw new Error(parsedId.error || "Invalid dataset ID");
        }

        // Extract base dataset ID and resolve config/split
        const baseDatasetId = parsedId.organization 
          ? `${parsedId.organization}/${parsedId.dataset}`
          : parsedId.dataset;
        
        const targetConfig = options.config || parsedId.config || "default";
        const targetSplit = options.split || parsedId.split || "train";

        console.log(`[HFImport] Streaming import: ${baseDatasetId} (config: ${targetConfig}, split: ${targetSplit})`);
        updateProgress(0.1, "Getting dataset metadata...");

        // Get dataset info and available formats
        const datasetInfo = await getDatasetInfo(baseDatasetId, options.authToken);
        const { formats } = await detectAvailableFormats(baseDatasetId, options.authToken);

        updateProgress(0.3, "Testing direct streaming access...");

        // Find parquet format for the specific config/split
        const parquetFormat = formats.find(f => 
          f.type === "parquet" && 
          f.config === targetConfig && 
          f.split === targetSplit
        );
        
        if (!parquetFormat) {
          throw new Error(`No parquet format available for ${targetConfig}/${targetSplit}`);
        }

        updateProgress(0.5, "Creating streaming view...");

        // Create streaming view
        const result = await createStreamingView(
          duckDB,
          baseDatasetId,
          parquetFormat.url,
          {
            ...options,
            config: targetConfig,
            split: targetSplit,
            datasetInfo,
            formats,
          }
        );

        const enhancedResult: HFImportResult = {
          ...result,
          huggingface: {
            ...result.huggingface,
            config: targetConfig,
            split: targetSplit,
          }
        };

        updateProgress(1.0, "Successfully connected via direct streaming");
        console.log(`[HFImport] ✅ Streaming view created: ${result.tableName}`);
        
        return enhancedResult;

      } catch (err) {
        console.error("[HFImport] Streaming import failed:", err);
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
   * Download import with config/split support
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

        // Parse and validate dataset ID
        const parsedId = parseDatasetId(datasetId);
        if (!parsedId.isValid) {
          throw new Error(parsedId.error || "Invalid dataset ID");
        }

        // Extract base dataset ID and resolve config/split
        const baseDatasetId = parsedId.organization 
          ? `${parsedId.organization}/${parsedId.dataset}`
          : parsedId.dataset;
        
        const targetConfig = options.config || parsedId.config || "default";
        const targetSplit = options.split || parsedId.split || "train";

        console.log(`[HFImport] Download import: ${baseDatasetId} (config: ${targetConfig}, split: ${targetSplit})`);
        updateProgress(0.2, "Starting parquet download...");

        // Use enhanced parquet download strategy with config/split
        const enhancedOptions: HFImportOptions = {
          ...options,
          config: targetConfig,
          split: targetSplit,
        };

        const result = await importParquetDownload(duckDB, baseDatasetId, enhancedOptions);

        // Enhance result with config/split info
        const enhancedResult: HFImportResult = {
          ...result,
          huggingface: {
            ...result.huggingface,
            config: targetConfig,
            split: targetSplit,
          }
        };

        updateProgress(1.0, `Successfully imported ${result.rowCount.toLocaleString()} rows`);
        console.log(`[HFImport] ✅ Download import completed: ${result.tableName}`);
        
        return enhancedResult;

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
   * Progressive fallback import with config/split support
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

        // Parse and validate dataset ID
        const parsedId = parseDatasetId(datasetId);
        if (!parsedId.isValid) {
          throw new Error(parsedId.error || "Invalid dataset ID");
        }

        // Extract base dataset ID and resolve config/split
        const baseDatasetId = parsedId.organization 
          ? `${parsedId.organization}/${parsedId.dataset}`
          : parsedId.dataset;
        
        const targetConfig = options.config || parsedId.config;
        const targetSplit = options.split || parsedId.split;

        console.log(`[HFImport] Progressive fallback import: ${baseDatasetId}`);
        if (targetConfig) {
          console.log(`[HFImport] Target config: ${targetConfig}`);
        }
        if (targetSplit) {
          console.log(`[HFImport] Target split: ${targetSplit}`);
        }

        updateProgress(0.1, "Analyzing dataset compatibility...");

        // Check dataset compatibility
        const compatibility = await validateDatasetCompatibility(baseDatasetId, options.authToken);
        if (!compatibility.isCompatible) {
          throw new Error(compatibility.reason || "Dataset not compatible");
        }

        updateProgress(0.2, "Creating import strategies...");

        // Create enhanced import strategies with config/split support
        const enhancedOptions: HFImportOptions = {
          ...options,
          config: targetConfig,
          split: targetSplit,
        };
        console.log('enhancedOptions', enhancedOptions);
        const strategies = await createImportStrategies(duckDB, baseDatasetId, enhancedOptions);
        
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

        // Enhance result with config/split info
        const enhancedResult: HFImportResult = {
          ...result,
          huggingface: {
            ...result.huggingface,
            config: targetConfig || result.huggingface.config || "default",
            split: targetSplit || result.huggingface.split || "train",
          }
        };

        updateProgress(1.0, `Successfully imported via ${result.huggingface.method} method`);
        console.log(`[HFImport] ✅ Progressive fallback completed: ${result.tableName}`);
        
        return enhancedResult;

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

    importFromHuggingFace,
    importFromHuggingFaceStreaming,
    importWithProgressiveFallback,

    validateDatasetId,
    testDatasetAccess,
    searchDatasets,
    getDatasetSplits,
    detectAvailableFormats: detectAvailableFormatsHook,

    resetError,
  };
}