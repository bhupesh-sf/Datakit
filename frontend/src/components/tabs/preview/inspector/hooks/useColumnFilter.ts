import { useMemo } from "react";
import { InspectorMetrics } from "@/store/inspectorStore";

export type FilterType = "all" | "numeric" | "text" | "date" | "name";

export const useColumnFilter = (
  columns: InspectorMetrics["columnMetrics"],
  searchTerm: string,
  filterType: FilterType
) => {
  return useMemo(() => {
    let filtered = columns;

    // Apply type filter first
    if (filterType !== "all" && filterType !== "name") {
      filtered = columns.filter((column) => {
        const type = column.type.toLowerCase();

        switch (filterType) {
          case "numeric":
            return (
              type.includes("int") ||
              type.includes("double") ||
              type.includes("numeric") ||
              type.includes("decimal") ||
              type.includes("float")
            );
          case "text":
            return (
              type.includes("varchar") ||
              type.includes("text") ||
              type.includes("string") ||
              type.includes("char")
            );
          case "date":
            return (
              type.includes("date") ||
              type.includes("time") ||
              type.includes("timestamp")
            );
          default:
            return true;
        }
      });
    }

    // Apply name search filter
    if (searchTerm.trim().length > 0) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((column) =>
        column.name.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [columns, searchTerm, filterType]);
};
