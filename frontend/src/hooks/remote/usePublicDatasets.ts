import { useState, useCallback } from "react";

import { S3_PUBLIC_DATASETS, GITHUB_PUBLIC_DATASETS } from '@/constants/public_datasets';
import { PublicDataset } from "@/types/remoteImport";

// All datasets combined
const ALL_DATASETS = [...S3_PUBLIC_DATASETS, ...GITHUB_PUBLIC_DATASETS];

/**
 * Hook for managing public datasets across multiple providers
 */
export default function usePublicDatasets(provider?: "aws" | "github" | "custom-url" | "all") {
  const [datasets, setDatasets] = useState<PublicDataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch datasets based on provider
   */
  const fetchDatasets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

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

        // Provider (aws first, then github)
        if (a.provider !== b.provider) {
          const providerOrder = { aws: 0, github: 1, gcs: 2, direct: 3 };
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
    (providerType: "aws" | "github" | "gcs" | "direct") => {
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
   * Search datasets by query
   */
  const searchDatasets = useCallback(
    (query: string) => {
      if (!query.trim()) return datasets;

      const lowercaseQuery = query.toLowerCase();
      return datasets.filter(
        (dataset) =>
          dataset.name.toLowerCase().includes(lowercaseQuery) ||
          dataset.description.toLowerCase().includes(lowercaseQuery) ||
          dataset.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)) ||
          dataset.provider.toLowerCase().includes(lowercaseQuery) ||
          (dataset.repository && dataset.repository.toLowerCase().includes(lowercaseQuery))
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

  return {
    // State
    datasets,
    loading,
    error,

    // Actions
    fetchDatasets,
    refreshDatasets,

    // Computed data
    getDatasetsByCategory,
    getDatasetsByProvider,
    getDatasetsByTag,
    getDatasetsByFormat,
    getDatasetsBySize,
    searchDatasets,
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