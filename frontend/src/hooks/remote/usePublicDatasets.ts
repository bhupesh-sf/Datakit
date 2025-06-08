import { useState, useCallback } from "react";

import { S3_PUBLIC_DATASETS, GITHUB_PUBLIC_DATASETS, HUGGINGFACE_PUBLIC_DATASETS } from '@/constants/public_datasets';
import { PublicDataset } from "@/types/remoteImport";

import { searchDatasets as hfSearchDatasets } from "@/hooks/remote/huggingface/api";

// All datasets combined
const ALL_DATASETS = [...S3_PUBLIC_DATASETS, ...GITHUB_PUBLIC_DATASETS, ...HUGGINGFACE_PUBLIC_DATASETS];

/**
 * Hook for managing public datasets across multiple providers
 */
export default function usePublicDatasets(provider?: "aws" | "github" | "custom-url" | "huggingface" | "all") {
  const [datasets, setDatasets] = useState<PublicDataset[]>([]);
  const [searchResults, setSearchResults] = useState<PublicDataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch datasets based on provider
   */
  const fetchDatasets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let filteredDatasets: PublicDataset[] = [];

      // Filter by provider
      switch (provider) {
        case "aws":
          filteredDatasets = S3_PUBLIC_DATASETS;
          break;
        case "github":
          filteredDatasets = GITHUB_PUBLIC_DATASETS;
          break;
        case "custom-url":
          filteredDatasets = GITHUB_PUBLIC_DATASETS; // For now, show GitHub datasets as examples
          break;
        case "huggingface": // New case for HuggingFace
          filteredDatasets = HUGGINGFACE_PUBLIC_DATASETS;
          break;
        case "all":
        default:
          filteredDatasets = ALL_DATASETS;
          break;
      }

      // Sort by: featured first, then provider, then name
      filteredDatasets.sort((a, b) => {
        // Featured status
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;

        // Provider (huggingface first, then aws, then github)
        if (a.provider !== b.provider) {
          const providerOrder = { huggingface: 0, aws: 1, github: 2, gcs: 3, direct: 4 };
          return providerOrder[a.provider] - providerOrder[b.provider];
        }

        // Name
        return a.name.localeCompare(b.name);
      });

      setDatasets(filteredDatasets);
      console.log(
        `[PublicDatasets] Loaded ${filteredDatasets.length} datasets for provider: ${provider}`
      );
    } catch (err) {
      console.error("[PublicDatasets] Failed to fetch datasets:", err);
      setError("Failed to load datasets. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [provider]);

  /**
   * Search datasets
   */
  const searchDatasets = useCallback(async (query: string, options: {
    authToken?: string;
    limit?: number;
    author?: string;
  } = {}) => {
    try {
      setIsSearching(true);
      setError(null);

      if (provider === "huggingface") {
        const apiResults = await hfSearchDatasets(query, {
          limit: options.limit || 20,
          author: options.author,
          authToken: options.authToken,
          sort: "downloads",
          direction: "desc",
        });
  
        const transformedResults = apiResults.map(dataset => ({
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          downloads: dataset.downloads,
          likes: dataset.likes,
          lastModified: dataset.lastModified,
          size: dataset.size,
        }));

        setSearchResults(transformedResults);

        // If no API results, fall back to local search as backup
        if (transformedResults.length === 0) {
          console.log(`[PublicDatasets] 🔄 No API results, falling back to local search...`);
          const localResults = HUGGINGFACE_PUBLIC_DATASETS.filter(dataset =>
            dataset.name.toLowerCase().includes(query.toLowerCase()) ||
            dataset.description.toLowerCase().includes(query.toLowerCase()) ||
            dataset.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
          );
          setSearchResults(localResults);
          console.log(`[PublicDatasets] 📂 Found ${localResults.length} local results as fallback`);
        }

      } else {
        // Regular search for other providers
        const lowercaseQuery = query.toLowerCase();
        const currentDatasets = provider === "all" ? ALL_DATASETS : datasets;
        const results = currentDatasets.filter(dataset =>
          dataset.name.toLowerCase().includes(lowercaseQuery) ||
          dataset.description.toLowerCase().includes(lowercaseQuery) ||
          dataset.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
          (dataset.repository && dataset.repository.toLowerCase().includes(lowercaseQuery))
        );
        
        setSearchResults(results);
      }
    } catch (err) {
      console.error("[PublicDatasets] Search failed:", err);
      setError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [provider, datasets]);

  /**
   * Get datasets by category
   */
  const getDatasetsByCategory = useCallback(
    (category: string) => {
      if (category === "all") return datasets;
      return datasets.filter((d) => d.category === category);
    },
    [datasets]
  );

  /**
   * Get datasets by provider
   */
  const getDatasetsByProvider = useCallback(
    (providerType: "aws" | "github" | "gcs" | "direct" | "huggingface") => {
      return datasets.filter((d) => d.provider === providerType);
    },
    [datasets]
  );

  /**
   * Get datasets by tag
   */
  const getDatasetsByTag = useCallback(
    (tag: string) => {
      return datasets.filter((d) => 
        d.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
      );
    },
    [datasets]
  );

  /**
   * Get datasets by format
   */
  const getDatasetsByFormat = useCallback(
    (format: string) => {
      return datasets.filter((d) => 
        d.format.some(f => f.toLowerCase() === format.toLowerCase())
      );
    },
    [datasets]
  );

  /**
   * Get datasets by task (useful for HuggingFace datasets)
   */
  const getDatasetsByTask = useCallback(
    (task: string) => {
      return datasets.filter((d) => 
        d.task && d.task.toLowerCase().includes(task.toLowerCase())
      );
    },
    [datasets]
  );

  /**
   * Search datasets by query (local search, not API)
   */
  const searchDatasetsLocal = useCallback(
    (query: string) => {
      if (!query.trim()) return datasets;

      const lowercaseQuery = query.toLowerCase();
      return datasets.filter(
        (dataset) =>
          dataset.name.toLowerCase().includes(lowercaseQuery) ||
          dataset.description.toLowerCase().includes(lowercaseQuery) ||
          dataset.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)) ||
          dataset.provider.toLowerCase().includes(lowercaseQuery) ||
          (dataset.repository && dataset.repository.toLowerCase().includes(lowercaseQuery)) ||
          (dataset.task && dataset.task.toLowerCase().includes(lowercaseQuery))
      );
    },
    [datasets]
  );

  /**
   * Get featured datasets
   */
  const getFeaturedDatasets = useCallback(() => {
    return datasets.filter((d) => d.featured);
  }, [datasets]);

  /**
   * Get dataset by ID
   */
  const getDatasetById = useCallback(
    (id: string) => {
      return datasets.find((d) => d.id === id);
    },
    [datasets]
  );

  /**
   * Get all unique tags
   */
  const getAllTags = useCallback(() => {
    const tagSet = new Set<string>();
    datasets.forEach(dataset => {
      dataset.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [datasets]);

  /**
   * Get datasets by size category
   */
  const getDatasetsBySize = useCallback(
    (sizeCategory: "small" | "medium" | "large") => {
      return datasets.filter(dataset => {
        const sizeStr = dataset.size.toLowerCase();
        if (sizeCategory === "small") {
          return sizeStr.includes("kb") || (sizeStr.includes("mb") && parseFloat(sizeStr) < 1);
        } else if (sizeCategory === "medium") {
          return sizeStr.includes("mb") && parseFloat(sizeStr) >= 1 && parseFloat(sizeStr) <= 50;
        } else {
          return sizeStr.includes("mb") && parseFloat(sizeStr) > 50;
        }
      });
    },
    [datasets]
  );

  /**
   * Get dataset categories with counts
   */
  const getCategories = useCallback(() => {
    const categoryMap = new Map<string, number>();

    datasets.forEach((dataset) => {
      const count = categoryMap.get(dataset.category) || 0;
      categoryMap.set(dataset.category, count + 1);
    });

    return Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));
  }, [datasets]);

  /**
   * Get popular tags (most used)
   */
  const getPopularTags = useCallback((limit = 10) => {
    const tagCounts = new Map<string, number>();
    
    datasets.forEach(dataset => {
      dataset.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }, [datasets]);

  /**
   * Get statistics
   */
  const getStats = useCallback(() => {
    const stats = {
      total: datasets.length,
      providers: [...new Set(datasets.map((d) => d.provider))],
      categories: [...new Set(datasets.map((d) => d.category))],
      formats: [...new Set(datasets.flatMap((d) => d.format))],
      featured: datasets.filter((d) => d.featured).length,
      byProvider: {
        huggingface: datasets.filter((d) => d.provider === "huggingface").length,
        aws: datasets.filter((d) => d.provider === "aws").length,
        github: datasets.filter((d) => d.provider === "github").length,
        gcs: datasets.filter((d) => d.provider === "gcs").length,
        direct: datasets.filter((d) => d.provider === "direct").length,
      },
      bySize: {
        small: getDatasetsBySize("small").length,
        medium: getDatasetsBySize("medium").length,
        large: getDatasetsBySize("large").length,
      }
    };
    return stats;
  }, [datasets, getDatasetsBySize]);

  /**
   * Refresh datasets (force refetch)
   */
  const refreshDatasets = useCallback(() => {
    return fetchDatasets();
  }, [fetchDatasets]);

  /**
   * Clear search results
   */
  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  return {
    // State
    datasets,
    searchResults,
    loading,
    isSearching,
    error,

    // Actions
    fetchDatasets,
    refreshDatasets,
    searchDatasets,
    clearSearchResults,

    // Computed data
    getDatasetsByCategory,
    getDatasetsByProvider,
    getDatasetsByTag,
    getDatasetsByFormat,
    getDatasetsBySize,
    getDatasetsByTask, 
    searchDatasetsLocal,
    getFeaturedDatasets,
    getDatasetById,
    getCategories,
    getStats,

    // Tag operations
    getAllTags,
    getPopularTags,

    // Utilities
    resetError: () => setError(null),
  };
}