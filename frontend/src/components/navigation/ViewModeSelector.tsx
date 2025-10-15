import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Code2, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type ViewMode =
  | 'preview'
  | 'query'
  | 'notebook'
  | 'visualization'
  | 'ai';

interface ViewModeSelectorProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  className?: string;
}

const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({
  currentMode,
  onModeChange,
  className
}) => {
  const { t } = useTranslation();

  const modes: {
    value: ViewMode;
    label: string;
    icon: React.ReactNode;
    description: string;
  }[] = [
    {
      value: 'preview',
      label: t('viewMode.preview.label', { defaultValue: 'Preview' }),
      icon: <Eye size={16} />,
      description: t('viewMode.preview.description', { defaultValue: 'View and explore your data' }),
    },
    {
      value: 'query',
      label: t('viewMode.query.label', { defaultValue: 'SQL' }),
      icon: <Code2 size={16} />,
      description: t('viewMode.query.description', { defaultValue: 'Query with SQL' }),
    },
    {
      value: 'notebook',
      label: t('viewMode.notebook.label', { defaultValue: 'Notebook' }),
      icon: <FileText size={16} />,
      description: t('viewMode.notebook.description', { defaultValue: 'Analyze with Jupyter notebook' }),
    },
    // {
    //   value: 'visualization',
    //   label: t('viewMode.visualization.label', { defaultValue: 'Visualize' }),
    //   icon: <BarChart3 size={16} />,
    //   description: t('viewMode.visualization.description', { defaultValue: 'Create charts and graphs' }),
    // },
    // {
    //   value: 'ai',
    //   label: t('viewMode.ai.label', { defaultValue: 'Assistant' }),
    //   icon: <UserPen size={16} />,
    //   description: t('viewMode.ai.description', { defaultValue: 'AI-powered insights' }),
    // },
  ];


  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Responsive view mode selector */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          duration: 0.25,
          ease: [0.23, 1, 0.32, 1], // Custom easing for smoother feel
          scale: { duration: 0.2 },
          opacity: { duration: 0.15 },
        }}
        className="responsive-view-selector flex items-center gap-0.5 bg-black/60 backdrop-blur-sm border border-white/20 rounded-lg p-0.5 shadow-xl shadow-black/50"
      >
        {modes.map((mode) => (
          <motion.button
            key={mode.value}
            onClick={() => onModeChange(mode.value)}
            disabled={false} // Always clickable
            className={cn(
              'responsive-view-mode-button relative group flex items-center rounded-md transition-all duration-200 cursor-pointer gap-1.5 px-3 py-1.5 text-xs border',
              currentMode === mode.value
                ? 'text-white border-primary/40 bg-primary/5'
                : 'text-white/50 hover:text-white/70 border-transparent hover:border-white/20 hover:bg-white/5'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {currentMode === mode.value && (
              <motion.div
                layoutId="activeMode"
                className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/30 via-primary/25 to-primary/20 border border-primary/50 shadow-lg shadow-primary/20"
                transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              />
            )}
            <span
              className={cn(
                'relative z-10',
                currentMode === mode.value ? 'text-white' : ''
              )}
            >
              {mode.icon}
            </span>
            <span
              className={cn(
                'button-text relative z-10 font-medium',
                currentMode === mode.value ? 'text-white' : ''
              )}
            >
              {mode.label}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

export default ViewModeSelector;
