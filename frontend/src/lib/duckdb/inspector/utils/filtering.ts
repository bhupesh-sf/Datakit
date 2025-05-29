import type { NumericFilterConfig } from '../types';

/**
 * Default numeric regex pattern for validating numeric strings
 * Matches: integers, decimals, scientific notation, negative numbers
 */
export const DEFAULT_NUMERIC_PATTERN = '^-?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?$';

/**
 * Safely filters numeric values in a DuckDB query using regex pattern matching
 * @param columnName The column name to filter
 * @param config Optional configuration for filtering behavior
 * @returns SQL WHERE clause fragment for filtering valid numeric values
 */
export function getNumericFilterClause(
  columnName: string, 
  config: NumericFilterConfig = { useRegexFilter: true, includeInfinite: false }
): string {
  const { useRegexFilter, includeInfinite, customPattern } = config;
  const pattern = customPattern || DEFAULT_NUMERIC_PATTERN;
  
  if (useRegexFilter) {
    let clause = `"${columnName}" IS NOT NULL AND REGEXP_MATCHES("${columnName}"::VARCHAR, '${pattern}')`;
    
    if (!includeInfinite) {
      // Exclude infinity values even if they match the pattern
      clause += ` AND "${columnName}"::VARCHAR NOT IN ('Infinity', '-Infinity', 'inf', '-inf')`;
    }
    
    return clause;
  } else {
    return getNumericFilterClauseFallback(columnName);
  }
}

/**
 * Alternative numeric filter using TRY_CAST (fallback if regex not available)
 * 
 * @param columnName The column name to filter  
 * @returns SQL WHERE clause fragment for filtering valid numeric values
 */
export function getNumericFilterClauseFallback(columnName: string): string {
  return `"${columnName}" IS NOT NULL AND TRY_CAST("${columnName}" AS DOUBLE) IS NOT NULL`;
}

/**
 * Creates a safe column reference with proper escaping
 * 
 * @param columnName The column name to escape
 * @returns Properly escaped column name for SQL queries
 */
export function escapeColumnName(columnName: string): string {
  // Escape double quotes within the column name
  const escaped = columnName.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Creates a WHERE clause for excluding null values
 * 
 * @param columnName The column name
 * @returns SQL WHERE clause fragment
 */
export function getNullFilterClause(columnName: string): string {
  return `${escapeColumnName(columnName)} IS NOT NULL`;
}

/**
 * Creates a WHERE clause for text columns (non-empty strings)
 * 
 * @param columnName The column name
 * @param excludeEmpty Whether to exclude empty strings
 * @returns SQL WHERE clause fragment
 */
export function getTextFilterClause(columnName: string, excludeEmpty: boolean = false): string {
  let clause = `${escapeColumnName(columnName)} IS NOT NULL`;
  
  if (excludeEmpty) {
    clause += ` AND ${escapeColumnName(columnName)} != ''`;
  }
  
  return clause;
}

/**
 * Creates a WHERE clause for date columns
 * 
 * @param columnName The column name
 * @returns SQL WHERE clause fragment
 */
export function getDateFilterClause(columnName: string): string {
  return `${escapeColumnName(columnName)} IS NOT NULL AND TRY_CAST(${escapeColumnName(columnName)} AS DATE) IS NOT NULL`;
}

/**
 * Combines multiple WHERE clauses with AND
 * 
 * @param clauses Array of WHERE clause fragments
 * @returns Combined WHERE clause
 */
export function combineFilterClauses(clauses: string[]): string {
  const validClauses = clauses.filter(clause => clause.trim().length > 0);
  return validClauses.length > 0 ? validClauses.join(' AND ') : '';
}

/**
 * Creates a range filter for numeric columns
 * 
 * @param columnName The column name
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @param includeEndpoints Whether to include the exact min/max values
 * @returns SQL WHERE clause fragment
 */
export function getNumericRangeClause(
  columnName: string, 
  min: number, 
  max: number, 
  includeEndpoints: boolean = true
): string {
  const operator = includeEndpoints ? '>=' : '>';
  const endOperator = includeEndpoints ? '<=' : '<';
  
  return `${escapeColumnName(columnName)} ${operator} ${min} AND ${escapeColumnName(columnName)} ${endOperator} ${max}`;
}

/**
 * Creates a filter for categorical values
 * @param columnName The column name
 * @param values Array of values to include
 * @param exclude Whether to exclude these values instead of include
 * @returns SQL WHERE clause fragment
 */
export function getCategoricalFilterClause(
  columnName: string, 
  values: string[], 
  exclude: boolean = false
): string {
  if (values.length === 0) {
    return '';
  }
  
  // Escape single quotes in values
  const escapedValues = values.map(value => `'${value.replace(/'/g, "''")}'`);
  const valuesList = escapedValues.join(', ');
  const operator = exclude ? 'NOT IN' : 'IN';
  
  return `${escapeColumnName(columnName)} ${operator} (${valuesList})`;
}