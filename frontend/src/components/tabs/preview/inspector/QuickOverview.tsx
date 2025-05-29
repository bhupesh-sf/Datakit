import { InspectorMetrics } from "@/store/inspectorStore";
import { cn } from "@/lib/utils";

export const QuickOverview: React.FC<{ metrics: InspectorMetrics }> = ({
  metrics,
}) => {
  const healthColor =
    metrics.healthScore >= 80
      ? "text-emerald-400"
      : metrics.healthScore >= 60
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="p-4 border-b border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">Overview</h3>
        <div className={cn("flex items-center gap-2", healthColor)}>
          <span className="text-sm font-medium">
            {metrics.healthScore}% Quality
          </span>
          <div className="w-2 h-2 rounded-full bg-current" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {metrics.totalRows.toLocaleString()}
          </div>
          <div className="text-xs text-white/60">Rows</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {metrics.totalColumns}
          </div>
          <div className="text-xs text-white/60">Columns</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">
            {metrics.duplicateRows}
          </div>
          <div className="text-xs text-white/60">Duplicates</div>
        </div>
      </div>
    </div>
  );
};
