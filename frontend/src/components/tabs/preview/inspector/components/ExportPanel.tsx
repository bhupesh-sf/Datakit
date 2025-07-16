import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Table,
  CheckCircle,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/auth/useAuth';

interface ExportOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  formats: string[];
  features: string[];
  requiresAuth?: boolean;
}

interface ExportPanelProps {
  fileName: string;
  onExport: (format: string, options?: any) => Promise<void>;
  onAuthRequired?: () => void;
  onScheduleExport?: (options: any) => Promise<void>;
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  fileName,
  onExport,
  onAuthRequired,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{
    format: string;
    status: 'success' | 'error' | 'loading';
    message: string;
  } | null>(null);

  const { isAuthenticated } = useAuth();

  const exportOptions: ExportOption[] = [
    {
      id: 'reports',
      name: 'Analysis Reports',
      description: 'Complete analysis with charts and insights',
      icon: <FileText className="h-6 w-6" />,
      formats: ['PDF', 'HTML', 'Word'],
      features: [
        'Complete data analysis',
        'Quality recommendations'
      ],
      requiresAuth: true,
    },
    {
      id: 'data',
      name: 'Raw Data',
      description: 'Export your data in various formats',
      icon: <Table className="h-6 w-6" />,
      formats: ['CSV', 'Excel', 'JSON', 'Parquet'],
      features: [
        'Full dataset export'
      ],
      requiresAuth: true,
    }
  ];

  const handleExport = async (format: string, optionId: string) => {
    const option = exportOptions.find((opt) => opt.id === optionId);

    if (option?.requiresAuth && !isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    setExportStatus({
      format,
      status: 'loading',
      message: `Preparing ${format} export...`,
    });

    try {
      await onExport(format.toLowerCase(), { type: optionId });
      setExportStatus({
        format,
        status: 'success',
        message: `${format} export completed successfully`,
      });
    } catch (error) {
      setExportStatus({
        format,
        status: 'error',
        message: `Export failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    }

    // Clear status after 5 seconds
    setTimeout(() => setExportStatus(null), 5000);
  };

  const getStatusIcon = (status: 'success' | 'error' | 'loading') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'loading':
        return (
          <div className="h-4 w-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        );
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Export Options
        </h3>
        <p className="text-sm text-white/60">
          Export your analysis for {fileName} in various formats
        </p>
      </div>

      {/* Export Status */}
      <AnimatePresence>
        {exportStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'mb-6 p-4 rounded-lg border flex items-center gap-3',
              exportStatus.status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : exportStatus.status === 'error'
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-blue-500/10 border-blue-500/20'
            )}
          >
            {getStatusIcon(exportStatus.status)}
            <div>
              <div className="text-sm font-medium text-white">
                {exportStatus.format} Export
              </div>
              <div className="text-xs text-white/70">
                {exportStatus.message}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Options */}
      <div className="space-y-4">
        {exportOptions.map((option) => (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'border rounded-lg p-4 cursor-pointer transition-all duration-200',
              selectedOption === option.id
                ? 'border-primary/30 bg-primary/5'
                : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            )}
            onClick={() =>
              setSelectedOption(selectedOption === option.id ? null : option.id)
            }
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'p-3 rounded-lg',
                  selectedOption === option.id ? 'bg-primary/20' : 'bg-white/10'
                )}
              >
                {option.icon}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-lg font-medium text-white">
                    {option.name}
                  </h4>

                  {option.requiresAuth && !isAuthenticated && (
                    <Lock className="h-4 w-4 text-yellow-400" />
                  )}
                </div>

                <p className="text-sm text-white/70 mb-3">
                  {option.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-3">
                  {option.formats.map((format) => (
                    <span
                      key={format}
                      className="px-2 py-1 bg-white/10 text-white/80 rounded text-xs"
                    >
                      {format}
                    </span>
                  ))}
                </div>

                <div className="space-y-1">
                  {option.features.map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-white/60"
                    >
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Expanded Options */}
            <AnimatePresence>
              {selectedOption === option.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 pt-4 border-t border-white/10"
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {option.formats.map((format) => (
                      <button
                        key={format}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(format, option.id);
                        }}
                        disabled={exportStatus?.status === 'loading'}
                        className={cn(
                          'p-3 rounded-lg border transition-colors text-left',
                          exportStatus?.status === 'loading'
                            ? 'bg-white/5 border-white/10 cursor-not-allowed'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        )}
                      >
                        <div className="text-sm font-medium text-white">
                          {format}
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                          {format === 'PDF' && 'Portable document'}
                          {format === 'CSV' && 'Comma-separated'}
                          {format === 'Excel' && 'Microsoft Excel'}
                          {format === 'JSON' && 'JavaScript Object'}
                          {format === 'PNG' && 'High-res image'}
                          {format === 'SVG' && 'Vector graphics'}
                          {format === 'HTML' && 'Web format'}
                          {format === 'Word' && 'Microsoft Word'}
                          {format === 'Parquet' && 'Columnar storage'}
                          {format === 'JSON API' && 'REST endpoint'}
                          {format === 'Webhook' && 'HTTP callbacks'}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Authentication Notice */}
      {!isAuthenticated && (
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">
              Premium Features
            </span>
          </div>
          <p className="text-xs text-white/70 mb-3">
            Sign in to unlock advanced export formats, scheduling, and API
            integrations
          </p>
          <button
            onClick={onAuthRequired}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Sign In to Unlock
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportPanel;
