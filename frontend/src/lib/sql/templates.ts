export interface QueryTemplate {
    id: string;
    text: string;         // Natural language query
    sqlTemplate: string;  // SQL template with placeholders
    category: string;     // Group templates by function
    entityPatterns: {     // Patterns to extract entities
      [key: string]: RegExp | string;
    };
    requiredTables?: string[]; // Tables required for this query
    complexity: 'simple' | 'medium' | 'complex'; // Indicates complexity level
  }
  
  // Sample templates to get started
  export const getSampleTemplates = (): QueryTemplate[] => [
    // Counting & Aggregation
    {
      id: 'count-all',
      text: 'How many rows are in the table?',
      sqlTemplate: 'SELECT COUNT(*) FROM "{table}";',
      category: 'Counting & Aggregation',
      entityPatterns: { table: '.+' },
      complexity: 'simple'
    },
    {
      id: 'count-by-condition',
      text: 'Count rows where a column has a specific value',
      sqlTemplate: 'SELECT COUNT(*) FROM "{table}" WHERE "{column}" = \'{value}\';',
      category: 'Counting & Aggregation',
      entityPatterns: { table: '.+', column: '.+', value: '.+' },
      complexity: 'simple'
    },
    {
      id: 'sum-column',
      text: 'Sum a column',
      sqlTemplate: 'SELECT SUM("{column}") FROM "{table}";',
      category: 'Counting & Aggregation',
      entityPatterns: { table: '.+', column: '.+' },
      complexity: 'simple'
    },
    
    // Filtering & Sorting
    {
      id: 'filter-equals',
      text: 'Show rows where column equals value',
      sqlTemplate: 'SELECT * FROM "{table}" WHERE "{column}" = \'{value}\';',
      category: 'Filtering & Sorting',
      entityPatterns: { table: '.+', column: '.+', value: '.+' },
      complexity: 'simple'
    },
    {
      id: 'filter-contains',
      text: 'Find rows where column contains text',
      sqlTemplate: 'SELECT * FROM "{table}" WHERE "{column}" LIKE \'%{value}%\';',
      category: 'Filtering & Sorting',
      entityPatterns: { table: '.+', column: '.+', value: '.+' },
      complexity: 'simple'
    },
    {
      id: 'sort-desc',
      text: 'Sort by column in descending order',
      sqlTemplate: 'SELECT * FROM "{table}" ORDER BY "{column}" DESC LIMIT 100;',
      category: 'Filtering & Sorting',
      entityPatterns: { table: '.+', column: '.+' },
      complexity: 'simple'
    },
    
    // Statistics
    {
      id: 'average',
      text: 'Calculate average of a column',
      sqlTemplate: 'SELECT AVG("{column}") FROM "{table}";',
      category: 'Statistics',
      entityPatterns: { table: '.+', column: '.+' },
      complexity: 'simple'
    },
    {
      id: 'min-max',
      text: 'Find minimum and maximum values',
      sqlTemplate: 'SELECT MIN("{column}") as min_value, MAX("{column}") as max_value FROM "{table}";',
      category: 'Statistics',
      entityPatterns: { table: '.+', column: '.+' },
      complexity: 'simple'
    },
    {
      id: 'column-stats',
      text: 'Show statistics for a column',
      sqlTemplate: 'SELECT COUNT(*) as count, AVG("{column}") as average, MIN("{column}") as minimum, MAX("{column}") as maximum, SUM("{column}") as total FROM "{table}";',
      category: 'Statistics',
      entityPatterns: { table: '.+', column: '.+' },
      complexity: 'medium'
    },
    
    // Grouping
    {
      id: 'group-by-count',
      text: 'Count rows grouped by a column',
      sqlTemplate: 'SELECT "{column}", COUNT(*) as count FROM "{table}" GROUP BY "{column}" ORDER BY count DESC;',
      category: 'Grouping',
      entityPatterns: { table: '.+', column: '.+' },
      complexity: 'medium'
    },
    {
      id: 'group-by-sum',
      text: 'Sum a column grouped by another column',
      sqlTemplate: 'SELECT "{groupColumn}", SUM("{sumColumn}") as total FROM "{table}" GROUP BY "{groupColumn}" ORDER BY total DESC;',
      category: 'Grouping',
      entityPatterns: { table: '.+', groupColumn: '.+', sumColumn: '.+' },
      complexity: 'medium'
    },
    
    // Advanced Queries
    {
      id: 'percentile',
      text: 'Calculate percentiles for a column',
      sqlTemplate: 'SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "{column}") as median, percentile_cont(0.25) WITHIN GROUP (ORDER BY "{column}") as q1, percentile_cont(0.75) WITHIN GROUP (ORDER BY "{column}") as q3 FROM "{table}";',
      category: 'Advanced',
      entityPatterns: { table: '.+', column: '.+' },
      complexity: 'complex'
    },
    {
      id: 'top-n',
      text: 'Show top N rows by a column',
      sqlTemplate: 'SELECT * FROM "{table}" ORDER BY "{column}" DESC LIMIT {n};',
      category: 'Advanced',
      entityPatterns: { table: '.+', column: '.+', n: '\\d+' },
      complexity: 'medium'
    }
  ];
  
  // Export template finding utilities
  export const findTemplateById = (id: string): QueryTemplate | undefined => {
    return getSampleTemplates().find(template => template.id === id);
  };
  
  export const findTemplateByText = (text: string): QueryTemplate | undefined => {
    return getSampleTemplates().find(template => 
      template.text.toLowerCase() === text.toLowerCase()
    );
  };