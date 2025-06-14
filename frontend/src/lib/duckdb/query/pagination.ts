const hasLimitClause = (sql: string): boolean => {
  // Don't check for LIMIT in DDL statements
  if (/^\s*(CREATE|DROP|ALTER)\s+/i.test(sql)) {
    return true; // Pretend it has a limit so we don't add one
  }
  return /\s+LIMIT\s+\d+/i.test(sql);
};

/**
 * Add LIMIT clause only if none exists and it's not a DDL statement
 */
const addLimitIfMissing = (
  sql: string,
  page: number,
  pageSize: number
): string => {
  // Never add LIMIT to DDL statements
  if (/^\s*(CREATE|DROP|ALTER)\s+/i.test(sql)) {
    return sql.trim();
  }
  
  if (hasLimitClause(sql)) {
    // User specified LIMIT - respect it completely
    return sql.trim();
  }

  // No LIMIT - add pagination
  const offset = (page - 1) * pageSize;
  let cleanSql = sql.trim();

  // Remove trailing semicolon if present
  if (cleanSql.endsWith(";")) {
    cleanSql = cleanSql.slice(0, -1).trim();
  }

  return `${cleanSql} LIMIT ${pageSize} OFFSET ${offset}`;
};

export { addLimitIfMissing, hasLimitClause };