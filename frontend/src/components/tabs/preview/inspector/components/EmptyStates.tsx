import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { Database, Play, Sparkles, X} from "lucide-react";

/**
 * Empty state when no analysis results are available
 */
interface NoAnalysisEmptyStateProps {
  onStartAnalysis?: () => void;
  fileName?: string;
  className?: string;
}

export const NoAnalysisEmptyState: React.FC<NoAnalysisEmptyStateProps> = ({
  onStartAnalysis,
  fileName,
  className,
}) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-12 space-y-6 text-center ${
        className || ""
      }`}
    >
      <div className="relative">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 bg-card/30 rounded-lg flex items-center justify-center"
        >
          <Database className="h-8 w-8 text-white/60" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-1 -right-1 w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center"
        >
          <Sparkles className="h-3 w-3 text-primary" />
        </motion.div>
      </div>

      <div className="space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold text-white">{t('inspector.emptyStates.noAnalysis.title', { defaultValue: 'Ready to Analyze' })}</h3>
        <p className="text-sm text-white/70">
          {fileName
            ? t('inspector.emptyStates.noAnalysis.descriptionWithFile', { defaultValue: 'Start analyzing "{{fileName}}" to discover data quality insights', fileName })
            : t('inspector.emptyStates.noAnalysis.descriptionNoFile', { defaultValue: 'Select a file to start your data quality analysis' })}
        </p>
      </div>

      {onStartAnalysis && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartAnalysis}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
        >
          <Play className="h-4 w-4" />
          {t('inspector.emptyStates.noAnalysis.startButton', { defaultValue: 'Start Analysis' })}
        </motion.button>
      )}

      <div className="text-xs text-white/50 max-w-md">
        {t('inspector.emptyStates.noAnalysis.timeEstimate', { defaultValue: 'Analysis typically takes 10-30 seconds depending on your data size' })}
      </div>
    </motion.div>
  );
};

/**
 * Empty state for when no columns match filters
 */
interface NoColumnsEmptyStateProps {
  searchTerm?: string;
  filterType?: string;
  onClearFilters?: () => void;
  totalColumns?: number;
  className?: string;
}

export const NoColumnsEmptyState: React.FC<NoColumnsEmptyStateProps> = ({
  searchTerm,
  filterType,
  onClearFilters,
  totalColumns,
  className,
}) => {
  const { t } = useTranslation();
  const hasFilters = searchTerm || (filterType && filterType !== "all");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col items-center justify-center py-8 space-y-4 text-center ${
        className || ""
      }`}
    >
      <div className="relative"></div>

      <div className="space-y-2 max-w-sm">
        <h3 className="text-sm font-medium text-white/90">{t('inspector.emptyStates.noColumns.title', { defaultValue: 'No Columns Found' })}</h3>
        {hasFilters ? (
          <p className="text-xs text-white/60">
            {searchTerm
              ? t('inspector.emptyStates.noColumns.noMatchingColumns', { defaultValue: 'No columns matching "{{searchTerm}}"', searchTerm })
              : t('inspector.emptyStates.noColumns.noFilteredColumns', { defaultValue: 'No {{filterType}} columns found', filterType })}
            {totalColumns && ` ${t('inspector.emptyStates.noColumns.totalColumns', { defaultValue: 'in {{totalColumns}} total columns', totalColumns })}`}
          </p>
        ) : (
          <p className="text-xs text-white/60">
            {t('inspector.emptyStates.noColumns.noAnalyzableColumns', { defaultValue: 'This dataset doesn\'t have any analyzable columns' })}
          </p>
        )}
      </div>

      {hasFilters && onClearFilters && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClearFilters}
          className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-colors"
        >
          <X className="h-3 w-3" />
          {t('inspector.emptyStates.noColumns.clearFiltersButton', { defaultValue: 'Clear Filters' })}
        </motion.button>
      )}

      <div className="text-xs text-white/50">
        {t('inspector.emptyStates.noColumns.suggestion', { defaultValue: 'Try adjusting your search or filter criteria' })}
      </div>
    </motion.div>
  );
};

/**
 * Loading skeleton placeholder for better perceived performance
 */
export const InspectorLoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 bg-white/10 rounded w-32" />
          <div className="flex items-center gap-2">
            <div className="h-4 bg-white/10 rounded w-16" />
            <div className="w-2 h-2 bg-white/10 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center space-y-2">
              <div className="h-8 bg-white/10 rounded w-20 mx-auto" />
              <div className="h-3 bg-white/10 rounded w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Search skeleton */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-white/10 rounded w-24" />
          <div className="h-8 bg-white/10 rounded w-20" />
        </div>
        <div className="h-10 bg-white/10 rounded" />
      </div>

      {/* Column list skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-3 flex items-center gap-3">
            <div className="w-4 h-4 bg-white/10 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/10 rounded w-40" />
              <div className="h-3 bg-white/10 rounded w-24" />
            </div>
            <div className="space-y-1 text-right">
              <div className="h-3 bg-white/10 rounded w-20" />
              <div className="h-3 bg-white/10 rounded w-16" />
            </div>
            <div className="w-4 h-4 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Error state with retry functionality
 */
interface ErrorEmptyStateProps {
  error: string;
  onRetry?: () => void;
  onReset?: () => void;
  className?: string;
}

export const ErrorEmptyState: React.FC<ErrorEmptyStateProps> = ({
  error,
  onRetry,
  onReset,
  className,
}) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-12 space-y-6 text-center ${
        className || ""
      }`}
    >
      <motion.div
        animate={{ rotate: [0, -5, 5, 0] }}
        transition={{ duration: 0.5 }}
        className="w-16 h-16 bg-red-500/10 rounded-lg flex items-center justify-center"
      >
        <X className="h-8 w-8 text-red-400" />
      </motion.div>

      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold text-white">{t('inspector.emptyStates.error.title', { defaultValue: 'Analysis Failed' })}</h3>
        <p className="text-sm text-white/70">{error}</p>
      </div>

      <div className="flex gap-3">
        {onRetry && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRetry}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t('inspector.emptyStates.error.tryAgainButton', { defaultValue: 'Try Again' })}
          </motion.button>
        )}
        {onReset && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onReset}
            className="px-4 py-2 bg-card/30 hover:bg-card/50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t('inspector.emptyStates.error.resetButton', { defaultValue: 'Reset' })}
          </motion.button>
        )}
      </div>

      <div className="text-xs text-white/50 max-w-md">
        {t('inspector.emptyStates.error.suggestion', { defaultValue: 'If the problem persists, try with a different file or contact support' })}
      </div>
    </motion.div>
  );
};
