import React, { useState } from "react";
import { BarChart4, RefreshCw } from "lucide-react";

import { useChartsStore } from "@/store/chartsStore";

import { Button } from "@/components/ui/Button";
import DataTransforms from "./panels/DataTransformsPanel";
import ChartGenerator from "./panels/ChartGeneratorPanel";

/**
 * Component for configuring chart settings
 */
const ChartConfigPanel: React.FC = () => {
  const { currentChart, updateCurrentChart, colorPalettes } = useChartsStore();

  const [activeTab, setActiveTab] = useState<"data" | "style" | "transforms">(
    "data"
  );

  if (!currentChart) {
    return (
      <div className="p-4 text-center h-full flex flex-col justify-center">
        <BarChart4 size={44} className="mx-auto mb-3 text-white/40" />
        <h3 className="text-lg font-medium mb-2">No Chart Selected</h3>
        <p className="text-sm text-white/60">
          Execute a query first to visualize your data.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Title and description inputs */}
      <div className="space-y-3 mb-3">
        <div>
          <label className="block text-xs font-medium mb-1">Chart Title</label>
          <input
            type="text"
            value={currentChart.title}
            onChange={(e) => updateCurrentChart({ title: e.target.value })}
            className="w-full p-2 bg-background border border-white/10 rounded text-white text-sm"
            placeholder="Enter chart title"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            Description (Optional)
          </label>
          <textarea
            value={currentChart.description || ""}
            onChange={(e) =>
              updateCurrentChart({ description: e.target.value })
            }
            className="w-full p-2 bg-background border border-white/10 rounded text-white text-sm h-16 resize-none"
            placeholder="Brief description of this chart"
          />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-white/10 mb-3">
        <button
          className={`px-3 py-1.5 text-sm flex items-center cursor-pointer ${
            activeTab === "data"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-white/70 hover:text-white/90"
          }`}
          onClick={() => setActiveTab("data")}
        >
          Data
        </button>
        <button
          className={`px-3 py-1.5 text-sm flex items-center cursor-pointer ${
            activeTab === "style"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-white/70 hover:text-white/90"
          }`}
          onClick={() => setActiveTab("style")}
        >
          Style
        </button>
        <button
          className={`px-3 py-1.5 text-sm flex items-center cursor-pointer ${
            activeTab === "transforms"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-white/70 hover:text-white/90"
          }`}
          onClick={() => setActiveTab("transforms")}
        >
          Transform
        </button>
      </div>

      {/* Tab content - scrollable area */}
      <div className="flex-1 overflow-y-auto pr-1">
        {/* Data mapping tab */}
        {activeTab === "data" && <ChartGenerator />}

        {/* Style & Colors tab */}
        {activeTab === "style" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Color Palette
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(colorPalettes).map(([name, colors]) => (
                  <button
                    key={name}
                    className={`p-2 border rounded flex items-center cursor-pointer ${
                      currentChart.palette === name
                        ? "border-primary bg-primary/10"
                        : "border-white/10 hover:border-white/30"
                    }`}
                    onClick={() => updateCurrentChart({ palette: name })}
                  >
                    <div className="flex mr-2">
                      {colors.slice(0, 3).map((color, i) => (
                        <div
                          key={i}
                          className="w-3 h-8 first:rounded-l last:rounded-r"
                          style={{
                            backgroundColor: color,
                            marginLeft: i > 0 ? -4 : 0,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs capitalize">{name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-darkNav/30 p-3 rounded space-y-2.5">
              <h4 className="text-sm font-medium mb-1">Display Options</h4>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show-legend"
                  checked={currentChart.showLegend}
                  onChange={(e) =>
                    updateCurrentChart({ showLegend: e.target.checked })
                  }
                  className="mr-2"
                />
                <label htmlFor="show-legend" className="text-sm">
                  Show Legend
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show-grid"
                  checked={currentChart.showGrid}
                  onChange={(e) =>
                    updateCurrentChart({ showGrid: e.target.checked })
                  }
                  className="mr-2"
                />
                <label htmlFor="show-grid" className="text-sm">
                  Show Grid Lines
                </label>
              </div>

              {["bar", "area", "line"].includes(currentChart.type) && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="stacked-data"
                    checked={currentChart.stackedData}
                    onChange={(e) =>
                      updateCurrentChart({ stackedData: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <label htmlFor="stacked-data" className="text-sm">
                    Stack Data Series
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transforms tab */}
        {activeTab === "transforms" && <DataTransforms />}
      </div>

      {/* Action buttons */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            // Reset to initial state based on current data
            if (currentChart && currentChart.data) {
              const xAxisField = currentChart.xAxis.field;
              const yAxisField = currentChart.yAxis.field;

              updateCurrentChart({
                title: `${
                  currentChart.type.charAt(0).toUpperCase() +
                  currentChart.type.slice(1)
                } Chart`,
                xAxis: {
                  field: xAxisField,
                  label: formatFieldLabel(xAxisField),
                  dataKey: xAxisField,
                },
                yAxis: {
                  field: yAxisField,
                  label: formatFieldLabel(yAxisField),
                  dataKey: yAxisField,
                },
                showLegend: true,
                showGrid: true,
                palette: "primary",
                colorBy: undefined,
                description: "",
                transforms: [],
              });
            }
          }}
        >
          <RefreshCw size={14} className="mr-1.5" />
          Reset Chart Settings
        </Button>
      </div>
    </div>
  );
};

/**
 * Helper to format a field name as a readable label
 */
function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default ChartConfigPanel;
