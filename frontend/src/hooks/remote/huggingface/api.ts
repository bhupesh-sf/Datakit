import type { 
  DatasetIdValidation,
  DatasetInfo,
  DatasetSplit,
  DatasetConfig
} from "./types";

/**
 * HuggingFace API endpoints
 */
const HF_API_BASE = "https://huggingface.co/api";
const HF_DATASETS_SERVER = "https://datasets-server.huggingface.co";

/**
 * Dataset search using the correct HuggingFace Hub API
 */
export async function searchDatasets(
  query: string,
  options: { 
    limit?: number; 
    author?: string;
    authToken?: string;
    sort?: "lastModified" | "downloads" | "likes";
    direction?: "asc" | "desc";
  } = {}
): Promise<any[]> {
  const { limit = 20, author, authToken, sort = "downloads", direction = "desc" } = options;
  
  try {
    const params = new URLSearchParams({
      search: query,
      limit: limit.toString(),
      sort: sort,
      direction: direction === "desc" ? "-1" : "1",
      full: "true",
    });
    
    if (author) {
      params.append("author", author);
    }
    
    const url = `${HF_API_BASE}/datasets?${params.toString()}`;
    
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    console.log(`[HF Search] Searching datasets: ${url}`);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    const datasets = await response.json();
    
    console.log(`[HF Search] Found ${datasets.length} datasets`);
    
    return datasets.map((dataset: any) => ({
      id: dataset.id,
      name: dataset.id.split("/").pop() || dataset.id,
      fullName: dataset.id,
      description: dataset.cardData?.description || dataset.description || "No description available",
      author: dataset.author || dataset.id.split("/")[0],
      downloads: dataset.downloads || 0,
      likes: dataset.likes || 0,
      tags: dataset.tags || [],
      task: dataset.cardData?.task_categories?.[0] || "general",
      lastModified: dataset.lastModified,
      gated: dataset.gated || false,
      private: dataset.private || false,
      size: dataset.cardData?.size_categories?.[0] || "unknown",
      languages: dataset.cardData?.language || [],
      multilinguality: dataset.cardData?.multilinguality || [],
      featured: dataset.tags?.includes("featured") || false,
    }));
    
  } catch (error) {
    console.error("[HF Search] Search failed:", error);
    throw new Error(`Failed to search datasets: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get dataset splits and configurations
 */
export async function getDatasetSplits(
  datasetId: string,
  authToken?: string
): Promise<{
  splits: DatasetSplit[];
  configs: DatasetConfig[];
}> {
  try {
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const url = `${HF_DATASETS_SERVER}/splits?dataset=${encodeURIComponent(datasetId)}`;
    
    console.log(`[HF API] Getting splits for ${datasetId}: ${url}`);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      return {splits: [], configs: []};
      // throw new Error(`Failed to get splits: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const splits: DatasetSplit[] = data.splits || [];
    
    // Extract unique configs from splits
    const configsMap = new Map<string, DatasetConfig>();
    splits.forEach(split => {
      if (!configsMap.has(split.config)) {
        configsMap.set(split.config, {
          config_name: split.config,
          dataset: split.dataset,
          splits: [],
        });
      }
      configsMap.get(split.config)!.splits.push(split.split);
    });
    
    const configs = Array.from(configsMap.values());
    
    console.log(`[HF API] Found ${configs.length} configs and ${splits.length} splits for ${datasetId}`);
    
    return { splits, configs };
    
  } catch (error) {
    console.error(`[HF API] Failed to get splits for ${datasetId}:`, error);
    throw new Error(`Failed to get dataset splits: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Dataset ID parsing
 */
export function parseDatasetId(input: string): DatasetIdValidation & {
  config?: string;
  split?: string;
  fullId: string;
} {
  if (!input || typeof input !== "string") {
    return {
      isValid: false,
      error: "Dataset ID is required",
      fullId: input || "",
    };
  }
  
  const trimmedInput = input.trim();
  
  let datasetPart = trimmedInput;
  let config: string | undefined;
  let split: string | undefined;
  
  // Extract split if present (after last /)
  const lastSlashIndex = datasetPart.lastIndexOf("/");
  if (lastSlashIndex > -1) {
    const potentialSplit = datasetPart.substring(lastSlashIndex + 1);
    const datasetWithoutSplit = datasetPart.substring(0, lastSlashIndex);
    
    // Check if this looks like a split
    const commonSplits = ["train", "test", "validation", "val", "dev", "eval"];
    if (commonSplits.includes(potentialSplit.toLowerCase()) || 
        potentialSplit.match(/^(train|test|val|validation|dev|eval)[\d_-]*$/i)) {
      split = potentialSplit;
      datasetPart = datasetWithoutSplit;
    }
  }
  
  // Extract config if present (after :)
  const colonIndex = datasetPart.indexOf(":");
  if (colonIndex > -1) {
    config = datasetPart.substring(colonIndex + 1);
    datasetPart = datasetPart.substring(0, colonIndex);
  }
  
  // Parse organization/dataset
  const parts = datasetPart.split("/");
  
  if (parts.length === 1) {
    const dataset = parts[0];
    if (!dataset || dataset.length === 0) {
      return {
        isValid: false,
        error: "Dataset name cannot be empty",
        fullId: trimmedInput,
      };
    }
    
    return {
      isValid: true,
      organization: undefined,
      dataset,
      config,
      split,
      fullId: trimmedInput,
    };
  } else if (parts.length === 2) {
    const [organization, dataset] = parts;
    
    if (!organization || !dataset || organization.length === 0 || dataset.length === 0) {
      return {
        isValid: false,
        error: "Both organization and dataset name are required",
        fullId: trimmedInput,
      };
    }
    
    return {
      isValid: true,
      organization,
      dataset,
      config,
      split,
      fullId: trimmedInput,
    };
  } else {
    return {
      isValid: false,
      error: "Invalid dataset ID format. Expected: organization/dataset[:config][/split]",
      fullId: trimmedInput,
    };
  }
}

/**
 * Detect available formats
 */
export async function detectAvailableFormats(
  datasetId: string,
  authToken?: string
): Promise<{
  formats: Array<{
    type: "parquet" | "csv" | "json";
    url: string;
    split: string;
    config: string;
    size?: number;
    filename?: string;
  }>;
  recommendedFormat: string;
  availableConfigs: DatasetConfig[];
}> {
  try {
    const parsedId = parseDatasetId(datasetId);
    const baseDatasetId = parsedId.organization 
      ? `${parsedId.organization}/${parsedId.dataset}`
      : parsedId.dataset;
    
    // Get splits and configs
    const { configs } = await getDatasetSplits(baseDatasetId, authToken);
    
    // Get parquet files for each config
    const formats: Array<{
      type: "parquet" | "csv" | "json";
      url: string;
      split: string;
      config: string;
      size?: number;
      filename?: string;
    }> = [];
    
    for (const config of configs) {
      try {
        const parquetUrl = `${HF_DATASETS_SERVER}/parquet?dataset=${encodeURIComponent(baseDatasetId)}&config=${encodeURIComponent(config.config_name)}`;
        
        const headers: Record<string, string> = {
          "Accept": "application/json",
        };
        
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(parquetUrl, { headers });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.parquet_files && data.parquet_files.length > 0) {
            data.parquet_files.forEach((file: any) => {
              formats.push({
                type: "parquet",
                url: file.url,
                split: file.split,
                config: file.config,
                size: file.size,
                filename: file.filename,
              });
            });
          }
        }
      } catch (err) {
        console.warn(`[HF API] Failed to get parquet files for config ${config.config_name}:`, err);
      }
    }
    
    let recommendedFormat = "parquet";
    if (formats.length === 0) {
      recommendedFormat = "download";
    }
    
    console.log(`[HF API] Found ${formats.length} parquet formats for ${datasetId}`);
    
    return {
      formats,
      recommendedFormat,
      availableConfigs: configs,
    };
    
  } catch (error) {
    console.error(`[HF API] Failed to detect formats for ${datasetId}:`, error);
    throw new Error(`Failed to detect available formats: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get dataset information
 */
export async function getDatasetInfo(
  datasetId: string,
  authToken?: string
): Promise<DatasetInfo> {
  try {
    const parsedId = parseDatasetId(datasetId);
    const baseDatasetId = parsedId.organization 
      ? `${parsedId.organization}/${parsedId.dataset}`
      : parsedId.dataset;
    
    const hubUrl = `${HF_API_BASE}/datasets/${encodeURIComponent(baseDatasetId)}`;
    
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(hubUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to get dataset info: ${response.status} ${response.statusText}`);
    }
    
    const hubData = await response.json();
    
    // Get splits and configs
    const { splits, configs } = await getDatasetSplits(baseDatasetId, authToken);
    
    const datasetInfo: DatasetInfo = {
      id: baseDatasetId,
      name: hubData.id.split("/").pop() || hubData.id,
      description: hubData.cardData?.description || hubData.description || "No description available",
      author: hubData.author || hubData.id.split("/")[0],
      downloads: hubData.downloads || 0,
      likes: hubData.likes || 0,
      tags: hubData.tags || [],
      lastModified: hubData.lastModified,
      gated: hubData.gated || false,
      private: hubData.private || false,
      configs: configs,
      splits: splits,
      features: {},
    };
    
    console.log(`[HF API] Retrieved info for ${datasetId}:`, {
      configs: configs.length,
      splits: splits.length,
    });
    
    return datasetInfo;
    
  } catch (error) {
    console.error(`[HF API] Failed to get dataset info for ${datasetId}:`, error);
    throw new Error(`Failed to get dataset information: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get parquet files
 */
export async function getParquetFiles(
  datasetId: string,
  config: string = "default",
  authToken?: string
): Promise<{
  parquet_files: Array<{
    dataset: string;
    config: string;
    split: string;
    url: string;
    filename: string;
    size: number;
  }>;
}> {
  try {
    const parsedId = parseDatasetId(datasetId);
    const baseDatasetId = parsedId.organization 
      ? `${parsedId.organization}/${parsedId.dataset}`
      : parsedId.dataset;
    
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    console.log('getParquetFiles', config);
    const url = `${HF_DATASETS_SERVER}/parquet?dataset=${encodeURIComponent(baseDatasetId)}&config=${encodeURIComponent(config)}`;
    
    console.log(`[HF API] Getting parquet files: ${url}`);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to get parquet files: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      parquet_files: data.parquet_files || []
    };
    
  } catch (error) {
    console.error(`[HF API] Failed to get parquet files for ${datasetId}:`, error);
    throw new Error(`Failed to get parquet files: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Test dataset access
 */
export async function testDatasetAccess(
  datasetId: string,
  authToken?: string
): Promise<boolean> {
  try {
    const parsedId = parseDatasetId(datasetId);
    const baseDatasetId = parsedId.organization 
      ? `${parsedId.organization}/${parsedId.dataset}`
      : parsedId.dataset;
    
    const url = `${HF_DATASETS_SERVER}/is-valid?dataset=${encodeURIComponent(baseDatasetId)}`;
    
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      return data.preview || data.viewer || data.search || false;
    }
    
    return false;
    
  } catch (error) {
    console.warn(`[HF API] Access test failed for ${datasetId}:`, error);
    return false;
  }
}