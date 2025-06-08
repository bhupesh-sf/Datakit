/**
 * Dataset split information
 */
export interface DatasetSplit {
  /** Dataset identifier */
  dataset: string;
  /** Configuration/subset name */
  config: string;
  /** Split name (train, test, validation, etc.) */
  split: string;
  /** Number of examples in this split */
  num_examples?: number;
  /** Size in bytes */
  num_bytes?: number;
}

/**
 * Dataset configuration/subset information
 */
export interface DatasetConfig {
  /** Configuration name */
  config_name: string;
  /** Dataset identifier */
  dataset: string;
  /** Available splits in this config */
  splits: string[];
  /** Description of this configuration */
  description?: string;
  /** Features/schema for this config */
  features?: Record<string, any>;
}

/**
 * Enhanced dataset format information
 */
export interface DatasetFormat {
  /** Format type */
  type: "parquet" | "csv" | "json" | "txt" | "xlsx";
  /** Direct URL to the file */
  url: string;
  /** Split name */
  split: string;
  /** Configuration/subset name */
  config: string;
  /** File size in bytes */
  size?: number;
  /** Original filename */
  filename?: string;
}

/**
 * Enhanced dataset information
 */
export interface DatasetInfo {
  /** Dataset identifier */
  id: string;
  /** Display name */
  name: string;
  /** Dataset description */
  description: string;
  /** Author/organization */
  author: string;
  /** Download count */
  downloads: number;
  /** Like count */
  likes: number;
  /** Dataset tags */
  tags: string[];
  /** Last modified date */
  lastModified: string;
  /** Whether dataset is gated */
  gated: boolean;
  /** Whether dataset is private */
  private: boolean;
  /** Available configurations */
  configs: DatasetConfig[];
  /** Available splits across all configs */
  splits: DatasetSplit[];
  /** Dataset features/schema */
  features: Record<string, any>;
}

/**
 * Enhanced dataset ID validation result
 */
export interface DatasetIdValidation {
  /** Whether the ID is valid */
  isValid: boolean;
  /** Organization name (if present) */
  organization?: string;
  /** Dataset name */
  dataset?: string;
  /** Configuration name (if specified) */
  config?: string;
  /** Split name (if specified) */
  split?: string;
  /** Full input ID */
  fullId?: string;
  /** Error message if invalid */
  error?: string;
}

/**
 * Enhanced import options with config/split support
 */
export interface HFImportOptions {
  /** Authentication token */
  authToken?: string;
  /** Preferred format */
  preferredFormat?: "auto" | "streaming" | "download" | "parquet" | "csv" | "json";
  /** Specific configuration to use */
  config?: string;
  /** Specific split to use */
  split?: string;
  /** Maximum number of rows to import */
  maxRows?: number;
  /** Whether to show progress */
  showProgress?: boolean;
  /** Custom table name */
  tableName?: string;
}

/**
 * Enhanced import result with metadata
 */
export interface HFImportResult {
  /** Generated table name */
  tableName: string;
  /** Number of rows imported */
  rowCount: number;
  /** Dataset metadata */
  huggingface: {
    /** Dataset identifier */
    datasetId: string;
    /** Configuration used */
    config: string;
    /** Split used */
    split: string;
    /** Import method used */
    method: "streaming" | "download" | "fallback";
    /** Original file URL */
    sourceUrl?: string;
    /** File format */
    format: string;
    /** File size in bytes */
    fileSize?: number;
  };
  /** Column information */
  columns: Array<{
    name: string;
    type: string;
  }>;
  /** Preview data */
  preview?: string[][];
  /** Whether this is a remote dataset */
  isRemote: boolean;
  /** Remote provider */
  remoteProvider: string;
  /** Remote URL */
  remoteURL: string;
}

/**
 * Dataset search result
 */
export interface DatasetSearchResult {
  /** Dataset identifier */
  id: string;
  /** Display name */
  name: string;
  /** Full name with organization */
  fullName: string;
  /** Description */
  description: string;
  /** Author/organization */
  author: string;
  /** Download count */
  downloads: number;
  /** Like count */
  likes: number;
  /** Dataset tags */
  tags: string[];
  /** Task category */
  task: string;
  /** Last modified date */
  lastModified: string;
  /** Whether dataset is gated */
  gated: boolean;
  /** Whether dataset is private */
  private: boolean;
  /** Size category */
  size: string;
  /** Supported languages */
  languages: string[];
  /** Multilinguality info */
  multilinguality: string[];
  /** Whether it's featured */
  featured: boolean;
}

/**
 * Network fetch result
 */
export interface FetchResult {
  /** Downloaded blob */
  blob: Blob;
  /** File size in bytes */
  fileSize: number;
  /** Method used for download */
  method: "direct" | "proxy";
}

/**
 * Memory information
 */
export interface MemoryInfo {
  /** Used memory in MB */
  usedMB: number;
  /** Memory usage ratio (0-1) */
  ratio: number;
}

/**
 * Import strategy configuration
 */
export interface ImportStrategy {
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Strategy function */
  execute: () => Promise<HFImportResult>;
  /** Whether this strategy requires authentication */
  requiresAuth: boolean;
  /** Expected file formats supported */
  supportedFormats: string[];
}

/**
 * Dataset compatibility check result
 */
export interface DatasetCompatibility {
  /** Whether dataset is compatible */
  isCompatible: boolean;
  /** Reason if not compatible */
  reason?: string;
  /** Estimated memory usage */
  estimatedMemoryMB?: number;
  /** Recommended import method */
  recommendedMethod?: "streaming" | "download" | "chunked";
  /** Available configurations */
  availableConfigs?: string[];
  /** Default configuration */
  defaultConfig?: string;
}

/**
 * Config/Split selector component props
 */
export interface ConfigSplitSelectorProps {
  /** Available configurations */
  configs: DatasetConfig[];
  /** Available splits */
  splits: DatasetSplit[];
  /** Selected configuration */
  selectedConfig?: string;
  /** Selected split */
  selectedSplit?: string;
  /** Callback when config changes */
  onConfigChange: (config: string) => void;
  /** Callback when split changes */
  onSplitChange: (split: string) => void;
  /** Whether selector is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
}