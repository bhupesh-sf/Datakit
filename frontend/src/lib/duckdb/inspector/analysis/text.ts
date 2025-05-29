import * as duckdb from "@duckdb/duckdb-wasm";
import { processDuckDBResult, safeToNumber } from "../utils/bigint";
import { getTextFilterClause, escapeColumnName } from "../utils/filtering";
import type { TextStats } from "../types";

/**
 * Gets text column statistics
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @returns Promise resolving to text statistics or null if failed
 */
export async function getTextStats(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<TextStats | null> {
  console.log(`[TextAnalysis] Getting text stats for ${columnName}`);

  const textQuery = `
    SELECT 
      AVG(LENGTH(${escapeColumnName(columnName)})) as avg_length,
      MIN(LENGTH(${escapeColumnName(columnName)})) as min_length,
      MAX(LENGTH(${escapeColumnName(columnName)})) as max_length,
      COUNT(CASE WHEN ${escapeColumnName(
        columnName
      )} = '' THEN 1 END) as empty_strings,
      SUM(LENGTH(${escapeColumnName(columnName)})) as total_chars,
      COUNT(${escapeColumnName(columnName)}) as non_null_count
    FROM ${tableName}
    WHERE ${getTextFilterClause(columnName)}
  `;

  try {
    const result = await connection.query(textQuery);
    const stats = processDuckDBResult(result.toArray())[0];

    if (!stats || stats.non_null_count === 0) {
      console.log(`[TextAnalysis] No text data found for ${columnName}`);
      return null;
    }

    const textStats: TextStats = {
      avgLength: safeToNumber(stats.avg_length),
      minLength: safeToNumber(stats.min_length),
      maxLength: safeToNumber(stats.max_length),
      emptyStrings: safeToNumber(stats.empty_strings),
      totalChars: safeToNumber(stats.total_chars),
    };

    console.log(`[TextAnalysis] Text stats for ${columnName}:`, textStats);
    return textStats;
  } catch (error) {
    console.error(
      `[TextAnalysis] Error getting text stats for ${columnName}:`,
      error
    );
    return null;
  }
}

/**
 * Analyzes text patterns in a column
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @returns Promise resolving to pattern analysis results
 */
export async function analyzeTextPatterns(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<{
  emailLike: number;
  urlLike: number;
  phoneLike: number;
  numericOnly: number;
  alphaOnly: number;
  mixedCase: number;
  allCaps: number;
  allLower: number;
}> {
  console.log(`[TextAnalysis] Analyzing text patterns for ${columnName}`);

  try {
    const patternQuery = `
      SELECT 
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} LIKE '%@%' AND ${escapeColumnName(
      columnName
    )} LIKE '%.%' THEN 1 END) as email_like,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} LIKE 'http%' OR ${escapeColumnName(
      columnName
    )} LIKE 'www.%' THEN 1 END) as url_like,
        COUNT(CASE WHEN REGEXP_MATCHES(${escapeColumnName(
          columnName
        )}, '^[\\+]?[0-9\\s\\-\\(\\)]+$') THEN 1 END) as phone_like,
        COUNT(CASE WHEN REGEXP_MATCHES(${escapeColumnName(
          columnName
        )}, '^[0-9]+$') THEN 1 END) as numeric_only,
        COUNT(CASE WHEN REGEXP_MATCHES(${escapeColumnName(
          columnName
        )}, '^[a-zA-Z]+$') THEN 1 END) as alpha_only,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} != UPPER(${escapeColumnName(columnName)}) AND ${escapeColumnName(
      columnName
    )} != LOWER(${escapeColumnName(columnName)}) THEN 1 END) as mixed_case,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} = UPPER(${escapeColumnName(
      columnName
    )}) AND LENGTH(${escapeColumnName(columnName)}) > 1 THEN 1 END) as all_caps,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} = LOWER(${escapeColumnName(
      columnName
    )}) AND LENGTH(${escapeColumnName(columnName)}) > 1 THEN 1 END) as all_lower
      FROM ${tableName}
      WHERE ${getTextFilterClause(columnName, true)}
    `;

    const result = await connection.query(patternQuery);
    const data = processDuckDBResult(result.toArray())[0];

    const patterns = {
      emailLike: safeToNumber(data.email_like),
      urlLike: safeToNumber(data.url_like),
      phoneLike: safeToNumber(data.phone_like),
      numericOnly: safeToNumber(data.numeric_only),
      alphaOnly: safeToNumber(data.alpha_only),
      mixedCase: safeToNumber(data.mixed_case),
      allCaps: safeToNumber(data.all_caps),
      allLower: safeToNumber(data.all_lower),
    };

    console.log(`[TextAnalysis] Text patterns for ${columnName}:`, patterns);
    return patterns;
  } catch (error) {
    console.warn(
      `[TextAnalysis] Pattern analysis failed for ${columnName}, using fallback:`,
      error
    );

    // Fallback analysis without regex
    return await analyzeTextPatternsFallback(connection, tableName, columnName);
  }
}

/**
 * Fallback text pattern analysis without regex support
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @returns Promise resolving to basic pattern analysis
 */
async function analyzeTextPatternsFallback(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<{
  emailLike: number;
  urlLike: number;
  phoneLike: number;
  numericOnly: number;
  alphaOnly: number;
  mixedCase: number;
  allCaps: number;
  allLower: number;
}> {
  console.log(
    `[TextAnalysis] Using fallback pattern analysis for ${columnName}`
  );

  const fallbackQuery = `
    SELECT 
      COUNT(CASE WHEN ${escapeColumnName(
        columnName
      )} LIKE '%@%' AND ${escapeColumnName(
    columnName
  )} LIKE '%.%' THEN 1 END) as email_like,
      COUNT(CASE WHEN ${escapeColumnName(
        columnName
      )} LIKE 'http%' OR ${escapeColumnName(
    columnName
  )} LIKE 'www.%' THEN 1 END) as url_like,
      COUNT(CASE WHEN ${escapeColumnName(
        columnName
      )} = UPPER(${escapeColumnName(columnName)}) AND LENGTH(${escapeColumnName(
    columnName
  )}) > 1 THEN 1 END) as all_caps,
      COUNT(CASE WHEN ${escapeColumnName(
        columnName
      )} = LOWER(${escapeColumnName(columnName)}) AND LENGTH(${escapeColumnName(
    columnName
  )}) > 1 THEN 1 END) as all_lower
    FROM ${tableName}
    WHERE ${getTextFilterClause(columnName, true)}
  `;

  try {
    const result = await connection.query(fallbackQuery);
    const data = processDuckDBResult(result.toArray())[0];

    return {
      emailLike: safeToNumber(data.email_like),
      urlLike: safeToNumber(data.url_like),
      phoneLike: 0, // Can't detect without regex
      numericOnly: 0, // Can't detect without regex
      alphaOnly: 0, // Can't detect without regex
      mixedCase: 0, // Can't reliably detect without regex
      allCaps: safeToNumber(data.all_caps),
      allLower: safeToNumber(data.all_lower),
    };
  } catch (error) {
    console.error(
      `[TextAnalysis] Fallback pattern analysis failed for ${columnName}:`,
      error
    );
    return {
      emailLike: 0,
      urlLike: 0,
      phoneLike: 0,
      numericOnly: 0,
      alphaOnly: 0,
      mixedCase: 0,
      allCaps: 0,
      allLower: 0,
    };
  }
}

/**
 * Gets examples of the longest and shortest text values
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @param limit Number of examples to return for each category
 * @returns Promise resolving to text examples
 */
export async function getTextExamples(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
  limit: number = 5
): Promise<{
  longest: Array<{ value: string; length: number }>;
  shortest: Array<{ value: string; length: number }>;
  empty: number;
}> {
  console.log(`[TextAnalysis] Getting text examples for ${columnName}`);

  try {
    // Get longest values
    const longestQuery = `
      SELECT ${escapeColumnName(
        columnName
      )} as value, LENGTH(${escapeColumnName(columnName)}) as length
      FROM ${tableName}
      WHERE ${getTextFilterClause(columnName, true)}
      ORDER BY LENGTH(${escapeColumnName(columnName)}) DESC, ${escapeColumnName(
      columnName
    )}
      LIMIT ${limit}
    `;

    const longestResult = await connection.query(longestQuery);
    const longestData = processDuckDBResult(longestResult.toArray());

    // Get shortest values (non-empty)
    const shortestQuery = `
      SELECT ${escapeColumnName(
        columnName
      )} as value, LENGTH(${escapeColumnName(columnName)}) as length
      FROM ${tableName}
      WHERE ${getTextFilterClause(columnName, true)}
        AND LENGTH(${escapeColumnName(columnName)}) > 0
      ORDER BY LENGTH(${escapeColumnName(columnName)}) ASC, ${escapeColumnName(
      columnName
    )}
      LIMIT ${limit}
    `;

    const shortestResult = await connection.query(shortestQuery);
    const shortestData = processDuckDBResult(shortestResult.toArray());

    // Count empty strings
    const emptyQuery = `
      SELECT COUNT(*) as empty_count
      FROM ${tableName}
      WHERE ${escapeColumnName(columnName)} IS NOT NULL 
        AND ${escapeColumnName(columnName)} = ''
    `;

    const emptyResult = await connection.query(emptyQuery);
    const emptyData = processDuckDBResult(emptyResult.toArray())[0];

    return {
      longest: longestData.map((row) => ({
        value: String(row.value),
        length: safeToNumber(row.length),
      })),
      shortest: shortestData.map((row) => ({
        value: String(row.value),
        length: safeToNumber(row.length),
      })),
      empty: safeToNumber(emptyData.empty_count),
    };
  } catch (error) {
    console.error(
      `[TextAnalysis] Error getting text examples for ${columnName}:`,
      error
    );
    return {
      longest: [],
      shortest: [],
      empty: 0,
    };
  }
}

/**
 * Analyzes character distribution in text values
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @returns Promise resolving to character distribution analysis
 */
export async function analyzeCharacterDistribution(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<{
  averageWords: number;
  averageLines: number;
  containsNumbers: number;
  containsSpecialChars: number;
  unicodeChars: number;
}> {
  console.log(
    `[TextAnalysis] Analyzing character distribution for ${columnName}`
  );

  try {
    const charQuery = `
      SELECT 
        AVG(LENGTH(${escapeColumnName(
          columnName
        )}) - LENGTH(REPLACE(${escapeColumnName(
      columnName
    )}, ' ', '')) + 1) as avg_words,
        AVG(LENGTH(${escapeColumnName(
          columnName
        )}) - LENGTH(REPLACE(${escapeColumnName(
      columnName
    )}, chr(10), '')) + 1) as avg_lines,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} LIKE '%0%' OR ${escapeColumnName(
      columnName
    )} LIKE '%1%' OR ${escapeColumnName(
      columnName
    )} LIKE '%2%' OR ${escapeColumnName(
      columnName
    )} LIKE '%3%' OR ${escapeColumnName(
      columnName
    )} LIKE '%4%' OR ${escapeColumnName(
      columnName
    )} LIKE '%5%' OR ${escapeColumnName(
      columnName
    )} LIKE '%6%' OR ${escapeColumnName(
      columnName
    )} LIKE '%7%' OR ${escapeColumnName(
      columnName
    )} LIKE '%8%' OR ${escapeColumnName(
      columnName
    )} LIKE '%9%' THEN 1 END) as contains_numbers,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} LIKE '%!%' OR ${escapeColumnName(
      columnName
    )} LIKE '%@%' OR ${escapeColumnName(
      columnName
    )} LIKE '%#%' OR ${escapeColumnName(
      columnName
    )} LIKE '%$%' OR ${escapeColumnName(
      columnName
    )} LIKE '%\%%' THEN 1 END) as contains_special
      FROM ${tableName}
      WHERE ${getTextFilterClause(columnName, true)}
    `;

    const result = await connection.query(charQuery);
    const data = processDuckDBResult(result.toArray())[0];

    return {
      averageWords: safeToNumber(data.avg_words),
      averageLines: safeToNumber(data.avg_lines),
      containsNumbers: safeToNumber(data.contains_numbers),
      containsSpecialChars: safeToNumber(data.contains_special),
      unicodeChars: 0, // Difficult to detect reliably across different DuckDB versions
    };
  } catch (error) {
    console.error(
      `[TextAnalysis] Character distribution analysis failed for ${columnName}:`,
      error
    );
    return {
      averageWords: 0,
      averageLines: 0,
      containsNumbers: 0,
      containsSpecialChars: 0,
      unicodeChars: 0,
    };
  }
}

/**
 * Detects potential data quality issues in text columns
 * @param connection DuckDB connection
 * @param tableName Table name (should be properly escaped)
 * @param columnName Column name to analyze
 * @returns Promise resolving to text quality issues
 */
export async function detectTextQualityIssues(
  connection: duckdb.AsyncDuckDBConnection,
  tableName: string,
  columnName: string
): Promise<{
  leadingSpaces: number;
  trailingSpaces: number;
  extraWhitespace: number;
  suspiciousChars: number;
  veryLong: number;
  veryShort: number;
}> {
  console.log(`[TextAnalysis] Detecting text quality issues for ${columnName}`);

  try {
    const qualityQuery = `
      SELECT 
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} != LTRIM(${escapeColumnName(
      columnName
    )}) THEN 1 END) as leading_spaces,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} != RTRIM(${escapeColumnName(
      columnName
    )}) THEN 1 END) as trailing_spaces,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} LIKE '%  %' THEN 1 END) as extra_whitespace,
        COUNT(CASE WHEN ${escapeColumnName(
          columnName
        )} LIKE '%\t%' OR ${escapeColumnName(
      columnName
    )} LIKE '%\r%' OR ${escapeColumnName(
      columnName
    )} LIKE '%\n%' THEN 1 END) as suspicious_chars,
        COUNT(CASE WHEN LENGTH(${escapeColumnName(
          columnName
        )}) > 1000 THEN 1 END) as very_long,
        COUNT(CASE WHEN LENGTH(${escapeColumnName(
          columnName
        )}) = 1 THEN 1 END) as very_short
      FROM ${tableName}
      WHERE ${getTextFilterClause(columnName, true)}
    `;

    const result = await connection.query(qualityQuery);
    const data = processDuckDBResult(result.toArray())[0];

    const issues = {
      leadingSpaces: safeToNumber(data.leading_spaces),
      trailingSpaces: safeToNumber(data.trailing_spaces),
      extraWhitespace: safeToNumber(data.extra_whitespace),
      suspiciousChars: safeToNumber(data.suspicious_chars),
      veryLong: safeToNumber(data.very_long),
      veryShort: safeToNumber(data.very_short),
    };

    console.log(
      `[TextAnalysis] Text quality issues for ${columnName}:`,
      issues
    );
    return issues;
  } catch (error) {
    console.error(
      `[TextAnalysis] Text quality analysis failed for ${columnName}:`,
      error
    );
    return {
      leadingSpaces: 0,
      trailingSpaces: 0,
      extraWhitespace: 0,
      suspiciousChars: 0,
      veryLong: 0,
      veryShort: 0,
    };
  }
}
