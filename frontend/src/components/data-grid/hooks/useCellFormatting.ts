import { useCallback } from "react";
import { ColumnType } from "@/types/csv";

export const useCellFormatting = (
  columnTypes: string[] = [],
  isDataMode: boolean = false,
  animationData?: {
    animationActive: boolean;
    gridData: string[][];
    animationMessage: string[];
    activeWordIndex: number;
  }
) => {
  const formatCellValue = useCallback(
    (value: string, rowIndex: number, colIndex: number): string => {
      if (rowIndex === 0 || colIndex === 0 || !value) return value;

      // Only apply type formatting in data mode
      if (
        !isDataMode ||
        !columnTypes ||
        columnTypes.length === 0 ||
        colIndex - 1 >= columnTypes.length
      ) {
        return value;
      }

      const type = columnTypes[colIndex - 1];
      switch (type) {
        case ColumnType.Number:
          const num = parseFloat(value);
          if (!isNaN(num)) {
            return num.toLocaleString();
          }
          break;
        case ColumnType.Boolean:
          if (value.toLowerCase() === "true" || value.toLowerCase() === "yes") {
            return "✓";
          } else if (
            value.toLowerCase() === "false" ||
            value.toLowerCase() === "no"
          ) {
            return "✗";
          }
          break;
        case ColumnType.Date:
          try {
            if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value)) {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                return date.toLocaleDateString();
              }
            }
          } catch (e) {
            // If date parsing fails, return original value
          }
          break;
      }

      return value;
    },
    [isDataMode, columnTypes]
  );

  const getCellClass = useCallback(
    (rowIndex: number, colIndex: number): string => {
      let baseClass = "";

      if (rowIndex === 0) {
        baseClass = "csv-grid-header";
        // Add extra padding for sort icon on non-row-number columns
        if (colIndex > 0) {
          baseClass += " pr-8";
        }
      } else if (colIndex === 0) {
        baseClass = "csv-grid-row-number";
      } else {
        baseClass = "csv-grid-cell";

        // Add column type styling for data mode
        if (
          isDataMode &&
          columnTypes.length > 0 &&
          colIndex - 1 < columnTypes.length
        ) {
          const type = columnTypes[colIndex - 1];
          switch (type) {
            case ColumnType.Number:
              baseClass += " csv-grid-cell-number";
              break;
            case ColumnType.Date:
              baseClass += " csv-grid-cell-date";
              break;
            case ColumnType.Boolean:
              baseClass += " csv-grid-cell-boolean";
              break;
          }
        }

        // Add animation styling for welcome message
        if (!isDataMode && animationData?.animationActive) {
          const cellContent = animationData.gridData[rowIndex]?.[colIndex];
          if (cellContent) {
            const wordIndex =
              animationData.animationMessage.indexOf(cellContent);
            if (wordIndex !== -1) {
              if (wordIndex === animationData.activeWordIndex) {
                baseClass += " animate-word-entry text-primary font-medium";
              } else {
                baseClass += " text-primary font-medium";
              }
            }
          }
        }
      }

      return baseClass;
    },
    [isDataMode, columnTypes, animationData]
  );

  return {
    formatCellValue,
    getCellClass,
  };
};
