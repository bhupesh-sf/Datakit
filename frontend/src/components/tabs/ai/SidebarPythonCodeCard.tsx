import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  FileCode,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';

interface SidebarPythonCodeCardProps {
  code: string;
  index: number;
  onSendToNotebook: (code: string) => void;
  activeFile?: any;
}

const SidebarPythonCodeCard: React.FC<SidebarPythonCodeCardProps> = ({
  code,
  index,
  onSendToNotebook,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleSendToNotebook = () => {
    onSendToNotebook(code);
  };


  // Format code for display with proper line breaks
  const displayCode = code.trim();
  const codeLines = displayCode.split('\n');
  const isMultiLine = codeLines.length > 1;
  const shouldTruncate = codeLines.length > 8;
  const displayLines = shouldTruncate && !isExpanded 
    ? codeLines.slice(0, 6)
    : codeLines;

  return (
    <div className="bg-gradient-to-br from-blue-500/5 to-blue-600/5 border border-blue-500/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border-b border-blue-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
          <span className="text-xs font-medium text-blue-300">{t('ai.pythonCard.title', { defaultValue: 'Python Code' })}</span>
          {index > 0 && (
            <span className="text-xs text-blue-400/60">#{index + 1}</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Copy Button */}
          <Tooltip content={t('ai.pythonCard.copyCode', { defaultValue: 'Copy code' })} placement="bottom">
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-blue-500/20 rounded transition-colors"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-400" />
              ) : (
                <Copy className="h-3 w-3 text-blue-300" />
              )}
            </button>
          </Tooltip>

          {/* Expand/Collapse for multi-line code */}
          {shouldTruncate && (
            <Tooltip content={isExpanded ? t('ai.pythonCard.collapse', { defaultValue: 'Collapse' }) : t('ai.pythonCard.expand', { defaultValue: 'Expand' })} placement="bottom">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-blue-500/20 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3 text-blue-300" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-blue-300" />
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Code Content */}
      <div className="p-3">
        <pre className="text-xs text-white/85 font-mono whitespace-pre-wrap leading-relaxed">
          <code>
            {displayLines.join('\n')}
            {shouldTruncate && !isExpanded && (
              <span className="text-blue-400/60">
                \n... ({t('ai.pythonCard.moreLines', { 
                  defaultValue: '{{count}} more lines', 
                  count: codeLines.length - 6 
                })})
              </span>
            )}
          </code>
        </pre>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-3 py-2 bg-black/20 border-t border-blue-500/20">
        {/* Send to Notebook Button */}
        <Tooltip content={t('ai.pythonCard.sendToNotebook', { defaultValue: 'Send to active notebook' })} placement="top">
          <Button
            onClick={handleSendToNotebook}
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs border-blue-500/30 hover:border-blue-400/50 hover:bg-blue-500/10 text-blue-300 hover:text-blue-200 flex items-center gap-1.5"
          >
            <FileCode className="h-3 w-3" />
            <span>{t('ai.pythonCard.sendToNotebookButton', { defaultValue: 'Send to Notebook' })}</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Tooltip>

      </div>
    </div>
  );
};

export default SidebarPythonCodeCard;