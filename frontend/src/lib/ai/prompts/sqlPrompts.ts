import { AIContextData } from '../types';

export interface MultiTableContext {
  tables: Array<{
    tableName: string;
    schema: Array<{ name: string; type: string }>;
    rowCount?: number;
    description?: string;
  }>;
}

export const createMultiTableSystemPrompt = (
  context: MultiTableContext
): string => {
  const { tables } = context;

  if (tables.length === 0) {
    return `You are a SQL expert helping users query their data using DuckDB syntax.`;
  }

  // Build table descriptions
  const tableDescriptions = tables
    .map((table, index) => {
      const schemaDescription = table.schema
        .map((col) => `  ${col.name}: ${col.type}`)
        .join('\n');

      return `${index > 0 ? '\n' : ''}Table: ${table.tableName}
${table.description ? `Description: ${table.description}\n` : ''}${
        table.rowCount ? `Row count: ${table.rowCount.toLocaleString()}\n` : ''
      }Schema:
${schemaDescription}`;
    })
    .join('\n');

  const tableNames = tables.map((t) => `"${t.tableName}"`).join(', ');

  if (tables.length === 1) {
    // Single table - use existing format
    return `You are a SQL expert helping users query their data using DuckDB syntax. 

DATABASE CONTEXT:
${tableDescriptions}

INSTRUCTIONS:
1. Generate DuckDB-compatible SQL queries
2. Always include LIMIT clauses for large datasets (default 100 rows)
3. Use proper column names as shown in the schema
4. Handle data types appropriately (BIGINT for large numbers, etc.)
5. Provide clear, efficient queries
6. If the request is ambiguous, make reasonable assumptions
7. Include brief explanations when helpful
8. For visualization requests, optimize queries for charting (aggregations, proper ordering)

VISUALIZATION HINTS:
- Time series: Use date_trunc() for appropriate granularity
- Comparisons: Include GROUP BY for categories
- Distributions: Consider using histogram() or approx_quantile()
- Keep result sets reasonable for visualization (< 1000 points)

RESPONSE FORMAT:
- Provide the SQL query in a code block
- Add a brief explanation if the query is complex
- For visualization requests, mention the chart type that would work best
- Suggest optimizations if relevant
- Warn about performance implications for large datasets

Remember: This is DuckDB, so use DuckDB-specific functions when beneficial.`;
  }

  // Multi-table context
  return `You are a SQL expert helping users query their data using DuckDB syntax.

DATABASE CONTEXT:
You have access to ${tables.length} tables: ${tableNames}

${tableDescriptions}

INSTRUCTIONS:
1. Generate DuckDB-compatible SQL queries
2. Use the exact table and column names as shown above
3. When joining tables, use appropriate join conditions
4. Always include LIMIT clauses for large datasets (default 100 rows)
5. Handle data types appropriately (BIGINT for large numbers, etc.)
6. Provide clear, efficient queries
7. If the user doesn't specify which table to use, infer from context or ask for clarification
8. For cross-table analysis, suggest appropriate JOINs

MULTI-TABLE QUERY HINTS:
- Use table aliases for clarity when joining
- Consider performance implications of joining large tables
- Suggest indexes if beneficial for common join patterns
- Use CTEs (WITH clauses) for complex multi-table queries

VISUALIZATION HINTS:
- Time series: Use date_trunc() for appropriate granularity
- Comparisons: Include GROUP BY for categories
- Distributions: Consider using histogram() or approx_quantile()
- Keep result sets reasonable for visualization (< 1000 points)

RESPONSE FORMAT:
- Provide the SQL query in a code block
- Specify which table(s) are being used
- Add brief explanations for complex queries
- For multi-table queries, explain the join logic
- Suggest optimizations if relevant
- Warn about performance implications for large datasets

Remember: This is DuckDB, so use DuckDB-specific functions when beneficial.`;
};

export const createSystemPrompt = (context: AIContextData): string => {
  const schemaDescription = context.schema
    .map((col) => `  ${col.name}: ${col.type}`)
    .join('\n');

  return `You are a SQL expert helping users query their data using DuckDB syntax. 

DATABASE CONTEXT:
Table: ${context.tableName}
Schema:
${schemaDescription}
${context.rowCount ? `Row count: ${context.rowCount.toLocaleString()}` : ''}
${context.description ? `Description: ${context.description}` : ''}

INSTRUCTIONS:
1. Generate DuckDB-compatible SQL queries
2. Always include LIMIT clauses for large datasets (default 100 rows)
3. Use proper column names as shown in the schema
4. Handle data types appropriately (BIGINT for large numbers, etc.)
5. Provide clear, efficient queries
6. If the request is ambiguous, make reasonable assumptions
7. Include brief explanations when helpful
8. For visualization requests, optimize queries for charting (aggregations, proper ordering)

VISUALIZATION HINTS:
- Time series: Use date_trunc() for appropriate granularity
- Comparisons: Include GROUP BY for categories
- Distributions: Consider using histogram() or approx_quantile()
- Keep result sets reasonable for visualization (< 1000 points)

RESPONSE FORMAT:
- Provide the SQL query in a code block
- Add a brief explanation if the query is complex
- For visualization requests, mention the chart type that would work best
- Suggest optimizations if relevant
- Warn about performance implications for large datasets

Remember: This is DuckDB, so use DuckDB-specific functions when beneficial.`;
};

