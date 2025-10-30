export interface ChartSuggestion {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'none';
  xAxis?: string;
  yAxis?: string;
  colorBy?: string;
  description?: string;
}

/**
 * Parse AI chart suggestions from response text
 * Example: "bar chart: x=category, y=count" or "line chart: x=date, y=sales, color=region"
 */
export function parseChartSuggestion(suggestion: string): ChartSuggestion | null {
  if (!suggestion || suggestion.toLowerCase().includes('none')) {
    return { type: 'none' };
  }

  const cleanSuggestion = suggestion.toLowerCase().trim();
  
  // Extract chart type
  const chartTypes = ['bar', 'line', 'pie', 'scatter', 'area'];
  const type = chartTypes.find(t => cleanSuggestion.includes(t)) as ChartSuggestion['type'];
  
  if (!type) {
    return { type: 'none' };
  }

  // Extract axis and color mappings
  const xMatch = cleanSuggestion.match(/x[=:]\s*([^,\s]+)/);
  const yMatch = cleanSuggestion.match(/y[=:]\s*([^,\s]+)/);
  const colorMatch = cleanSuggestion.match(/color[=:]\s*([^,\s]+)/);

  return {
    type,
    xAxis: xMatch?.[1],
    yAxis: yMatch?.[1],
    colorBy: colorMatch?.[1],
    description: suggestion
  };
}

/**
 * Auto-detect best chart type based on data structure
 */
export function suggestChartType(
  data: any[][],
  columnTypes: Array<{ name: string; type: string }>
): ChartSuggestion {
  if (!data || data.length < 2 || !columnTypes || columnTypes.length < 2) {
    return { type: 'none' };
  }

  const headers = data[0].slice(1); // Skip row number column
  const numericColumns = columnTypes.filter(col => 
    ['INTEGER', 'DOUBLE', 'FLOAT', 'DECIMAL', 'BIGINT'].includes(col.type.toUpperCase())
  );
  const categoricalColumns = columnTypes.filter(col => 
    ['VARCHAR', 'TEXT', 'STRING'].includes(col.type.toUpperCase())
  );
  const dateColumns = columnTypes.filter(col => 
    ['DATE', 'DATETIME', 'TIMESTAMP'].includes(col.type.toUpperCase())
  );

  // Time series data - prefer line charts
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    return {
      type: 'line',
      xAxis: dateColumns[0].name,
      yAxis: numericColumns[0].name,
      description: 'Time series visualization'
    };
  }

  // Categorical with numeric - prefer bar charts
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    return {
      type: 'bar',
      xAxis: categoricalColumns[0].name,
      yAxis: numericColumns[0].name,
      description: 'Category comparison'
    };
  }

  // Two numeric columns - prefer scatter plot
  if (numericColumns.length >= 2) {
    return {
      type: 'scatter',
      xAxis: numericColumns[0].name,
      yAxis: numericColumns[1].name,
      description: 'Correlation analysis'
    };
  }

  // Single categorical column (for counts) - pie chart
  if (categoricalColumns.length === 1) {
    return {
      type: 'pie',
      xAxis: categoricalColumns[0].name,
      description: 'Distribution breakdown'
    };
  }

  return { type: 'none', description: 'No suitable chart type detected' };
}

/**
 * Prepare data for chart visualization
 */
export function prepareChartData(
  data: any[][],
  suggestion: ChartSuggestion
): any[] {
  if (!data || data.length < 2 || suggestion.type === 'none') {
    return [];
  }

  const headers = data[0].slice(1); // Skip row number column
  const xIndex = suggestion.xAxis ? headers.indexOf(suggestion.xAxis) : -1;
  const yIndex = suggestion.yAxis ? headers.indexOf(suggestion.yAxis) : -1;
  const colorIndex = suggestion.colorBy ? headers.indexOf(suggestion.colorBy) : -1;

  if (xIndex === -1) return [];

  return data.slice(1).map((row, index) => {
    const item: any = {
      id: index,
      [suggestion.xAxis!]: row[xIndex + 1], // +1 to account for row number column
    };

    if (yIndex !== -1 && suggestion.yAxis) {
      const rawValue = row[yIndex + 1];
      // Try to parse as number, fallback to 1 for counting/aggregation
      const numValue = parseFloat(rawValue);
      item[suggestion.yAxis] = isNaN(numValue) ? 1 : numValue;
    }

    if (colorIndex !== -1 && suggestion.colorBy) {
      item[suggestion.colorBy] = row[colorIndex + 1];
    }

    return item;
  });
}