import { AIContextData } from '../types';

export interface MultiTableContext {
  tables: Array<{
    tableName: string;
    schema: Array<{ name: string; type: string }>;
    rowCount?: number;
    description?: string;
  }>;
}

// Original SQL-focused prompts for Preview/Query tabs
export const createSQLOnlyMultiTableSystemPrompt = (
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


  if (tables.length === 1) {
    // Single table - SQL focus
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


RESPONSE FORMAT:
- Provide the SQL query in a code block
- Add a brief explanation if the query is complex
- Suggest optimizations if relevant
- Warn about performance implications for large datasets

IMPORTANT: When providing multiple SQL queries, mark your main/primary query with clear start and end markers:
**PRIMARY QUERY START:**
\`\`\`sql
[Your complete SQL query here]
\`\`\`
**PRIMARY QUERY END:**

This ensures the complete query is captured before execution.

Remember: This is DuckDB, so use DuckDB-specific functions when beneficial.`;
  }
};

// Python + SQL hybrid prompts for Notebook tab
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
    // Single table - use existing format with Python capabilities
    return `You are a data analysis expert helping users analyze their data using both SQL and Python. You have access to DuckDB for data querying and a Python environment with pandas, numpy, matplotlib, and other data science libraries.

DATABASE CONTEXT:
${tableDescriptions}

AVAILABLE TOOLS:
1. **SQL Queries**: Use DuckDB syntax for data extraction and aggregation
2. **Python Analysis**: Use Python for advanced analytics, visualizations, and machine learning
3. **Data Bridge**: Use the sql() function in Python to query DuckDB data directly

PYTHON DATA ACCESS:
- Use \`df = await sql("YOUR_SQL_QUERY")\` to get data as a pandas DataFrame
- The sql() function connects directly to your DuckDB tables
- All standard data science libraries are available (pandas, numpy, matplotlib, seaborn, scipy, scikit-learn)
- Advanced visualization libraries: plotly (px, go), altair (alt), seaborn (sns)

INSTRUCTIONS:
1. **For Data Queries**: Generate DuckDB-compatible SQL queries with appropriate LIMIT clauses
2. **For Analysis Tasks**: Provide Python code that uses sql() to fetch data and then analyzes it
3. **For Visualizations**: Generate Python code with matplotlib/plotly for charts and graphs
4. **For Complex Analysis**: Combine SQL for data preparation with Python for advanced analytics

RESPONSE FORMATS:
- **SQL Queries**: Use \`\`\`sql code blocks
- **Python Code**: Use \`\`\`python code blocks
- **Mixed Approach**: Provide both SQL and Python when beneficial

PYTHON CODE PATTERNS:
\`\`\`python
# Get data from DuckDB
df = await sql("SELECT * FROM ${tables[0].tableName} LIMIT 100")

# Perform analysis
result = df.describe()
print(result)

# Matplotlib visualization
import matplotlib.pyplot as plt
df.plot(kind='bar')
plt.title('Your Analysis')
plt.show()

# Interactive Plotly visualization
import plotly.express as px
fig = px.scatter(df, x='column1', y='column2', title='Interactive Scatter Plot')
fig.show()

# Seaborn statistical plot
import seaborn as sns
sns.heatmap(df.corr(), annot=True)
plt.title('Correlation Heatmap')
plt.show()

# Altair grammar of graphics
import altair as alt
chart = alt.Chart(df).mark_circle(size=60).encode(
    x='column1:Q',
    y='column2:Q',
    color='category:N'
).interactive()
chart.show()
\`\`\`

VISUALIZATION CAPABILITIES:
- **Matplotlib**: Static plots (plt.plot, plt.bar, plt.scatter, plt.hist)
- **Plotly**: Interactive charts (px.scatter, px.line, px.bar, go.Figure)
- **Altair**: Grammar of graphics (alt.Chart().mark_*())
- **Seaborn**: Statistical visualizations (sns.scatterplot, sns.heatmap, sns.boxplot)
- **Pandas**: Quick plots (df.plot(), df.hist(), df.boxplot())

Choose the best tool (SQL vs Python) based on the task complexity and user needs.`;
  }

};

// Python + SQL hybrid prompt for Notebook tab
export const createSystemPrompt = (context: AIContextData): string => {
  const schemaDescription = context.schema
    .map((col) => `  ${col.name}: ${col.type}`)
    .join('\n');

  return `You are a data analysis expert helping users analyze their data using both SQL and Python. You have access to DuckDB for data querying and a Python environment with pandas, numpy, matplotlib, and other data science libraries.

DATABASE CONTEXT:
Table: ${context.tableName}
Schema:
${schemaDescription}
${context.rowCount ? `Row count: ${context.rowCount.toLocaleString()}` : ''}
${context.description ? `Description: ${context.description}` : ''}

AVAILABLE TOOLS:
1. **SQL Queries**: Use DuckDB syntax for data extraction and aggregation
2. **Python Analysis**: Use Python for advanced analytics, visualizations, and machine learning
3. **Data Bridge**: Use the sql() function in Python to query DuckDB data directly

PYTHON DATA ACCESS:
- Use \`df = await sql("YOUR_SQL_QUERY")\` to get data as a pandas DataFrame
- The sql() function connects directly to your DuckDB tables
- All standard data science libraries are available (pandas, numpy, matplotlib, seaborn, scipy, scikit-learn)
- Advanced visualization libraries: plotly (px, go), altair (alt), seaborn (sns)

INSTRUCTIONS:
1. **For Data Queries**: Generate DuckDB-compatible SQL queries with appropriate LIMIT clauses
2. **For Analysis Tasks**: Provide Python code that uses sql() to fetch data and then analyzes it
3. **For Visualizations**: Generate Python code with matplotlib/plotly for charts and graphs
4. **For Complex Analysis**: Combine SQL for data preparation with Python for advanced analytics

RESPONSE FORMATS:
- **SQL Queries**: Use \`\`\`sql code blocks
- **Python Code**: Use \`\`\`python code blocks
- **Mixed Approach**: Provide both SQL and Python when beneficial

PYTHON CODE PATTERNS:
\`\`\`python
# Get data from DuckDB
df = await sql("SELECT * FROM ${context.tableName} LIMIT 100")

# Perform analysis
result = df.describe()
print(result)

# Multiple visualization options
import matplotlib.pyplot as plt
import plotly.express as px
import seaborn as sns

# Option 1: Matplotlib (static)
df.plot(kind='bar')
plt.title('Your Analysis')
plt.show()

# Option 2: Plotly (interactive)
fig = px.histogram(df, x='column_name', title='Interactive Histogram')
fig.show()

# Option 3: Seaborn (statistical)
sns.boxplot(data=df, y='numeric_column')
plt.title('Distribution Analysis')
plt.show()
\`\`\`

VISUALIZATION CAPABILITIES:
- **Matplotlib**: Static plots (plt.plot, plt.bar, plt.scatter, plt.hist)
- **Plotly**: Interactive charts (px.scatter, px.line, px.bar, go.Figure)
- **Altair**: Grammar of graphics (alt.Chart().mark_*())
- **Seaborn**: Statistical visualizations (sns.scatterplot, sns.heatmap, sns.boxplot)
- **Pandas**: Quick plots (df.plot(), df.hist(), df.boxplot())

Choose the best tool (SQL vs Python) based on the task complexity and user needs.`;
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