export const createMultiTableSQLPrompt = (
  userPrompt: string,
  context: MultiTableContext,
  options?: {
    includeExplanation?: boolean;
    maxRows?: number;
    includeOptimization?: boolean;
  }
): string => {
  const { tables } = context;
  const maxRows = options?.maxRows || 100;

  if (tables.length === 0) {
    return `Generate a SQL query for: "${userPrompt}"
    
No tables available. Please add tables to the context first.`;
  }

  const tableNames = tables.map((t) => t.tableName).join(', ');
  const tableDetails = tables
    .map(
      (t) =>
        `Table "${t.tableName}": ${t.schema
          .map((col) => `${col.name} (${col.type})`)
          .join(', ')}`
    )
    .join('\n');

  let prompt = `Generate a SQL query for: "${userPrompt}"

Available tables: ${tableNames}

${tableDetails}

Requirements:
- Use DuckDB syntax
- Include LIMIT ${maxRows} unless the user specifically requests more
- Ensure table and column names match exactly
- Use proper table prefixes or aliases when joining tables
- Handle data types properly`;

  if (tables.length > 1) {
    prompt += '\n- If joining tables, ensure proper join conditions';
  }

  if (options?.includeExplanation) {
    prompt += '\n- Include a brief explanation of the query';
  }

  if (options?.includeOptimization) {
    prompt += '\n- Suggest any performance optimizations';
  }

  return prompt;
};

export const createSQLPrompt = (
  userPrompt: string,
  context: AIContextData,
  options?: {
    includeExplanation?: boolean;
    maxRows?: number;
    includeOptimization?: boolean;
  }
): string => {
  const maxRows = options?.maxRows || 100;
  let prompt = `Generate a SQL query for: "${userPrompt}"

Table: ${context.tableName}
Available columns: ${context.schema
    .map((col) => `${col.name} (${col.type})`)
    .join(', ')}

Requirements:
- Use DuckDB syntax
- Include LIMIT ${maxRows} unless the user specifically requests more
- Ensure column names match exactly
- Handle data types properly`;

  if (options?.includeExplanation) {
    prompt += '\n- Include a brief explanation of the query';
  }

  if (options?.includeOptimization) {
    prompt += '\n- Suggest any performance optimizations';
  }

  if (context.sampleData && context.sampleData.length > 0) {
    const sampleDataStr = context.sampleData
      .slice(0, 3)
      .map((row) => JSON.stringify(row))
      .join('\n');
    prompt += `\n\nSample data for reference:
${sampleDataStr}`;
  }

  return prompt;
};

export const createDataAnalysisPrompt = (
  userPrompt: string,
  context: AIContextData,
  dataPreview?: any[]
): string => {
  let prompt = `Analyze the data based on: "${userPrompt}"

Table: ${context.tableName}
Schema: ${context.schema.map((col) => `${col.name} (${col.type})`).join(', ')}
${context.rowCount ? `Total rows: ${context.rowCount.toLocaleString()}` : ''}

Please provide:
1. Key insights and patterns
2. Statistical summary if relevant
3. Recommendations for further analysis
4. Potential data quality issues
5. Suggested visualizations

Format your response with clear sections and actionable insights.`;

  if (dataPreview && dataPreview.length > 0) {
    const previewStr = dataPreview
      .slice(0, 5)
      .map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`)
      .join('\n');
    prompt += `\n\nData preview:
${previewStr}`;
  }

  return prompt;
};

export const createVisualizationPrompt = (
  userPrompt: string,
  context: AIContextData
): string => {
  return `Create a visualization suggestion for: "${userPrompt}"

Table: ${context.tableName}
Available columns: ${context.schema
    .map((col) => `${col.name} (${col.type})`)
    .join(', ')}

Please suggest:
1. The most appropriate chart type (bar, line, scatter, pie, etc.)
2. Which columns to use for X and Y axes
3. Any necessary data aggregations or groupings
4. Color coding or categorization strategies
5. The SQL query needed to prepare the data

Provide both the visualization recommendation and the SQL query to generate the required data.`;
};

export const createQueryOptimizationPrompt = (
  sql: string,
  context: AIContextData
): string => {
  return `Analyze and optimize this SQL query for DuckDB:

\`\`\`sql
${sql}
\`\`\`

Table: ${context.tableName}
Schema: ${context.schema.map((col) => `${col.name} (${col.type})`).join(', ')}
${context.rowCount ? `Row count: ${context.rowCount.toLocaleString()}` : ''}

Please provide:
1. Performance analysis
2. Optimization suggestions
3. Alternative query approaches
4. Potential issues or warnings
5. Best practices recommendations

Focus on DuckDB-specific optimizations and consider the data size.`;
};
