import nlp from 'compromise';
import { TableSchema } from '@/hooks/query/useSchemaInfo';

export interface ExtractedEntity {
  type: 'table' | 'column' | 'value' | 'aggregation' | 'limit' | 'condition' | 'orderBy';
  value: string;
  confidence: number;
}

export interface QueryIntent {
  intent: 'count' | 'filter' | 'sort' | 'aggregate' | 'limit' | 'group' | 'unknown';
  entities: ExtractedEntity[];
  confidence: number;
}

/**
 * Map natural language term to SQL operators
 */
const operatorMap: Record<string, string> = {
  'equal to': '=',
  'equals': '=',
  'is': '=',
  'greater than': '>',
  'more than': '>',
  'above': '>',
  'less than': '<',
  'lower than': '<',
  'below': '<',
  'not equal': '!=',
  'not equals': '!=',
  'isn\'t': '!=',
  'is not': '!=',
  'contains': 'LIKE',
  'has': 'LIKE',
  'starts with': 'LIKE',
  'ends with': 'LIKE',
  'between': 'BETWEEN',
};

/**
 * Map natural language term to SQL aggregations
 */
const aggregationMap: Record<string, string> = {
  'average': 'AVG',
  'avg': 'AVG',
  'mean': 'AVG',
  'sum': 'SUM',
  'total': 'SUM',
  'maximum': 'MAX',
  'max': 'MAX',
  'highest': 'MAX',
  'minimum': 'MIN',
  'min': 'MIN',
  'lowest': 'MIN',
  'count': 'COUNT',
  'number of': 'COUNT',
  'how many': 'COUNT',
};

/**
 * Extract table name from natural language query using available schema
 */
function extractTableName(text: string, schema: TableSchema[]): ExtractedEntity | null {
  // No schema available
  if (!schema || schema.length === 0) {
    return null;
  }
  
  // If only one table exists, return it
  if (schema.length === 1) {
    return {
      type: 'table',
      value: schema[0].name,
      confidence: 1.0
    };
  }
  
  // Try to match table name in the text
  const doc = nlp(text);
  const nouns = doc.nouns().out('array') as string[];
  
  // Check each noun against table names
  for (const noun of nouns) {
    for (const table of schema) {
      // Direct match
      if (table.name.toLowerCase() === noun.toLowerCase()) {
        return {
          type: 'table',
          value: table.name,
          confidence: 1.0
        };
      }
      
      // Singular/plural match (simple English pluralization)
      const singularNoun = noun.endsWith('s') ? noun.slice(0, -1) : noun;
      const pluralTableName = table.name.endsWith('s') ? table.name : `${table.name}s`;
      
      if (
        table.name.toLowerCase() === singularNoun.toLowerCase() ||
        pluralTableName.toLowerCase() === noun.toLowerCase()
      ) {
        return {
          type: 'table',
          value: table.name,
          confidence: 0.9
        };
      }
    }
  }
  
  // Default to the first table with low confidence
  return {
    type: 'table',
    value: schema[0].name,
    confidence: 0.5
  };
}

/**
 * Extract column name from natural language query using available schema
 */
function extractColumnName(text: string, tableSchema: TableSchema | null): ExtractedEntity | null {
  if (!tableSchema || !tableSchema.columns || tableSchema.columns.length === 0) {
    return null;
  }
  
  const doc = nlp(text);
  const nouns = doc.nouns().out('array') as string[];
  
  // First check direct column name matches
  for (const noun of nouns) {
    for (const column of tableSchema.columns) {
      // Direct match
      if (column.name.toLowerCase() === noun.toLowerCase()) {
        return {
          type: 'column',
          value: column.name,
          confidence: 1.0
        };
      }
      
      // Check if the column name has underscores or camelCase and match parts
      const parts = column.name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .trim()
        .split(' ');
      
      if (parts.includes(noun.toLowerCase())) {
        return {
          type: 'column',
          value: column.name,
          confidence: 0.8
        };
      }
    }
  }
  
  // If looking for count/aggregation, try to find a numeric column
  if (text.toLowerCase().includes('count') || 
      text.toLowerCase().includes('sum') || 
      text.toLowerCase().includes('average')) {
    const numericColumn = tableSchema.columns.find(col => 
      ['int', 'integer', 'number', 'double', 'float', 'decimal'].some(t => 
        col.type.toLowerCase().includes(t))
    );
    
    if (numericColumn) {
      return {
        type: 'column',
        value: numericColumn.name,
        confidence: 0.7
      };
    }
  }
  
  // Default to the first column with low confidence
  return {
    type: 'column',
    value: tableSchema.columns[0].name,
    confidence: 0.5
  };
}

/**
 * Extract value/condition from natural language query
 */
