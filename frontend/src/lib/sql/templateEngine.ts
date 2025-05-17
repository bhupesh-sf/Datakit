import {
  findTemplateByText,
  getSampleTemplates,
  QueryTemplate,
} from "./templates";
import { detectIntent, QueryIntent, ExtractedEntity } from "./intentDetector";
import { TableSchema } from "@/hooks/query/useSchemaInfo";

/**
 * Process template based on exact match or NLP intent detection
 */
export function processTemplate(
  naturalLanguage: string,
  tableSchema: TableSchema[] = []
): string {
  // First check for exact template match
  const exactTemplate = findTemplateByText(naturalLanguage);

  if (exactTemplate) {
    // Use template-based processing for exact matches
    return processExactTemplate(exactTemplate, tableSchema);
  }

  // No exact match, use NLP to detect intent and generate SQL
  try {
    const queryIntent = detectIntent(naturalLanguage, tableSchema);
    return generateSQLFromIntent(queryIntent, tableSchema);
  } catch (error) {
    console.error("Error processing natural language query:", error);
    throw new Error(
      `Could not understand the query: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Process exact template match with available schema
 */
function processExactTemplate(
  template: QueryTemplate,
  tableSchema: TableSchema[]
): string {
  // For exact template matches, we'll apply schema information to placeholders
  const params: Record<string, string> = {};

  // If we have schema information, use it to populate placeholders
  if (tableSchema.length > 0) {
    // Use the first table as default
    const firstTable = tableSchema[0];
    params.table = firstTable.name;

    // For columns, try to find appropriate ones based on type
    const columns = firstTable.columns;

    // For numeric columns (for aggregations)
    const numericColumn = columns.find((col) =>
      ["integer", "decimal", "double", "float", "number"].some((t) =>
        col.type.toLowerCase().includes(t)
      )
    );

    // For text columns (for filters)
    const textColumn = columns.find((col) =>
      ["text", "varchar", "char", "string"].some((t) =>
        col.type.toLowerCase().includes(t)
      )
    );

    // For date columns
    const dateColumn = columns.find((col) =>
      ["date", "timestamp", "time"].some((t) =>
        col.type.toLowerCase().includes(t)
      )
    );

    // Assign columns based on template needs
    if (template.sqlTemplate.includes('"{column}"')) {
      // Prefer numeric for aggregations, otherwise text columns
      if (
        template.category === "Counting & Aggregation" ||
        template.category === "Statistics"
      ) {
        params.column = numericColumn?.name || columns[0]?.name || "column";
      } else {
        params.column = textColumn?.name || columns[0]?.name || "column";
      }
    }

    // For group by operations
    if (template.sqlTemplate.includes('"{groupColumn}"')) {
      params.groupColumn =
        textColumn?.name || columns[0]?.name || "groupColumn";
    }

    // For sum operations needing a numeric column
    if (template.sqlTemplate.includes('"{sumColumn}"')) {
      params.sumColumn = numericColumn?.name || "sumColumn";
    }

    // Placeholder values for demonstration
    if (template.sqlTemplate.includes("{value}")) {
      params.value = "example_value";
    }

    // For limits
    if (template.sqlTemplate.includes("{n}")) {
      params.n = "10";
    }
  }

  // Replace placeholders in the SQL template
  let sql = template.sqlTemplate;

  for (const [key, value] of Object.entries(params)) {
    sql = sql.replace(new RegExp(`"{${key}}"`, "g"), `"${value}"`);
    sql = sql.replace(new RegExp(`{${key}}`, "g"), value);
  }

  return sql;
}

/**
 * Generate SQL from the detected intent and entities
 */
function generateSQLFromIntent(
  queryIntent: QueryIntent,
  tableSchema: TableSchema[]
): string {
  const { intent, entities } = queryIntent;

  // Extract entities by type
  const tableEntity = entities.find((e) => e.type === "table");
  const columnEntity = entities.find((e) => e.type === "column");
  const valueEntity = entities.find((e) => e.type === "value");
  const aggregationEntity = entities.find((e) => e.type === "aggregation");
  const orderByEntity = entities.find((e) => e.type === "orderBy");
  const limitEntity = entities.find((e) => e.type === "limit");

  // Default values if entities are missing
  const tableName =
    tableEntity?.value ||
    (tableSchema.length > 0 ? tableSchema[0].name : "table");

  // Find columns from schema
  let columnName = "";
  if (tableSchema.length > 0) {
    const table =
      tableSchema.find((t) => t.name === tableName) || tableSchema[0];

    if (columnEntity) {
      columnName = columnEntity.value;
    } else if (table.columns.length > 0) {
      // For aggregations, prefer numeric columns
      if (aggregationEntity) {
        const numericColumn = table.columns.find((col) =>
          ["integer", "decimal", "double", "float", "number"].some((t) =>
            col.type.toLowerCase().includes(t)
          )
        );
        columnName = numericColumn?.name || table.columns[0].name;
      } else {
        columnName = table.columns[0].name;
      }
    }
  }

  // Build SQL based on intent
  switch (intent) {
    case "count":
      return `SELECT COUNT(*) FROM "${tableName}";`;

    case "aggregate":
      if (aggregationEntity) {
        return `SELECT ${aggregationEntity.value}("${columnName}") FROM "${tableName}";`;
      }
      return `SELECT COUNT(*) FROM "${tableName}";`;

    case "filter":
      let whereClause = "";
      if (columnEntity && valueEntity) {
        whereClause = ` WHERE "${columnName}" = '${valueEntity.value}'`;
      }

      let limitClause = "";
      if (limitEntity) {
        limitClause = ` LIMIT ${limitEntity.value}`;
      }

      return `SELECT * FROM "${tableName}"${whereClause}${limitClause};`;

    case "sort":
      const direction = orderByEntity?.value || "ASC";

      return `SELECT * FROM "${tableName}" ORDER BY "${columnName}" ${direction} LIMIT 100;`;

    case "limit":
      const limit = limitEntity?.value || "10";

      return `SELECT * FROM "${tableName}" LIMIT ${limit};`;

    default:
      // Default to a simple select all query
      return `SELECT * FROM "${tableName}" LIMIT 100;`;
  }
}
