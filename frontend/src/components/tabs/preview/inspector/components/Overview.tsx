import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Copy, Database, Columns } from 'lucide-react';
import { InspectorMetrics } from '@/store/inspectorStore';

interface EnhancedOverviewProps {
  metrics: InspectorMetrics;
}

const Overview: React.FC<EnhancedOverviewProps> = ({ metrics }) => {
  const criticalIssues = metrics.typeIssues.filter(
    (issue) => issue.severity === 'high'
  ).length;
  const totalIssues = metrics.typeIssues.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 border-b border-white/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Data Overview</h3>
        <div className="text-xs text-white/50">
          Analyzed at {new Date(metrics.analysisTimestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="text-center p-4 bg-card/20 rounded-lg border border-white/5"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Database className="h-4 w-4 text-white/60" />
            <div className="text-lg font-bold text-white">
              {metrics.totalRows.toLocaleString()}
            </div>
          </div>
          <div className="text-xs text-white/60">Rows</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="text-center p-4 bg-card/20 rounded-lg border border-white/5"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Columns className="h-4 w-4 text-white/60" />
            <div className="text-lg font-bold text-white">
              {metrics.totalColumns}
            </div>
          </div>
          <div className="text-xs text-white/60">Columns</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="text-center p-4 bg-card/20 rounded-lg border border-white/5"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Copy className="h-4 w-4 text-red-400" />
            <div className="text-lg font-bold text-red-400">
              {metrics.duplicateRows}
            </div>
          </div>
          <div className="text-xs text-white/60">Duplicates</div>
          {metrics.duplicateRows > 0 && (
            <div className="text-xs text-red-400/80">
              {metrics.duplicatePercentage.toFixed(1)}%
            </div>
          )}
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="text-center p-4 bg-card/20 rounded-lg border border-white/5"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <div className="text-lg font-bold text-yellow-400">
              {totalIssues}
            </div>
          </div>
          <div className="text-xs text-white/60">Issues</div>
          {criticalIssues > 0 && (
            <div className="text-xs text-red-400/80">
              {criticalIssues} critical
            </div>
          )}
        </motion.div>
      </div>

      {/* Health Breakdown */}
      <div className="mb-4">
        <div className="text-sm font-medium text-white mb-2">
          Quality Breakdown
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-card/10 rounded border border-white/5">
            <div className="text-sm font-medium text-white">
              {metrics.healthBreakdown.completeness}%
            </div>
            <div className="text-xs text-white/60">Completeness</div>
          </div>
          <div className="text-center p-2 bg-card/10 rounded border border-white/5">
            <div className="text-sm font-medium text-white">
              {metrics.healthBreakdown.uniqueness}%
            </div>
            <div className="text-xs text-white/60">Uniqueness</div>
          </div>
          <div className="text-center p-2 bg-card/10 rounded border border-white/5">
            <div className="text-sm font-medium text-white">
              {metrics.healthBreakdown.consistency}%
            </div>
            <div className="text-xs text-white/60">Consistency</div>
          </div>
        </div>
      </div>

      {/* Analysis Performance */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-xs text-white/50">
          <div>
            Analysis completed in {(metrics.analysisTimeMs / 1000).toFixed(1)}s
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Overview;