function extractConditionValue(text: string): ExtractedEntity | null {
  // Look for specific patterns like "equals X", "greater than Y", etc.
  for (const [phrase, operator] of Object.entries(operatorMap)) {
    const regex = new RegExp(`${phrase}\\s+([\\w\\d.]+)`, 'i');
    const match = text.match(regex);
    
    if (match && match[1]) {
      return {
        type: 'value',
        value: match[1],
        confidence: 0.9
      };
    }
  }
  
  // Look for numbers
  const numbers = nlp(text).numbers().out('array');
  if (numbers && numbers.length > 0) {
    return {
      type: 'value',
      value: numbers[0],
      confidence: 0.8
    };
  }
  
  // Look for quoted strings
  const quotedMatch = text.match(/'([^']*)'/);
  if (quotedMatch && quotedMatch[1]) {
    return {
      type: 'value',
      value: quotedMatch[1],
      confidence: 1.0
    };
  }
  
  return null;
}

/**
 * Extract aggregation function from natural language query
 */
function extractAggregation(text: string): ExtractedEntity | null {
  const lowerText = text.toLowerCase();
  
  for (const [phrase, func] of Object.entries(aggregationMap)) {
    if (lowerText.includes(phrase)) {
      return {
        type: 'aggregation',
        value: func,
        confidence: 0.9
      };
    }
  }
  
  return null;
}

/**
 * Extract order by info from natural language query
 */
function extractOrderBy(text: string): ExtractedEntity | null {
  const lowerText = text.toLowerCase();
  
  // Check for common sorting phrases
  if (lowerText.includes('sort by') || 
      lowerText.includes('order by') || 
      lowerText.includes('sorted by')) {
    
    // Determine direction
    const isDescending = 
      lowerText.includes('descending') || 
      lowerText.includes('desc') || 
      lowerText.includes('highest') || 
      lowerText.includes('largest') ||
      lowerText.includes('biggest');
    
    return {
      type: 'orderBy',
      value: isDescending ? 'DESC' : 'ASC',
      confidence: 0.8
    };
  }
  
  return null;
}

/**
 * Extract limit value from natural language query
 */
function extractLimit(text: string): ExtractedEntity | null {
  // Look for "top N", "first N", "limit to N", etc.
  const limitMatch = text.match(/top\s+(\d+)|first\s+(\d+)|limit\s+to\s+(\d+)|limit\s+(\d+)/i);
  
  if (limitMatch) {
    const limit = limitMatch[1] || limitMatch[2] || limitMatch[3] || limitMatch[4];
    return {
      type: 'limit',
      value: limit,
      confidence: 0.9
    };
  }
  
  return null;
}

/**
 * Determine the primary intent of the query
 */
function detectPrimaryIntent(text: string, entities: ExtractedEntity[]): QueryIntent {
  const lowerText = text.toLowerCase();
  
  // Count/aggregation intent
  if (lowerText.includes('how many') || 
      lowerText.includes('count') || 
      entities.some(e => e.type === 'aggregation')) {
    return {
      intent: 'aggregate',
      entities,
      confidence: 0.9
    };
  }
  
  // Filter intent
  if (lowerText.includes('where') || 
      lowerText.includes('filter') || 
      lowerText.match(/show\s+.*\s+with/i) ||
      entities.some(e => e.type === 'value')) {
    return {
      intent: 'filter',
      entities,
      confidence: 0.8
    };
  }
  
  // Sort intent
  if (lowerText.includes('sort') || 
      lowerText.includes('order by') || 
      entities.some(e => e.type === 'orderBy')) {
    return {
      intent: 'sort',
      entities,
      confidence: 0.8
    };
  }
  
  // Limit intent
  if (entities.some(e => e.type === 'limit')) {
    return {
      intent: 'limit',
      entities,
      confidence: 0.7
    };
  }
  
  // Default to 'count' if we can't determine intent
  return {
    intent: 'count',
    entities,
    confidence: 0.6
  };
}

/**
 * Process natural language query and extract structured information
 */
export function detectIntent(text: string, schema: TableSchema[]): QueryIntent {
  const entities: ExtractedEntity[] = [];
  
  // Extract table name
  const tableEntity = extractTableName(text, schema);
  if (tableEntity) {
    entities.push(tableEntity);
  }
  
  // Extract column name using the matched table schema
  let tableSchema = null;
  if (tableEntity) {
    tableSchema = schema.find(s => s.name === tableEntity.value) || null;
  } else if (schema.length > 0) {
    tableSchema = schema[0];
  }
  
  if (tableSchema) {
    const columnEntity = extractColumnName(text, tableSchema);
    if (columnEntity) {
      entities.push(columnEntity);
    }
  }
  
  // Extract other entities
  const aggregationEntity = extractAggregation(text);
  if (aggregationEntity) {
    entities.push(aggregationEntity);
  }
  
  const orderByEntity = extractOrderBy(text);
  if (orderByEntity) {
    entities.push(orderByEntity);
  }
  
  const limitEntity = extractLimit(text);
  if (limitEntity) {
    entities.push(limitEntity);
  }
  
  const valueEntity = extractConditionValue(text);
  if (valueEntity) {
    entities.push(valueEntity);
  }
  
  // Determine primary intent
  return detectPrimaryIntent(text, entities);
}