import React, { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import { Book, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  template: (tableName: string) => string;
  category: "basic" | "aggregate" | "join" | "advanced";
}

interface QueryTemplatesProps {
  onSelectTemplate: (query: string) => void;
}

/**
 * Provides pre-defined SQL query templates
 */
const QueryTemplates: React.FC<QueryTemplatesProps> = ({
  onSelectTemplate,
}) => {
  const { tableName } = useAppStore();
  const { getAvailableTables } = useDuckDBStore();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["basic"])
  );

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Get available tables
  const tables = getAvailableTables();
  const currentTable = tableName || (tables.length > 0 ? tables[0] : "table");

  // Define query templates
  const templates: QueryTemplate[] = [
    // Basic queries
    {
      id: "select-all",
      name: "Select All",
      description: "Retrieve all rows from a table",
      category: "basic",
      template: (table) => `SELECT *\nFROM "${table}"\nLIMIT 100;`,
    },
    {
      id: "select-columns",
      name: "Select Specific Columns",
      description: "Retrieve specific columns from a table",
      category: "basic",
      template: (table) =>
        `SELECT column1, column2, column3\nFROM "${table}"\nLIMIT 100;`,
    },
    {
      id: "filter-where",
      name: "Filter with WHERE",
      description: "Filter results based on a condition",
      category: "basic",
      template: (table) =>
        `SELECT *\nFROM "${table}"\nWHERE condition = value\nLIMIT 100;`,
    },
    {
      id: "order-by",
      name: "Order Results",
      description: "Sort results by a column",
      category: "basic",
      template: (table) =>
        `SELECT *\nFROM "${table}"\nORDER BY column_name DESC\nLIMIT 100;`,
    },

    // Aggregate queries
    {
      id: "count-rows",
      name: "Count Rows",
      description: "Count the number of rows in a table",
      category: "aggregate",
      template: (table) => `SELECT COUNT(*) AS row_count\nFROM "${table}";`,
    },
    {
      id: "group-by",
      name: "Group By with Aggregates",
      description: "Group results and calculate aggregates",
      category: "aggregate",
      template: (table) =>
        `SELECT column1, COUNT(*) as count, AVG(column2) as average\nFROM "${table}"\nGROUP BY column1\nORDER BY count DESC;`,
    },
    {
      id: "min-max",
      name: "Min, Max, and Average",
      description: "Find minimum, maximum, and average values",
      category: "aggregate",
      template: (table) => `SELECT 
  MIN(numeric_column) AS minimum,
  MAX(numeric_column) AS maximum,
  AVG(numeric_column) AS average
FROM "${table}";`,
    },

    // Join queries
    {
      id: "inner-join",
      name: "Inner Join",
      description: "Join two tables on a common column",
      category: "join",
      template: (table) => `SELECT a.*, b.*
FROM "${table}" AS a
JOIN "second_table" AS b ON a.id = b.${table}_id
LIMIT 100;`,
    },
    {
      id: "left-join",
      name: "Left Join",
      description: "Left join preserving all rows from the first table",
      category: "join",
      template: (table) => `SELECT a.*, b.*
FROM "${table}" AS a
LEFT JOIN "second_table" AS b ON a.id = b.${table}_id
LIMIT 100;`,
    },

    // Advanced queries
    {
      id: "subquery",
      name: "Subquery Example",
      description: "Query using a subquery",
      category: "advanced",
      template: (table) => `SELECT *
FROM "${table}"
WHERE id IN (
  SELECT ${table}_id
  FROM "related_table"
  WHERE some_column > some_value
)
LIMIT 100;`,
    },
    {
      id: "window-functions",
      name: "Window Functions",
      description: "Use window functions for advanced analytics",
      category: "advanced",
      template: (table) => `SELECT 
  *,
  ROW_NUMBER() OVER (PARTITION BY category ORDER BY value DESC) AS row_num,
  AVG(value) OVER (PARTITION BY category) AS category_avg
FROM "${table}"
LIMIT 100;`,
    },
  ];

  // Group templates by category
  const categories = {
    basic: {
      name: "Basic Queries",
      templates: templates.filter((t) => t.category === "basic"),
    },
    aggregate: {
      name: "Aggregate Functions",
      templates: templates.filter((t) => t.category === "aggregate"),
    },
    join: {
      name: "Joins",
      templates: templates.filter((t) => t.category === "join"),
    },
    advanced: {
      name: "Advanced Queries",
      templates: templates.filter((t) => t.category === "advanced"),
    },
  };

  // Handle template selection
  const handleSelectTemplate = (template: QueryTemplate) => {
    onSelectTemplate(template.template(currentTable));
  };

  return (
    <div className="p-3">
      <div className="flex items-center mb-3">
        <Book size={16} className="mr-2 text-primary" />
        <h3 className="text-sm font-medium">Query Templates</h3>
      </div>

      <div className="text-xs text-white/70 mb-3">
        Click on a template to use it as a starting point. Templates will use
        the current table: <span className="text-primary">{currentTable}</span>
      </div>

      <div className="space-y-2">
        {Object.entries(categories).map(([id, category]) => (
          <div
            key={id}
            className="border border-white/10 rounded overflow-hidden"
          >
            <button
              className="w-full px-3 py-2 flex items-center justify-between bg-darkNav text-left"
              onClick={() => toggleCategory(id)}
            >
              <span className="text-sm font-medium">{category.name}</span>
              {expandedCategories.has(id) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {expandedCategories.has(id) && (
              <div className="p-2 space-y-2">
                {category.templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-2 rounded bg-darkNav/50 hover:bg-primary/10 cursor-pointer transition-colors"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="text-sm font-medium">{template.name}</div>
                    <div className="text-xs text-white/70 mt-1">
                      {template.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueryTemplates;
