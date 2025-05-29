/**
 * Supported column type categories
 */
export type ColumnTypeCategory = 'numeric' | 'text' | 'date' | 'boolean' | 'binary' | 'unknown';

/**
 * Checks if a column appears to be numeric based on its type
 * @param columnType The column type from schema
 * @returns True if column should be treated as numeric
 */
export function isNumericColumn(columnType: string): boolean {
  const lowerType = columnType.toLowerCase();
  return lowerType.includes('int') || 
         lowerType.includes('double') || 
         lowerType.includes('numeric') || 
         lowerType.includes('decimal') ||
         lowerType.includes('float') ||
         lowerType.includes('real') ||
         lowerType.includes('money');
}

/**
 * Checks if a column appears to be text-based
 * @param columnType The column type from schema
 * @returns True if column should be treated as text
 */
export function isTextColumn(columnType: string): boolean {
  const lowerType = columnType.toLowerCase();
  return lowerType.includes('varchar') || 
         lowerType.includes('text') || 
         lowerType.includes('string') ||
         lowerType.includes('char') ||
         lowerType.includes('clob');
}

/**
 * Checks if a column appears to be date/time-based
 * @param columnType The column type from schema
 * @returns True if column should be treated as date/time
 */
export function isDateColumn(columnType: string): boolean {
  const lowerType = columnType.toLowerCase();
  return lowerType.includes('date') || 
         lowerType.includes('time') || 
         lowerType.includes('timestamp') ||
         lowerType.includes('interval');
}

/**
 * Checks if a column appears to be boolean
 * @param columnType The column type from schema
 * @returns True if column should be treated as boolean
 */
export function isBooleanColumn(columnType: string): boolean {
  const lowerType = columnType.toLowerCase();
  return lowerType.includes('bool') || 
         lowerType.includes('bit');
}

/**
 * Checks if a column appears to be binary data
 * @param columnType The column type from schema
 * @returns True if column should be treated as binary
 */
export function isBinaryColumn(columnType: string): boolean {
  const lowerType = columnType.toLowerCase();
  return lowerType.includes('blob') || 
         lowerType.includes('binary') ||
         lowerType.includes('varbinary') ||
         lowerType.includes('bytea');
}

/**
 * Categorizes a column type into a general category
 * @param columnType The column type from schema
 * @returns The category this column type belongs to
 */
export function categorizeColumnType(columnType: string): ColumnTypeCategory {
  if (isNumericColumn(columnType)) return 'numeric';
  if (isDateColumn(columnType)) return 'date';
  if (isBooleanColumn(columnType)) return 'boolean';
  if (isBinaryColumn(columnType)) return 'binary';
  if (isTextColumn(columnType)) return 'text';
  return 'unknown';
}

/**
 * Determines if a column is suitable for histogram analysis
 * @param columnType The column type from schema
 * @param uniqueCount Number of unique values in the column
 * @param totalRows Total number of rows
 * @returns True if column is suitable for histogram
 */
export function isSuitableForHistogram(
  columnType: string, 
  uniqueCount: number, 
  totalRows: number
): boolean {
  // Only numeric columns are suitable for histograms
  if (!isNumericColumn(columnType)) {
    return false;
  }
  
  // Need at least 2 unique values for a meaningful histogram
  if (uniqueCount < 2) {
    return false;
  }
  
  // Don't create histograms for very sparse data
  if (totalRows > 0 && uniqueCount / totalRows > 0.9) {
    return false;
  }
  
  return true;
}

/**
 * Determines if a column is suitable for categorical analysis (frequent values)
 * @param columnType The column type from schema
 * @param uniqueCount Number of unique values in the column
 * @param totalRows Total number of rows
 * @returns True if column is suitable for categorical analysis
 */
export function isSuitableForCategorical(
  columnType: string, 
  uniqueCount: number, 
  totalRows: number
): boolean {
  // Binary columns are not suitable for categorical analysis
  if (isBinaryColumn(columnType)) {
    return false;
  }
  
  // Need at least 1 unique value
  if (uniqueCount < 1) {
    return false;
  }
  
  // Don't analyze columns with too many unique values (likely identifiers)
  if (uniqueCount > 1000) {
    return false;
  }
  
  // Don't analyze columns where every value is unique (likely identifiers)
  if (totalRows > 0 && uniqueCount === totalRows) {
    return false;
  }
  
  return true;
}

/**
 * Determines the optimal number of histogram bins for a column
 * @param uniqueCount Number of unique values
 * @param totalRows Total number of rows
 * @returns Recommended number of bins
 */
export function getOptimalBinCount(uniqueCount: number, totalRows: number): number {
  // For very few unique values, use the unique count as bin count
  if (uniqueCount <= 10) {
    return Math.max(uniqueCount, 3);
  }
  
  // Use Sturges' rule as a starting point: ceil(log2(n)) + 1
  const sturges = Math.ceil(Math.log2(totalRows)) + 1;
  
  // Use square root rule as alternative: sqrt(n)
  const sqrt = Math.ceil(Math.sqrt(totalRows));
  
  // Take the smaller of the two, but ensure it's reasonable
  const calculated = Math.min(sturges, sqrt);
  
  // Constrain to reasonable bounds
  return Math.max(5, Math.min(20, calculated));
}

/**
 * Validates that a column name is safe for SQL queries
 * @param columnName The column name to validate
 * @returns True if the column name is safe to use
 */
export function isValidColumnName(columnName: string): boolean {
  // Check for null/empty
  if (!columnName || columnName.trim().length === 0) {
    return false;
  }
  
  // Check for potentially dangerous characters
  const dangerousChars = /[;'"\\]/;
  if (dangerousChars.test(columnName)) {
    return false;
  }
  
  return true;
}

/**
 * Gets a human-readable description of a column type
 * @param columnType The column type from schema
 * @returns Human-readable description
 */
export function getColumnTypeDescription(columnType: string): string {
  const category = categorizeColumnType(columnType);
  
  switch (category) {
    case 'numeric':
      return 'Numeric data (numbers, calculations)';
    case 'text':
      return 'Text data (strings, names, descriptions)';
    case 'date':
      return 'Date/time data (timestamps, dates)';
    case 'boolean':
      return 'Boolean data (true/false values)';
    case 'binary':
      return 'Binary data (files, images)';
    default:
      return `Unknown data type (${columnType})`;
  }
}