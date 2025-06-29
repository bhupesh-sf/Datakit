import { AIContextData } from "../types";

export const createSystemPrompt = (context: AIContextData): string => {
  const schemaDescription = context.schema
    .map(col => `  ${col.name}: ${col.type}`)
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

RESPONSE FORMAT:
- Provide the SQL query in a code block
- Add a brief explanation if the query is complex
- Suggest optimizations if relevant
- Warn about performance implications for large datasets

Remember: This is DuckDB, so use DuckDB-specific functions when beneficial.`;
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
Available columns: ${context.schema.map(col => `${col.name} (${col.type})`).join(', ')}

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
    const sampleDataStr = context.sampleData.slice(0, 3)
      .map(row => JSON.stringify(row))
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
Schema: ${context.schema.map(col => `${col.name} (${col.type})`).join(', ')}
${context.rowCount ? `Total rows: ${context.rowCount.toLocaleString()}` : ''}

Please provide:
1. Key insights and patterns
2. Statistical summary if relevant
3. Recommendations for further analysis
4. Potential data quality issues
5. Suggested visualizations

Format your response with clear sections and actionable insights.`;

  if (dataPreview && dataPreview.length > 0) {
    const previewStr = dataPreview.slice(0, 5)
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
Available columns: ${context.schema.map(col => `${col.name} (${col.type})`).join(', ')}

Please suggest:
1. The most appropriate chart type (bar, line, scatter, pie, etc.)
2. Which columns to use for X and Y axes
3. Any necessary data aggregations or groupings
4. Color coding or categorization strategies
5. The SQL query needed to prepare the data

Provide both the visualization recommendation and the SQL query to generate the required data.`;
};

export const createQueryOptimizationPrompt = (sql: string, context: AIContextData): string => {
  return `Analyze and optimize this SQL query for DuckDB:

\`\`\`sql
${sql}
\`\`\`

Table: ${context.tableName}
Schema: ${context.schema.map(col => `${col.name} (${col.type})`).join(', ')}
${context.rowCount ? `Row count: ${context.rowCount.toLocaleString()}` : ''}

Please provide:
1. Performance analysis
2. Optimization suggestions
3. Alternative query approaches
4. Potential issues or warnings
5. Best practices recommendations

Focus on DuckDB-specific optimizations and consider the data size.`;
};