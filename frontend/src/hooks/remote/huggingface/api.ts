/**
 * @fileoverview Utilities for interacting with HuggingFace Hub API
 * @module HuggingFaceAPI
 */

import { 
    DatasetIdValidation, 
    AvailableFormat, 
    FormatDetectionResult,
    HFImportOptions 
  } from "./types";
  
  /**
   * HuggingFace API endpoints
   */
  export const HF_ENDPOINTS = {
    /** Main Hub API for dataset metadata */
    HUB_API: "https://huggingface.co/api/datasets",
    /** Dataset server API for file information */
    DATASETS_SERVER: "https://datasets-server.huggingface.co",
  } as const;
  
  /**
   * Validates and parses a HuggingFace dataset identifier
   * 
   * @param datasetId - Dataset ID to validate (e.g., "microsoft/DialoGPT-medium")
   * @returns Validation result with extracted components
   * 
   * @example
   * ```typescript
   * const result = parseDatasetId("microsoft/DialoGPT-medium");
   * if (result.isValid) {
   *   console.log(result.organization); // "microsoft"
   *   console.log(result.dataset);      // "DialoGPT-medium"
   * }
   * ```
   */
  export function parseDatasetId(datasetId: string): DatasetIdValidation {
    try {
      const trimmed = datasetId.trim();
  
      if (!trimmed) {
        return {
          isValid: false,
          error: "Dataset ID cannot be empty",
        };
      }
  
      // Remove any URL prefix if user pasted full URL
      let cleanId = trimmed;
      if (cleanId.includes("huggingface.co/datasets/")) {
        cleanId = cleanId.split("huggingface.co/datasets/")[1];
      }
  
      // Remove any trailing slashes or query params
      cleanId = cleanId.split("?")[0].replace(/\/$/, "");
  
      // Validate format: organization/dataset-name
      const parts = cleanId.split("/");
      if (parts.length !== 2) {
        return {
          isValid: false,
          error: "Dataset ID must be in format: organization/dataset-name",
        };
      }
  
      const [organization, dataset] = parts;
  
      if (!organization || !dataset) {
        return {
          isValid: false,
          error: "Both organization and dataset name are required",
        };
      }
  
      // Basic validation for valid characters
      const validPattern = /^[a-zA-Z0-9._-]+$/;
      if (!validPattern.test(organization) || !validPattern.test(dataset)) {
        return {
          isValid: false,
          error:
            "Dataset ID contains invalid characters. Use only letters, numbers, dots, hyphens, and underscores",
        };
      }
  
      return {
        isValid: true,
        organization,
        dataset,
      };
    } catch (err) {
      return {
        isValid: false,
        error: `Invalid dataset ID format: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      };
    }
  }
  
  /**
   * Fetches dataset metadata from HuggingFace Hub API
   * 
   * @param datasetId - Valid dataset identifier
   * @param authToken - Optional authentication token for private datasets
   * @returns Promise resolving to dataset metadata
   * @throws {Error} When dataset is not found, access denied, or authentication required
   * 
   * @example
   * ```typescript
   * try {
   *   const metadata = await getDatasetInfo("microsoft/DialoGPT-medium");
   *   console.log(metadata.description);
   * } catch (error) {
   *   console.error("Failed to fetch dataset:", error.message);
   * }
   * ```
   */
  export async function getDatasetInfo(
    datasetId: string, 
    authToken?: string
  ): Promise<any> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
  
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
  
    const response = await fetch(`${HF_ENDPOINTS.HUB_API}/${datasetId}`, {
      headers,
    });
  
    if (!response.ok) {
      switch (response.status) {
        case 401:
          throw new Error(
            "Authentication required. Please provide a valid HuggingFace token."
          );
        case 403:
          throw new Error(
            "Access denied. You may need authentication or the dataset may be private."
          );
        case 404:
          throw new Error("Dataset not found. Please check the dataset ID.");
        default:
          throw new Error(
            `Failed to fetch dataset info: ${response.status} ${response.statusText}`
          );
      }
    }
  
    return await response.json();
  }
  
  /**
   * Fetches available Parquet files for a dataset
   * 
   * @param datasetId - Valid dataset identifier
   * @param config - Dataset configuration name (default: "default")
   * @param authToken - Optional authentication token
   * @returns Promise resolving to Parquet file information
   * @throws {Error} When no Parquet files are found or access is denied
   * 
   * @example
   * ```typescript
   * const parquetInfo = await getParquetFiles("microsoft/DialoGPT-medium");
   * parquetInfo.parquet_files.forEach(file => {
   *   console.log(`Split: ${file.split}, URL: ${file.url}`);
   * });
   * ```
   */
  export async function getParquetFiles(
    datasetId: string,
    config: string = "default",
    authToken?: string
  ): Promise<any> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
  
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
  
    const url = `${HF_ENDPOINTS.DATASETS_SERVER}/parquet?dataset=${datasetId}&config=${config}`;
    const response = await fetch(url, { headers });
  
    if (!response.ok) {
      switch (response.status) {
        case 401:
          throw new Error("Authentication required for this dataset.");
        case 404:
          throw new Error(
            "No parquet files found for this dataset configuration."
          );
        default:
          throw new Error(
            `Failed to fetch parquet files: ${response.status} ${response.statusText}`
          );
      }
    }
  
    return await response.json();
  }
  
  /**
   * Detects all available file formats for a dataset
   * 
   * @param datasetId - Valid dataset identifier
   * @param authToken - Optional authentication token
   * @returns Promise resolving to format detection result
   * 
   * @example
   * ```typescript
   * const { formats, recommendedFormat } = await detectAvailableFormats("dataset/name");
   * console.log(`Recommended: ${recommendedFormat}`);
   * formats.forEach(format => {
   *   console.log(`${format.type}: ${format.url}`);
   * });
   * ```
   */
  export async function detectAvailableFormats(
    datasetId: string,
    authToken?: string
  ): Promise<FormatDetectionResult> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
  
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
  
    const formats: AvailableFormat[] = [];
  
    try {
      // First, try to get Parquet files (preferred format)
      const parquetResponse = await fetch(
        `${HF_ENDPOINTS.DATASETS_SERVER}/parquet?dataset=${datasetId}`,
        { headers }
      );
  
      if (parquetResponse.ok) {
        const parquetInfo = await parquetResponse.json();
        if (parquetInfo.parquet_files && parquetInfo.parquet_files.length > 0) {
          parquetInfo.parquet_files.forEach((file: any) => {
            formats.push({
              type: "parquet",
              url: file.url,
              size: file.size,
              split: file.split,
            });
          });
        }
      }
  
      // If no Parquet files found, try to get repository file tree
      if (formats.length === 0) {
        try {
          const repoResponse = await fetch(
            `https://huggingface.co/api/datasets/${datasetId}/tree/main`,
            { headers }
          );
  
          if (repoResponse.ok) {
            const repoFiles = await repoResponse.json();
            
            for (const file of repoFiles) {
              if (file.type === "file") {
                const ext = file.path.split(".").pop()?.toLowerCase();
                if (["csv", "json", "xlsx", "txt"].includes(ext || "")) {
                  formats.push({
                    type: ext as any,
                    url: `https://huggingface.co/datasets/${datasetId}/resolve/main/${file.path}`,
                    size: file.size,
                  });
                }
              }
            }
          }
        } catch (repoErr) {
          console.warn("Could not fetch repository files:", repoErr);
        }
      }
    } catch (err) {
      console.warn("Format detection failed:", err);
    }
  
    // Determine recommended format (priority: parquet > csv > json > others)
    const recommendedFormat =
      formats.find((f) => f.type === "parquet")?.type ||
      formats.find((f) => f.type === "csv")?.type ||
      formats.find((f) => f.type === "json")?.type ||
      formats[0]?.type ||
      "parquet";
  
    return { formats, recommendedFormat };
  }
  
  /**
   * Searches for datasets on HuggingFace Hub
   * 
   * @param query - Search query string
   * @param options - Search options including limit and auth token
   * @returns Promise resolving to search results
   * 
   * @example
   * ```typescript
   * const results = await searchDatasets("sentiment analysis", { limit: 10 });
   * results.forEach(dataset => {
   *   console.log(`${dataset.id}: ${dataset.description}`);
   * });
   * ```
   */
  export async function searchDatasets(
    query: string,
    options: { limit?: number; authToken?: string } = {}
  ): Promise<any[]> {
    try {
      const { limit = 10, authToken } = options;
  
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
  
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
  
      const searchParams = new URLSearchParams({
        search: query,
        limit: limit.toString(),
        filter: "dataset-type:parquet", // Prefer datasets with Parquet support
      });
  
      const response = await fetch(`${HF_ENDPOINTS.HUB_API}?${searchParams}`, {
        headers,
      });
  
      if (!response.ok) {
        throw new Error(
          `Search failed: ${response.status} ${response.statusText}`
        );
      }
  
      const results = await response.json();
      return results || [];
    } catch (err) {
      console.error("Dataset search failed:", err);
      return [];
    }
  }
  
  /**
   * Gets dataset splits and configurations
   * 
   * @param datasetId - Valid dataset identifier
   * @param authToken - Optional authentication token
   * @returns Promise resolving to splits information or null if unavailable
   * 
   * @example
   * ```typescript
   * const splits = await getDatasetSplits("dataset/name");
   * if (splits) {
   *   console.log("Available splits:", splits.splits);
   * }
   * ```
   */
  export async function getDatasetSplits(
    datasetId: string, 
    authToken?: string
  ): Promise<any> {
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
  
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
  
      const response = await fetch(
        `${HF_ENDPOINTS.DATASETS_SERVER}/splits?dataset=${datasetId}`,
        { headers }
      );
  
      if (!response.ok) {
        throw new Error(
          `Failed to fetch splits: ${response.status} ${response.statusText}`
        );
      }
  
      return await response.json();
    } catch (err) {
      console.warn("Failed to get dataset splits:", err);
      return null;
    }
  }
  
  /**
   * Tests if a dataset is accessible with current credentials
   * 
   * @param datasetId - Dataset identifier to test
   * @param authToken - Optional authentication token
   * @returns Promise resolving to boolean indicating accessibility
   * 
   * @example
   * ```typescript
   * const canAccess = await testDatasetAccess("private/dataset", "hf_token");
   * if (!canAccess) {
   *   console.log("Dataset requires authentication or doesn't exist");
   * }
   * ```
   */
  export async function testDatasetAccess(
    datasetId: string, 
    authToken?: string
  ): Promise<boolean> {
    try {
      const idValidation = parseDatasetId(datasetId);
      if (!idValidation.isValid) {
        return false;
      }
  
      await getDatasetInfo(datasetId, authToken);
      return true;
    } catch (err) {
      console.warn("Dataset access test failed:", err);
      return false;
    }
  }