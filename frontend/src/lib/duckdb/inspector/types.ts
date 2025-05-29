/**
 * Histogram bin data structure
 */
export interface HistogramBin {
    /** Bin identifier (e.g., "B1", "B2") */
    bin: string;
    /** Number of values in this bin */
    count: number;
    /** Human-readable range string (e.g., "0-10") */
    range: string;
    /** Numeric start of bin range */
    binStart: number;
    /** Numeric end of bin range */
    binEnd: number;
  }
  
  /**
   * Comprehensive numeric statistics
   */
  export interface NumericStats {
    /** Minimum value */
    min: number;
    /** Maximum value */
    max: number;
    /** Arithmetic mean */
    mean: number;
    /** Median value */
    median: number;
    /** Standard deviation */
    std: number;
    /** Number of outliers (using IQR method) */
    outliers: number;
    /** First quartile (25th percentile) */
    q1?: number;
    /** Third quartile (75th percentile) */
    q3?: number;
  }
  
  /**
   * Text column statistics
   */
  export interface TextStats {
    /** Average length of text values */
    avgLength: number;
    /** Minimum text length */
    minLength: number;
    /** Maximum text length */
    maxLength: number;
    /** Count of empty strings */
    emptyStrings: number;
    /** Total character count across all values */
    totalChars: number;
  }
  
  /**
   * Date column statistics
   */
  export interface DateStats {
    /** Earliest date as ISO string */
    minDate: string;
    /** Latest date as ISO string */
    maxDate: string;
    /** Count of invalid date values */
    invalidDates: number;
    /** Number of days between min and max dates */
    dateRange: number;
  }
  
  /**
   * Basic column analysis results
   */
  export interface BasicColumnStats {
    /** Column name */
    name: string;
    /** Data type from schema */
    type: string;
    /** Total number of rows */
    totalRows: number;
    /** Number of null values */
    nullCount: number;
    /** Percentage of null values */
    nullPercentage: number;
    /** Number of unique values */
    uniqueCount: number;
    /** Cardinality ratio (unique/total) */
    cardinality: number;
  }
  
  /**
   * Data type issue detection result
   */
  export interface TypeIssue {
    /** Column name with the issue */
    column: string;
    /** Description of the issue */
    issue: string;
    /** Number of problematic values */
    count: number;
    /** Sample problematic values */
    examples: string[];
    /** Severity level of the issue */
    severity: 'low' | 'medium' | 'high';
  }
  
  /**
   * Frequent value analysis result
   */
  export interface FrequentValue {
    /** The value */
    value: string;
    /** Frequency count */
    count: number;
    /** Percentage of total */
    percentage: number;
  }
  
  /**
   * Health score breakdown
   */
  export interface HealthBreakdown {
    /** Completeness score based on missing data */
    completeness: number;
    /** Uniqueness score based on duplicate rows */
    uniqueness: number;
    /** Consistency score based on data quality issues */
    consistency: number;
  }
  
  /**
   * Overall data health assessment
   */
  export interface HealthScore {
    /** Overall health score (0-100) */
    healthScore: number;
    /** Breakdown of health components */
    healthBreakdown: HealthBreakdown;
  }
  
  /**
   * Configuration for numeric filtering
   */
  export interface NumericFilterConfig {
    /** Whether to use regex-based filtering */
    useRegexFilter: boolean;
    /** Whether to include infinite values */
    includeInfinite: boolean;
    /** Custom regex pattern for numeric validation */
    customPattern?: string;
  }
  
  /**
   * Range information for numeric columns
   */
  export interface NumericRange {
    /** Minimum value */
    min: number;
    /** Maximum value */
    max: number;
    /** Total count of valid numeric values */
    totalCount: number;
    /** Whether all values are the same */
    isConstant: boolean;
  }
  
  /**
   * Histogram generation configuration
   */
  export interface HistogramConfig {
    /** Number of bins to generate */
    binCount: number;
    /** Whether to use nice/rounded boundaries */
    useNiceBoundaries: boolean;
    /** Custom bin boundaries (overrides binCount) */
    customBoundaries?: number[];
  }
  
  /**
   * Analysis progress information
   */
  export interface AnalysisProgress {
    /** Current step being executed */
    step: string;
    /** Progress percentage (0-100) */
    progress: number;
    /** Current column being analyzed (if applicable) */
    currentColumn?: string;
    /** Total number of columns */
    totalColumns?: number;
    /** Current column index */
    currentColumnIndex?: number;
  }
  
  /**
   * Error information for analysis failures
   */
  export interface AnalysisError {
    /** Error message */
    message: string;
    /** Error code (optional) */
    code?: string;
    /** Column name where error occurred (if applicable) */
    column?: string;
    /** Original error object */
    originalError?: Error;
  }
  
  /**
   * Debug information for troubleshooting
   */
  export interface DebugInfo {
    /** Whether data exists for analysis */
    hasData: boolean;
    /** Minimum value found */
    min: number | null;
    /** Maximum value found */
    max: number | null;
    /** Total count of valid values */
    totalCount: number;
    /** Generated bin boundaries */
    binBoundaries: number[];
    /** Error message if analysis failed */
    error?: string;
    /** Additional debug details */
    details?: Record<string, any>;
  }