import { useCallback } from "react";
import { useRemoteDatasetImport, DatasetImportOptions, DatasetProvider } from "../useRemoteDatasetImport";

export interface UrlImportOptions {
  organization: string;
  dataset: string;
  provider?: DatasetProvider;
  config?: string;
  split?: string;
  authToken?: string;
}

/**
 * Hook specifically for URL-based dataset imports
 * Handles URL parsing and provider detection
 */
export const useUrlDatasetImport = () => {
  const { importDataset, importDatasetFromUrl } = useRemoteDatasetImport();

  /**
   * Import dataset from URL parameters with automatic provider detection
   */
  const importFromUrlParams = useCallback(async (options: UrlImportOptions) => {
    // Default to HuggingFace if no provider specified
    const provider = options.provider || "huggingface";

    const importOptions: DatasetImportOptions = {
      provider,
      organization: options.organization,
      dataset: options.dataset,
      config: options.config,
      split: options.split,
      authToken: options.authToken
    };

    return await importDataset(importOptions);
  }, [importDataset]);

  /**
   * Import dataset from URL and navigate to home
   */
  const importFromUrlParamsWithNavigation = useCallback(async (options: UrlImportOptions) => {
    // Default to HuggingFace if no provider specified
    const provider = options.provider || "huggingface";

    const importOptions: DatasetImportOptions = {
      provider,
      organization: options.organization,
      dataset: options.dataset,
      config: options.config,
      split: options.split,
      authToken: options.authToken
    };

    return await importDatasetFromUrl(importOptions);
  }, [importDatasetFromUrl]);

  return {
    importFromUrlParams,
    importFromUrlParamsWithNavigation
  };
};