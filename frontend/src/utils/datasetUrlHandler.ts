import { DatasetImportOptions } from "@/hooks/remote/useRemoteDatasetImport";

/**
 * Utility functions for handling dataset URLs and conversions
 */

export interface ParsedDatasetUrl {
  provider: "huggingface" | "kaggle" | "github" | "custom";
  organization: string;
  dataset: string;
  config?: string;
  split?: string;
}

/**
 * Parse a dataset URL to extract components and detect provider
 * Supports formats:
 * - https://huggingface.co/datasets/organization/dataset
 * - https://huggingface.co/datasets/organization/dataset/viewer/config/split
 * - https://kaggle.com/datasets/organization/dataset
 * - https://github.com/organization/dataset
 */
export const parseDatasetUrl = (url: string): ParsedDatasetUrl | null => {
  try {
    const urlObj = new URL(url);
    
    // HuggingFace
    if (urlObj.hostname.includes('huggingface.co') && urlObj.pathname.includes('/datasets/')) {
      const pathParts = urlObj.pathname.split('/datasets/')[1]?.split('/') || [];
      
      if (pathParts.length < 2) {
        return null;
      }

      const [organization, dataset, ...rest] = pathParts;
      
      // Look for viewer/config/split pattern
      let config: string | undefined;
      let split: string | undefined;
      
      if (rest.length >= 3 && rest[0] === 'viewer') {
        config = rest[1];
        split = rest[2];
      }

      return {
        provider: "huggingface",
        organization,
        dataset,
        config,
        split
      };
    }

    // Kaggle
    if (urlObj.hostname.includes('kaggle.com') && urlObj.pathname.includes('/datasets/')) {
      const pathParts = urlObj.pathname.split('/datasets/')[1]?.split('/') || [];
      
      if (pathParts.length < 2) {
        return null;
      }

      const [organization, dataset] = pathParts;
      
      return {
        provider: "kaggle",
        organization,
        dataset
      };
    }

    // GitHub
    if (urlObj.hostname.includes('github.com')) {
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
      
      if (pathParts.length < 2) {
        return null;
      }

      const [organization, dataset] = pathParts;
      
      return {
        provider: "github",
        organization,
        dataset
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to parse dataset URL:', error);
    return null;
  }
};

// Keep the old function for backward compatibility
export const parseHuggingFaceUrl = parseDatasetUrl;


/**
 * Extract dataset import options from URL params
 */
export const extractImportOptionsFromUrl = (
  organization: string,
  dataset: string,
  searchParams: URLSearchParams
): DatasetImportOptions => {
  const provider = (searchParams.get('provider') as DatasetImportOptions['provider']) || 'huggingface';
  
  return {
    provider,
    organization,
    dataset,
    config: searchParams.get('config') || undefined,
    split: searchParams.get('split') || undefined,
    authToken: searchParams.get('token') || undefined
  };
};

/**
 * Generate DataKit URL for dataset import
 */
export const generateDatakitImportUrl = (options: DatasetImportOptions): string => {
  let url = `/datasets/${options.organization}/${options.dataset}`;
  
  const params = new URLSearchParams();
  if (options.config) {
    params.append('config', options.config);
  }
  if (options.split) {
    params.append('split', options.split);
  }
  if (options.authToken) {
    params.append('token', options.authToken);
  }
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  return url;
};