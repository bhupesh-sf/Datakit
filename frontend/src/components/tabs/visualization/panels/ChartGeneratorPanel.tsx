import React, { useState, useEffect } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

import { useChartGeneration } from "@/hooks/chart/useChartGeneration";
import { useSchemaInfo } from "@/hooks/query/useSchemaInfo";
import { useAppStore } from "@/store/appStore";

import { selectTableName } from "@/store/selectors/appSelectors";

const ChartGenerator: React.FC = () => {
  const tableName = useAppStore(selectTableName);
  const { tableSchema } = useSchemaInfo(tableName);

  const { generateChart, isGenerating, error } = useChartGeneration();

  const [fields, setFields] = useState<{ name: string; type: string }[]>([]);
  const [dimension, setDimension] = useState<string>("");
  const [measure, setMeasure] = useState<string>("");
  const [aggregation, setAggregation] = useState<
    "sum" | "avg" | "min" | "max" | "count"
  >("sum");

  // Load schema when table changes
  useEffect(() => {
    if (tableName) {
      if (tableSchema) {
        setFields(tableSchema);

        // Auto-select a reasonable dimension and measure
        const dimensionField = tableSchema.find(
          (f) =>
            !isNumericType(f.type) ||
            f.name.toLowerCase().includes("id") ||
            f.name.toLowerCase().includes("date") ||
            f.name.toLowerCase().includes("category")
        );

        const measureField = tableSchema.find(
          (f) => isNumericType(f.type) && f.name !== dimensionField?.name
        );

        if (dimensionField) setDimension(dimensionField.name);
        if (measureField) setMeasure(measureField.name);
      }
    }
  }, [tableName, tableSchema]);

  const handleGenerateChart = async () => {
    if (tableName && dimension && measure) {
      await generateChart({
        tableName,
        dimension,
        measure,
        aggregation,
        limit: 50,
      });
    }
  };

  if (!tableName) return null;

  return (
    <div className="space-y-3">
      {/* Form fields with more vertical layout */}
      <div className="space-y-3">
        {/* X-Axis selection */}
        <div>
          <label className="block text-xs font-medium mb-1">X-Axis Field</label>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
          >
            <option value="">Select field...</option>
            {fields.map((field) => (
              <option key={`dim-${field.name}`} value={field.name}>
                {field.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-white/60">
            Categories to group your data by
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Y-Axis selection */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Y-Axis Field
            </label>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
            >
              <option value="">Select field...</option>
              {fields
                .filter((f) => isNumericType(f.type))
                .map((field) => (
                  <option key={`measure-${field.name}`} value={field.name}>
                    {field.name}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-white/60">
              Numeric values to measure
            </p>
          </div>

          {/* Aggregation selection */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Aggregation
            </label>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as any)}
              className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
            >
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
              <option value="min">Minimum</option>
              <option value="max">Maximum</option>
              <option value="count">Count</option>
            </select>
            <p className="mt-1 text-xs text-white/60">
              How to calculate the values
            </p>
          </div>
        </div>

        {/* Description of what will happen */}
        {measure && dimension && (
          <div className="mt-2 p-2 bg-primary/5 rounded-md text-xs text-white/80 border border-white/5">
            {getAggregationDescription(aggregation, measure, dimension)}
            <p className="mt-1 text-white/50">
              Using all {tableName} data for visualization
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-400 text-xs p-2 bg-red-400/10 rounded border border-red-400/20">
          {error}
        </div>
      )}

      {/* Action button */}
      <Button
        variant="outline"
        className="w-full mt-2"
        onClick={handleGenerateChart}
        disabled={isGenerating || !dimension || !measure}
      >
        {isGenerating ? (
          <>
            <RefreshCw size={14} className="mr-1.5" />
            Processing...
          </>
        ) : (
          <>
            <ArrowRight size={14} className="mr-1.5" />
            Generate Chart
          </>
        )}
      </Button>
    </div>
  );
};

// Helper function to determine if a type is numeric
function isNumericType(type: string): boolean {
  const numericTypes = [
    "int",
    "integer",
    "double",
    "float",
    "numeric",
    "decimal",
    "bigint",
  ];
  return numericTypes.some((t) => type.toLowerCase().includes(t));
}

// Helper function to get aggregation description - more concise
function getAggregationDescription(
  aggregation: string,
  measure: string,
  dimension: string
): string {
  switch (aggregation) {
    case "sum":
      return `This chart will show the total sum of "${measure}" for each "${dimension}" category.`;
    case "avg":
      return `This chart will show the average "${measure}" for each "${dimension}" category.`;
    case "min":
      return `This chart will show the minimum "${measure}" value for each "${dimension}" category.`;
    case "max":
      return `This chart will show the maximum "${measure}" value for each "${dimension}" category.`;
    case "count":
      return `This chart will show the count of items in each "${dimension}" category.`;
    default:
      return "";
  }
}

export default ChartGenerator;
