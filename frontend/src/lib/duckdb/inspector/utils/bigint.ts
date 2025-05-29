/**
 * Converts a single value, handling BigInt conversion safely
 * 
 * @param value The value to convert
 * @returns Converted value (BigInt -> number or string if overflow)
 */
export function convertBigIntValue(value: any): any {
  if (typeof value === "bigint") {
    // Convert BigInt to number, but handle potential overflow
    const numValue = Number(value);
    if (numValue === Infinity || numValue === -Infinity) {
      // For very large numbers, convert to string to preserve precision
      return value.toString();
    } else {
      return numValue;
    }
  }
  return value;
}

/**
 * Converts DuckDB BigInt values to regular numbers for JSON serialization
 * 
 * @param data Array of result rows from DuckDB
 * @returns Processed data with BigInt values converted to numbers
 */
export function processDuckDBResult(data: any[]): any[] {
  return data.map((row) => {
    const processedRow: any = {};
    for (const [key, value] of Object.entries(row)) {
      processedRow[key] = convertBigIntValue(value);
    }
    return processedRow;
  });
}

/**
 * Converts a single DuckDB result row
 * 
 * @param row Single result row from DuckDB
 * @returns Processed row with BigInt values converted
 */
export function processDuckDBRow(row: any): any {
  const processedRow: any = {};
  for (const [key, value] of Object.entries(row)) {
    processedRow[key] = convertBigIntValue(value);
  }
  return processedRow;
}

/**
 * Safely converts a numeric value from DuckDB result
 * 
 * @param value The value to convert to number
 * @param defaultValue Default value if conversion fails
 * @returns Converted number or default value
 */
export function safeToNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === "bigint") {
    const numValue = Number(value);
    if (numValue === Infinity || numValue === -Infinity || isNaN(numValue)) {
      return defaultValue;
    }
    return numValue;
  }

  if (typeof value === "number") {
    if (isNaN(value) || !isFinite(value)) {
      return defaultValue;
    }
    return value;
  }

  // Try to parse as number
  const parsed = Number(value);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }

  return parsed;
}
