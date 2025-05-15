import {
  cleanSqlQuery,
  isSelectQuery,
  addPaginationToQuery,
  createCountQuery,
  processDuckDBResult,
} from "@/lib/duckdb/utils";
import {
  PaginatedQueryOptions,
  PaginatedQueryResult,
} from "@/lib/duckdb/types";


/**
 * Executes a paginated SQL query against DuckDB
 *
 * @param options - Options for paginated query execution
 * @param connection - DuckDB connection
 * @param registeredTables - Map of registered table names to their escaped versions
 * @returns Promise resolving to paginated query result
 */
export async function executePaginatedQuery(
  {
    sql,
    page,
    pageSize,
    applyPagination = true,
    countTotalRows = true,
  }: PaginatedQueryOptions,
  connection: any, // Using any type here for simplicity, should use proper DuckDB types
  registeredTables: Map<string, string>
): Promise<PaginatedQueryResult | null> {
  const startTime = performance.now();

  try {
    console.log(
      `[DuckDBQuery] Executing paginated query (page: ${page}, size: ${pageSize})`
    );

    // Process the SQL query to add table name quotes if needed
    let processedSQL = sql;
    const knownTableNames = Array.from(registeredTables.keys());
    for (const tableName of knownTableNames) {
      const tableNameRegex = new RegExp(
        `\\b${tableName}\\b(?=(?:[^"]*"[^"]*")*[^"]*$)`,
        "g"
      );
      const escapedName = registeredTables.get(tableName) || `"${tableName}"`;
      processedSQL = processedSQL.replace(tableNameRegex, escapedName);
    }

    // Clean SQL and check if it's a SELECT query
    const cleanSQL = cleanSqlQuery(processedSQL);
    const selectQuery = isSelectQuery(cleanSQL);

    if (!selectQuery) {
      console.warn(
        `[DuckDBQuery] Non-SELECT query detected, pagination may not work as expected: ${cleanSQL.substring(
          0,
          50
        )}...`
      );
    }

    // 1. Get the total count without pagination (if applicable)
    let totalRows = 0;
    let totalPages = 0;

    if (selectQuery && countTotalRows) {
      // For standard SELECT queries, we wrap them in a COUNT
      const countQuery = createCountQuery(processedSQL);
      console.log(`[DuckDBQuery] Executing count query: ${countQuery}`);

      try {
        const countResult = await connection.query(countQuery);
        const countArray = countResult.toArray();

        // Safely extract the count, handling various numeric types
        if (countArray && countArray.length > 0) {
          const countValue = countArray[0].total_rows;

          // Handle BigInt or Number conversions
          if (typeof countValue === "bigint") {
            totalRows = Number(countValue);
            console.log(
              `[DuckDBQuery] Converted BigInt count (${countValue}) to Number (${totalRows})`
            );
          } else {
            totalRows = countValue || 0;
          }

          totalPages = Math.ceil(totalRows / pageSize);
          console.log(
            `[DuckDBQuery] Total rows: ${totalRows}, Total pages: ${totalPages}`
          );
        } else {
          console.warn(
            `[DuckDBQuery] Count query returned no results, setting totalRows to 0`
          );
          totalRows = 0;
          totalPages = 0;
        }
      } catch (countErr) {
        console.error(`[DuckDBQuery] Error executing count query:`, countErr);
        console.log(`[DuckDBQuery] Falling back to direct query without count`);
        // If count fails, we'll try to proceed with the main query
        totalRows = 0;
        totalPages = 1;
      }
    } else {
      // For non-SELECT queries, we don't paginate or count
      console.log(
        `[DuckDBQuery] Non-SELECT query or count disabled, skipping count`
      );
      totalRows = 0;
      totalPages = 1;
    }

    // 2. Execute the actual query with pagination
    let paginatedSQL = processedSQL;

    // Only add LIMIT and OFFSET if it's a SELECT query without existing LIMIT
    if (
      selectQuery &&
      applyPagination &&
      !cleanSQL.toUpperCase().includes("LIMIT")
    ) {
      const offset = (page - 1) * pageSize;
      paginatedSQL = addPaginationToQuery(processedSQL, pageSize, offset);
      console.log(
        `[DuckDBQuery] Applying pagination: LIMIT ${pageSize} OFFSET ${offset}`
      );
    }

    console.log(`[DuckDBQuery] Executing paginated SQL: ${paginatedSQL}`);
    const result = await connection.query(paginatedSQL);

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    // Process result data safely handling BigInt values
    const resultData = processDuckDBResult(result.toArray());
    const columns = result.schema.fields.map((f) => f.name);

    // If we didn't get a count (non-SELECT query), use result size
    if (totalRows === 0 && resultData.length > 0) {
      if (selectQuery) {
        // For SELECT queries without count, we know there's at least this many rows
        totalRows = (page - 1) * pageSize + resultData.length;
        // If we got less than pageSize, we might be on the last page
        const isLastPage = resultData.length < pageSize;
        totalPages = isLastPage ? page : page + 1; // At least current page + 1 more
      } else {
        totalRows = resultData.length;
        totalPages = 1;
      }
    }

    console.log(
      `[DuckDBQuery] Query executed successfully. Returned ${resultData.length} rows out of ${totalRows} total`
    );

    return {
      data: resultData,
      columns,
      totalRows,
      page,
      pageSize,
      totalPages,
      queryTime,
    };
  } catch (err) {
    console.error(`[DuckDBQuery] Paginated query execution error:`, err);
    throw err;
  }
}
