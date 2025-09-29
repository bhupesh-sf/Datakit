import React, { useState, useEffect } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useTranslation } from 'react-i18next';

import { Button } from "@/components/ui/Button";

import { useChartGeneration } from "@/hooks/chart/useChartGeneration";
import { useSchemaInfo } from "@/hooks/query/useSchemaInfo";
import { useAppStore } from "@/store/appStore";

import { selectTableName } from "@/store/selectors/appSelectors";

const ChartGenerator: React.FC = () => {
  const { t } = useTranslation();
  const tableName = useAppStore(selectTableName);
  const { tableSchema } = useSchemaInfo(tableName);

  const { generateChart, isGenerating, error } = useChartGeneration();

  const [fields, setFields] = useState<{ name: string; type: string }[]>([]);
  const [dimension, setDimension] = useState<string>("");
  const [measure, setMeasure] = useState<string>("");
  const [aggregation, setAggregation] = useState<
    "sum" | "avg" | "min" | "max" | "count"
  >("sum");

  // Get field type for selected measure
  const measureField = fields.find((f) => f.name === measure);
  const measureType = measureField?.type || "";

  // Get valid aggregations for the selected measure field
  const validAggregations = getValidAggregationsForType(measureType);

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
          (f) =>
            (isNumericType(f.type) || isDateType(f.type)) &&
            f.name !== dimensionField?.name
        );

        if (dimensionField) setDimension(dimensionField.name);
        if (measureField) {
          setMeasure(measureField.name);
          // Set appropriate default aggregation based on field type
          const validAggs = getValidAggregationsForType(measureField.type);
          if (validAggs.includes("sum")) {
            setAggregation("sum");
          } else if (validAggs.includes("count")) {
            setAggregation("count");
          } else {
            setAggregation(validAggs[0] as any);
          }
        }
      }
    }
  }, [tableName, tableSchema]);

  // Update aggregation when measure changes
  useEffect(() => {
    if (measure && validAggregations.length > 0) {
      // If current aggregation is not valid for new field type, switch to a valid one
      if (!validAggregations.includes(aggregation)) {
        if (validAggregations.includes("sum")) {
          setAggregation("sum");
        } else if (validAggregations.includes("count")) {
          setAggregation("count");
        } else {
          setAggregation(validAggregations[0] as any);
        }
      }
    }
  }, [measure, validAggregations, aggregation]);

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
          <label className="block text-xs font-medium mb-1">{t('visualization.generator.xAxisField', { defaultValue: 'X-Axis Field' })}</label>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
          >
            <option value="">{t('visualization.generator.selectField', { defaultValue: 'Select field...' })}</option>
            {fields.map((field) => (
              <option key={`dim-${field.name}`} value={field.name}>
                {field.name} ({getFieldTypeLabel(field.type)})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-white/60">
            {t('visualization.generator.xAxisHelp', { defaultValue: 'Categories to group your data by' })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Y-Axis selection */}
          <div>
            <label className="block text-xs font-medium mb-1">
              {t('visualization.generator.yAxisField', { defaultValue: 'Y-Axis Field' })}
            </label>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
            >
              <option value="">{t('visualization.generator.selectField', { defaultValue: 'Select field...' })}</option>
              {fields
                .filter((f) => isNumericType(f.type) || isDateType(f.type))
                .map((field) => (
                  <option key={`measure-${field.name}`} value={field.name}>
                    {field.name} ({getFieldTypeLabel(field.type)})
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-white/60">
              {isDateType(measureType)
                ? t('visualization.generator.yAxisHelpDate', { defaultValue: 'Date fields for time analysis' })
                : t('visualization.generator.yAxisHelpNumeric', { defaultValue: 'Numeric values to measure' })}
            </p>
          </div>

          {/* Aggregation selection */}
          <div>
            <label className="block text-xs font-medium mb-1">
              {t('visualization.generator.aggregation', { defaultValue: 'Aggregation' })}
            </label>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as any)}
              className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
              disabled={validAggregations.length <= 1}
            >
              {validAggregations.map((agg) => (
                <option key={agg} value={agg}>
                  {getAggregationLabel(agg, t)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-white/60">
              {getAggregationHelpText(measureType, t)}
            </p>
          </div>
        </div>

        {/* Description of what will happen */}
        {measure && dimension && (
          <div className="mt-2 p-2 bg-primary/5 rounded-md text-xs text-white/80 border border-white/5">
            {getAggregationDescription(
              aggregation,
              measure,
              dimension,
              measureType,
              t
            )}
            <p className="mt-1 text-white/50">
              {t('visualization.generator.usingAllData', { defaultValue: 'Using all {{tableName}} data for visualization', tableName })}
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
            {t('visualization.generator.processing', { defaultValue: 'Processing...' })}
          </>
        ) : (
          <>
            <ArrowRight size={14} className="mr-1.5" />
            {t('visualization.generator.generateChart', { defaultValue: 'Generate Chart' })}
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
    "number",
  ];
  return numericTypes.some((t) => type.toLowerCase().includes(t));
}

// Helper function to determine if a type is date/time
function isDateType(type: string): boolean {
  const dateTypes = ["date", "datetime", "timestamp", "time"];
  return dateTypes.some((t) => type.toLowerCase().includes(t));
}

// Get valid aggregations based on field type
function getValidAggregationsForType(type: string): string[] {
  if (isDateType(type)) {
    return ["min", "max", "count"]; // Only meaningful aggregations for dates
  }
  if (isNumericType(type)) {
    return ["sum", "avg", "min", "max", "count"];
  }
  return ["count"]; // For text fields
}

// Get user-friendly field type label
function getFieldTypeLabel(type: string): string {
  if (isNumericType(type)) return "number";
  if (isDateType(type)) return "date";
  return "text";
}

// Get user-friendly aggregation labels
function getAggregationLabel(agg: string, t: any): string {
  switch (agg) {
    case "sum":
      return t('visualization.generator.aggregationLabels.sum', { defaultValue: 'Sum' });
    case "avg":
      return t('visualization.generator.aggregationLabels.avg', { defaultValue: 'Average' });
    case "min":
      return t('visualization.generator.aggregationLabels.min', { defaultValue: 'Minimum' });
    case "max":
      return t('visualization.generator.aggregationLabels.max', { defaultValue: 'Maximum' });
    case "count":
      return t('visualization.generator.aggregationLabels.count', { defaultValue: 'Count' });
    default:
      return agg;
  }
}

// Get help text for aggregation based on field type
function getAggregationHelpText(measureType: string, t: any): string {
  if (isDateType(measureType)) {
    return t('visualization.generator.aggregationHelpDate', { defaultValue: 'Date aggregations: earliest, latest, or count' });
  }
  if (isNumericType(measureType)) {
    return t('visualization.generator.aggregationHelpNumeric', { defaultValue: 'How to calculate the numeric values' });
  }
  return t('visualization.generator.aggregationHelpGeneric', { defaultValue: 'How to aggregate the values' });
}

// Enhanced aggregation description with type awareness
function getAggregationDescription(
  aggregation: string,
  measure: string,
  dimension: string,
  measureType: string,
  t: any
): string {
  const isDate = isDateType(measureType);

  switch (aggregation) {
    case "sum":
      return t('visualization.generator.description.sum', { defaultValue: 'This chart will show the total sum of "{{measure}}" for each "{{dimension}}" category.', measure, dimension });
    case "avg":
      return t('visualization.generator.description.avg', { defaultValue: 'This chart will show the average "{{measure}}" for each "{{dimension}}" category.', measure, dimension });
    case "min":
      return isDate
        ? t('visualization.generator.description.minDate', { defaultValue: 'This chart will show the earliest "{{measure}}" date for each "{{dimension}}" category.', measure, dimension })
        : t('visualization.generator.description.min', { defaultValue: 'This chart will show the minimum "{{measure}}" value for each "{{dimension}}" category.', measure, dimension });
    case "max":
      return isDate
        ? t('visualization.generator.description.maxDate', { defaultValue: 'This chart will show the latest "{{measure}}" date for each "{{dimension}}" category.', measure, dimension })
        : t('visualization.generator.description.max', { defaultValue: 'This chart will show the maximum "{{measure}}" value for each "{{dimension}}" category.', measure, dimension });
    case "count":
      return t('visualization.generator.description.count', { defaultValue: 'This chart will show the count of items in each "{{dimension}}" category.', dimension });
    default:
      return "";
  }
}

export default ChartGenerator;
