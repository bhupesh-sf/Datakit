import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import utilities
import {
  downloadFile,
  exportAsCSV,
  exportAsJSON,
  exportAsText,
  exportAsExcel,
} from './utils/exportUtils';
import { exportHTMLReport } from './utils/htmlReportUtils';
import { handleProblemExport, ProblemType } from './utils/problemExportUtils';

import { useInspectorStore } from '@/store/inspectorStore';
import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import {
  selectFileTabs,
  selectActiveFile,
} from '@/store/selectors/appSelectors';
import { useAuth } from '@/hooks/auth/useAuth';

import { useAutoAnalysis, QuickPreviewCard } from './hooks/useAutoAnalysis';
import { LoadingState } from './components/LoadingStates';
import { NoColumnsEmptyState, ErrorEmptyState } from './components/EmptyStates';
import { ColumnSearch, FilterType } from './components/ColumnSearch';
import { useColumnFilter } from './hooks/useColumnFilter';
import { useInitialQuery } from '@/hooks/query/useQueryInitialization';

import QuickActionsBar from './components/QuickActionsBar';
import ViewSwitcher, { ViewType } from './components/ViewSwitcher';
import Overview from './components/Overview';
import ColumnRow from './components/ColumnRow';
import ProblemsView from './components/ProblemsView';
import ExportPanel from './components/ExportPanel';
import RowDetailsModal from './components/RowDetailsModal';
import AuthModal from '@/components/auth/AuthModal';

interface InspectorPanelProps {
  className?: string;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ className }) => {
  // Store states
  const {
    isOpen,
    width,
    setWidth,
    closePanel,
    activeFileId,
    activeTableName,
    results,
    error,
    switchAnalysisTarget,
    exportResults,
    resetError,
    fetchDuplicateRows,
    fetchNullRows,
    fetchOutlierRows,
    fetchTypeIssueRows,
  } = useInspectorStore();

  const activeFile = useAppStore(selectActiveFile);
  const fileTabs = useAppStore(selectFileTabs);
  const { setActiveTab } = useAppStore();
  const { setQuery } = useInitialQuery();
  const { isAuthenticated } = useAuth();


  // UI state
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
    new Set()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [analysisStartTime] = useState(Date.now());

  // New state for enhanced UI
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [rowDetailsModal, setRowDetailsModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'duplicates' | 'nulls' | 'outliers' | 'type_issues';
    columnName?: string;
    data: unknown[];
  }>({
    isOpen: false,
    title: '',
    type: 'nulls',
    data: [],
  });

  const {
    quickPreview,
    isGettingPreview,
    shouldShowPreview,
    isAnalyzing,
    analysisProgress,
    analysisStatus,
    manualTrigger,
  } = useAutoAnalysis({
    autoAnalysisDelay: 1000,
    autoOpenPanel: false,
    showQuickPreview: true,
  });

  // Get current analysis results
  const currentResults = activeFileId ? results.get(activeFileId) : null;

  // Filter columns
  const filteredColumns = useColumnFilter(
    currentResults?.columnMetrics || [],
    searchTerm,
    filterType
  );

  // Calculate problem count
  const problemCount = currentResults
    ? (currentResults.duplicateRows > 0 ? 1 : 0) +
      currentResults.columnMetrics.filter((col) => col.nullCount > 0).length +
      currentResults.typeIssues.length
    : 0;

  // Handlers
  const toggleColumn = (columnName: string) => {
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(columnName)) {
      newExpanded.delete(columnName);
    } else {
      newExpanded.add(columnName);
    }
    setExpandedColumns(newExpanded);
  };

  // TODO: The query init in the workspace should also be integrated
  // with what we arw currently making here
  const handleGenerateQuery = (query: string, description: string) => {
    navigator.clipboard.writeText(query);
    setActiveTab('query');
    setQuery(query);
    closePanel();
  };

  const handleFileChange = (fileId: string) => {
    const file = fileTabs.find((tab) => tab.id === fileId);
    if (file && file.fileName) {
      const appFile = useAppStore.getState().files.find((f) => f.id === fileId);
      const tableName = appFile?.tableName;
      if (tableName) {
        switchAnalysisTarget(fileId, tableName);
      }
    }
  };

  const handleExport = async (format: string, options?: any) => {
    if (!isAuthenticated && ['pdf', 'html', 'word', 'excel', 'parquet'].includes(format)) {
      setShowAuthModal(true);
      return;
    }

    if (!activeFileId || !currentResults) return;
    
    try {
      // If this is a problem-specific export, handle it specially
      if (['duplicates', 'nulls', 'type_issues'].includes(format)) {
        await handleProblemExportLocal(format, options?.columnName);
        return;
      }

      // Handle different export formats
      switch (format.toLowerCase()) {
        case 'csv':
          await handleCSVExport();
          break;
        case 'json':
          await handleJSONExport();
          break;
        case 'excel':
          await handleExcelExport();
          break;
        case 'pdf':
          await handlePDFExport();
          break;
        case 'html':
          await handleHTMLExport();
          break;
        case 'word':
          await handleWordExport();
          break;
        case 'parquet':
          await handleParquetExport();
          break;
        default:
          // Default export for general analysis results
          await exportResults(activeFileId);
      }
    } catch (err) {
      console.error('Export failed:', err);
      throw err;
    }
  };

  const handleCSVExport = async () => {
    if (!activeTableName) throw new Error('No active table');
    
    const duckDBStore = useDuckDBStore.getState();
    const escapedTableName = duckDBStore.registeredTables.get(activeTableName);
    if (!escapedTableName) throw new Error('Table not found');

    const query = `SELECT * FROM ${escapedTableName}`;
    const result = await duckDBStore.executePaginatedQuery(query, 1, 100000, false, false);
    
    if (!result?.data) throw new Error('No data found');

    const headers = result.columns;
    const csvContent = [
      headers.join(','),
      ...result.data.map(row => 
        headers.map(header => {
          const value = row[header];
          const stringValue = value === null || value === undefined ? '' : String(value);
          return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        }).join(',')
      )
    ].join('\n');

    const fileName = `${activeFile?.fileName || 'data'}_export_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(csvContent, fileName, 'text/csv');
  };

  const handleJSONExport = async () => {
    const exportData = {
      metadata: {
        fileName: activeFile?.fileName,
        exportDate: new Date().toISOString(),
        analysisTimestamp: currentResults?.analysisTimestamp,
        totalRows: currentResults?.totalRows,
        totalColumns: currentResults?.totalColumns,
      },
      healthScore: currentResults?.healthScore,
      healthBreakdown: currentResults?.healthBreakdown,
      columnMetrics: currentResults?.columnMetrics,
      typeIssues: currentResults?.typeIssues,
      recommendations: currentResults?.recommendations,
      duplicateInfo: {
        duplicateRows: currentResults?.duplicateRows,
        duplicatePercentage: currentResults?.duplicatePercentage,
      }
    };

    const fileName = `${activeFile?.fileName || 'data'}_analysis_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(JSON.stringify(exportData, null, 2), fileName, 'application/json');
  };

  const handleHTMLExport = async () => {
    if (!currentResults) return;
    exportHTMLReport(currentResults, activeFile);
  };

  const handleExcelExport = async () => {
    // For now, export as CSV (would need xlsx library for real Excel export)
    await handleCSVExport();
  };

  const handlePDFExport = async () => {
    // For now, generate HTML and suggest printing to PDF
    const htmlContent = generateAnalysisHTML();
    const fileName = `${activeFile?.fileName || 'data'}_report_${new Date().toISOString().split('T')[0]}.html`;
    downloadFile(htmlContent, fileName, 'text/html');
    
    // Show user instructions for PDF conversion
    alert('HTML report downloaded. Use your browser\'s "Print to PDF" feature to convert to PDF.');
  };

  const handleWordExport = async () => {
    // For now, export as HTML (would need docx library for real Word export)
    await handleHTMLExport();
  };

  const handleParquetExport = async () => {
    // Parquet export would require specialized library
    // For now, fall back to CSV
    await handleCSVExport();
  };

  const generateAnalysisHTML = () => {
    if (!currentResults) return '<html><body>No analysis data available</body></html>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Analysis Report - ${activeFile?.fileName || 'Unknown'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #2dd4bf; padding-bottom: 20px; margin-bottom: 30px; }
        .health-score { background: linear-gradient(135deg, #2dd4bf, #06b6d4); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2dd4bf; }
        .column-list { margin-bottom: 30px; }
        .column-item { background: #f8fafc; padding: 15px; margin-bottom: 10px; border-radius: 6px; border-left: 3px solid #94a3b8; }
        .recommendations { background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; }
        .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Data Analysis Report</h1>
            <p><strong>File:</strong> ${activeFile?.fileName || 'Unknown'}</p>
            <p><strong>Analysis Date:</strong> ${new Date(currentResults.analysisTimestamp).toLocaleString()}</p>
        </div>

        <div class="health-score">
            <h2>Overall Health Score</h2>
            <div style="font-size: 48px; font-weight: bold; margin: 10px 0;">${currentResults.healthScore}%</div>
            <div style="display: flex; justify-content: space-around; margin-top: 20px;">
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">Completeness</div>
                    <div style="font-size: 18px; font-weight: bold;">${currentResults.healthBreakdown.completeness}%</div>
                </div>
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">Uniqueness</div>
                    <div style="font-size: 18px; font-weight: bold;">${currentResults.healthBreakdown.uniqueness}%</div>
                </div>
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">Consistency</div>
                    <div style="font-size: 18px; font-weight: bold;">${currentResults.healthBreakdown.consistency}%</div>
                </div>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Total Rows</h3>
                <div style="font-size: 24px; font-weight: bold; color: #2dd4bf;">${currentResults.totalRows.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <h3>Total Columns</h3>
                <div style="font-size: 24px; font-weight: bold; color: #2dd4bf;">${currentResults.totalColumns}</div>
            </div>
            <div class="metric-card">
                <h3>Duplicate Rows</h3>
                <div style="font-size: 24px; font-weight: bold; color: ${currentResults.duplicateRows > 0 ? '#ef4444' : '#10b981'};">${currentResults.duplicateRows}</div>
            </div>
            <div class="metric-card">
                <h3>Type Issues</h3>
                <div style="font-size: 24px; font-weight: bold; color: ${currentResults.typeIssues.length > 0 ? '#ef4444' : '#10b981'};">${currentResults.typeIssues.length}</div>
            </div>
        </div>

        <div class="column-list">
            <h2>Column Analysis</h2>
            ${currentResults.columnMetrics.map(col => `
                <div class="column-item">
                    <h4>${col.name} (${col.type})</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 10px;">
                        <div><strong>Null Count:</strong> ${col.nullCount}</div>
                        <div><strong>Null %:</strong> ${col.nullPercentage.toFixed(2)}%</div>
                        <div><strong>Unique Count:</strong> ${col.uniqueCount}</div>
                        <div><strong>Cardinality:</strong> ${col.cardinality.toFixed(4)}</div>
                    </div>
                    ${col.numericStats ? `
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                            <strong>Numeric Stats:</strong> Min: ${col.numericStats.min}, Max: ${col.numericStats.max}, Mean: ${col.numericStats.mean.toFixed(2)}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        ${currentResults.recommendations.length > 0 ? `
            <div class="recommendations">
                <h2>Recommendations</h2>
                <ul>
                    ${currentResults.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        <div class="footer">
            Generated by DataKit Inspector on ${new Date().toLocaleDateString()}
        </div>
    </div>
</body>
</html>`;
  };

  const handleProblemExportLocal = async (problemType: string, columnName?: string) => {
    if (!activeFileId || !activeTableName) {
      throw new Error('No active file or table');
    }

    try {
      await handleProblemExport(
        problemType as ProblemType,
        activeFileId,
        activeFile?.fileName,
        columnName,
        {
          fetchDuplicateRows,
          fetchNullRows,
          fetchTypeIssueRows,
        }
      );
    } catch (error) {
      console.error('Problem export failed:', error);
      throw error;
    }
  };

  const handleExportColumn = async (format: string, columnName: string) => {
    if (!isAuthenticated && ['excel', 'chart'].includes(format)) {
      setShowAuthModal(true);
      return;
    }

    if (!activeFileId || !currentResults) {
      throw new Error('No active file or analysis results');
    }

    try {
      const duckDBStore = useDuckDBStore.getState();
      const escapedTableName = duckDBStore.registeredTables.get(activeTableName || '');
      
      if (!escapedTableName) {
        throw new Error('Table not found');
      }

      const query = `SELECT DISTINCT "${columnName}" FROM ${escapedTableName} WHERE "${columnName}" IS NOT NULL ORDER BY "${columnName}"`;
      const result = await duckDBStore.executePaginatedQuery(query, 1, 1000000, false, false);
      
      if (!result?.data) {
        throw new Error('No data found');
      }

      const columnData = result.data.map(row => row[columnName]);
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `${activeFile?.fileName || 'data'}_${columnName}_${timestamp}`;

      switch (format) {
        case 'csv':
          exportAsCSV(columnData, columnName, fileName);
          break;
        case 'json':
          exportAsJSON(columnData, columnName, fileName);
          break;
        case 'txt':
          exportAsText(columnData, fileName);
          break;
        case 'excel':
          await exportAsExcel(columnData, columnName, fileName);
          break;
        case 'chart':
          exportAsChart(columnName);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (err) {
      console.error('Column export failed:', err);
      throw err;
    }
  };

  // Helper functions for different export formats (now using utilities)

  const exportAsChart = async (columnName: string) => {
    try {
      // Find the chart element within the expanded column
      const columnElement = document.querySelector(`[data-column="${columnName}"]`);
      if (!columnElement) {
        throw new Error('Chart not found. Please expand the column first.');
      }

      // For now, we'll create a data URL from the chart content
      // In a real implementation, you might use html2canvas or similar
      
      // Get the column metrics to recreate chart data
      const columnMetrics = currentResults?.columnMetrics.find(col => col.name === columnName);
      if (!columnMetrics) {
        throw new Error('Column metrics not found');
      }

      // Create a simple SVG representation of the chart data
      const svgChart = createChartSVG(columnMetrics);
      const svgBlob = new Blob([svgChart], { type: 'image/svg+xml' });
      const fileName = `${activeFile?.fileName || 'data'}_${columnName}_chart_${new Date().toISOString().split('T')[0]}.svg`;
      
      // Download as SVG
      const link = document.createElement('a');
      const url = URL.createObjectURL(svgBlob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Chart export failed:', error);
      throw error;
    }
  };

  const createChartSVG = (column: any) => {
    const width = 400;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create basic histogram or bar chart SVG
    let chartContent = '';
    
    if (column.histogramData && column.histogramData.length > 0) {
      // Histogram
      const maxCount = Math.max(...column.histogramData.map((d: any) => d.count));
      const barWidth = chartWidth / column.histogramData.length;
      
      chartContent = column.histogramData.map((bin: any, i: number) => {
        const barHeight = (bin.count / maxCount) * chartHeight;
        const x = i * barWidth;
        const y = chartHeight - barHeight;
        
        return `<rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" fill="#2dd4bf" opacity="0.8"/>`;
      }).join('');
      
    } else {
      // Simple bar for basic stats
      const stats = [
        { label: 'Total', value: column.uniqueCount },
        { label: 'Nulls', value: column.nullCount },
        { label: 'Unique', value: column.uniqueCount }
      ];
      
      const maxValue = Math.max(...stats.map(s => s.value));
      const barHeight = chartHeight / stats.length;
      
      chartContent = stats.map((stat, i) => {
        const barWidth = (stat.value / maxValue) * chartWidth;
        const y = i * barHeight;
        
        return `
          <rect x="0" y="${y}" width="${barWidth}" height="${barHeight - 5}" fill="#2dd4bf" opacity="0.8"/>
          <text x="5" y="${y + barHeight/2 + 5}" fill="white" font-size="12">${stat.label}: ${stat.value}</text>
        `;
      }).join('');
    }

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: #1a1a1a;">
        <defs>
          <style>
            text { font-family: Arial, sans-serif; }
          </style>
        </defs>
        
        <g transform="translate(${margin.left}, ${margin.top})">
          ${chartContent}
          
          <!-- Axes -->
          <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          
          <!-- Title -->
          <text x="${chartWidth/2}" y="-5" text-anchor="middle" fill="white" font-size="14" font-weight="bold">
            ${column.name} Distribution
          </text>
          
          <!-- Axis labels -->
          <text x="${chartWidth/2}" y="${chartHeight + 30}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="12">
            Values
          </text>
          <text x="-40" y="${chartHeight/2}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="12" transform="rotate(-90, -40, ${chartHeight/2})">
            Count
          </text>
        </g>
      </svg>
    `;
  };


  const handleViewDetails = async (
    columnName: string,
    type: 'nulls' | 'outliers' | 'duplicates'
  ) => {
    if (!activeFileId) return;

    try {
      let data: any[] = [];

      // Fetch actual row data based on type
      switch (type) {
        case 'duplicates':
          data = await fetchDuplicateRows(activeFileId, 100);
          break;
        case 'nulls':
          data = await fetchNullRows(activeFileId, columnName, 100);
          break;
        case 'outliers':
          data = await fetchOutlierRows(activeFileId, columnName, 100);
          break;
      }

      setRowDetailsModal({
        isOpen: true,
        title: `${columnName} - ${type}`,
        type:
          type === 'duplicates'
            ? 'duplicates'
            : type === 'outliers'
            ? 'outliers'
            : 'nulls',
        columnName,
        data,
      });
    } catch (error) {
      console.error('Error fetching row details:', error);

      // Fall back to empty data on error
      setRowDetailsModal({
        isOpen: true,
        title: `${columnName} - ${type}`,
        type:
          type === 'duplicates'
            ? 'duplicates'
            : type === 'outliers'
            ? 'outliers'
            : 'nulls',
        columnName,
        data: [],
      });
    }
  };

  const handleRetry = () => {
    if (!activeFile || !activeFileId) return;
    resetError();
    manualTrigger();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
  };

  // Reset search when results change
  useEffect(() => {
    setSearchTerm('');
    setFilterType('all');
    setExpandedColumns(new Set());
    setCurrentView('overview');
  }, [activeFileId]);

  // Resize handling
  useEffect(() => {
    let startX = 0;
    let startWidth = 0;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startX = e.clientX;
      startWidth = width;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = startWidth + deltaX;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const resizeHandle = resizeHandleRef.current;
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
      return () => {
        resizeHandle.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [width, setWidth]);

  // Note: Removed click-outside-to-close behavior - panel only closes with X button

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  if (!isOpen) return null;

  const FileSelector: React.FC<{
    currentFileId: string | null;
    onFileChange: (fileId: string) => void;
  }> = ({ currentFileId, onFileChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const currentFile = fileTabs.find((tab) => tab.id === currentFileId);

    if (fileTabs.length <= 1) return null;

    return (
      <div className="relative p-4 border-b border-white/10">
        <motion.button
          whileHover={{ scale: 1.01 }}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-card/30 hover:bg-card/50 rounded-lg border border-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-white/60" />
            <span className="text-sm text-white truncate">
              {currentFile?.fileName || 'Select file...'}
            </span>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-white/60" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-4 right-4 mt-1 bg-card backdrop-blur-sm border border-white/20 rounded-lg shadow-xl z-51 max-h-48 overflow-y-auto"
            >
              {fileTabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  onClick={() => {
                    onFileChange(tab.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 p-3 text-left transition-colors cursor-pointer',
                    tab.id === currentFileId && 'bg-primary/20 text-primary'
                  )}
                >
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="text-sm truncate">{tab.fileName}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className={cn('fixed inset-y-0 right-0 z-50', className)}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        className="relative h-full bg-background/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex"
        style={{ width: `${Math.max(600, width)}px` }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {/* Resize Handle */}
        <div
          ref={resizeHandleRef}
          className="absolute left-0 top-0 bottom-0 w-1 hover:bg-primary/50 cursor-col-resize transition-colors"
          style={{
            opacity: isResizing ? 1 : 0,
            transition: isResizing ? 'none' : 'opacity 0.2s ease',
          }}
        />

        {/* Panel Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 border-b border-white/10"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                Data Inspector
              </h2>
            </div>
            <button
              onClick={closePanel}
              className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>

          {/* TODO: There's an issue here with file change */}
          {/* File Selector */}
          {fileTabs.length > 1 && (
            <FileSelector
              currentFileId={activeFileId}
              onFileChange={handleFileChange}
            />
          )}

          {/* Quick Actions Bar */}
          {currentResults && !isAnalyzing && !error && (
            <QuickActionsBar
              fileName={activeFile?.fileName || 'Unknown'}
              lastAnalyzed={new Date(currentResults.analysisTimestamp)}
            />
          )}

          {/* View Switcher */}
          {currentResults && !isAnalyzing && !error && (
            <div className="p-4 border-b border-white/10">
              <ViewSwitcher
                currentView={currentView}
                onViewChange={setCurrentView}
                problemCount={problemCount}
                columnCount={currentResults.columnMetrics.length}
                rowCount={currentResults.totalRows}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Error State */}
            {error && !isAnalyzing && (
              <ErrorEmptyState
                error={error}
                onRetry={handleRetry}
                onReset={resetError}
              />
            )}

            {/* Loading State */}
            {isAnalyzing && (
              <LoadingState
                progress={analysisProgress}
                status={analysisStatus}
                startTime={analysisStartTime}
                preview={quickPreview}
                estimatedTimeLeft={0}
              />
            )}

            {/* Quick Preview */}
            {shouldShowPreview && quickPreview && !currentResults && !error && (
              <div className="p-4">
                <QuickPreviewCard
                  preview={quickPreview}
                  isAnalyzing={isAnalyzing || isGettingPreview}
                />
              </div>
            )}

            {/* Main Content - Analysis Results */}
            {currentResults && !isAnalyzing && !error && (
              <>
                {/* Overview */}
                {currentView === 'overview' && (
                  <Overview
                    metrics={currentResults}
                  />
                )}

                {/* Columns View */}
                {currentView === 'columns' && (
                  <>
                    <ColumnSearch
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      filterType={filterType}
                      onFilterChange={setFilterType}
                      totalColumns={currentResults.columnMetrics.length}
                      filteredCount={filteredColumns.length}
                    />

                    <div className="flex-1">
                      {filteredColumns.length > 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {filteredColumns.map((column, index) => (
                            <motion.div
                              key={column.name}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                              <ColumnRow
                                column={column}
                                metrics={currentResults}
                                isExpanded={expandedColumns.has(column.name)}
                                onToggle={() => toggleColumn(column.name)}
                                onGenerateQuery={handleGenerateQuery}
                                onViewDetails={handleViewDetails}
                                onExportColumn={handleExportColumn}
                                onAuthRequired={() => setShowAuthModal(true)}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      ) : (
                        <NoColumnsEmptyState
                          searchTerm={searchTerm}
                          filterType={filterType}
                          onClearFilters={handleClearFilters}
                          totalColumns={currentResults.columnMetrics.length}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Problems View */}
                {currentView === 'problems' && (
                  <ProblemsView
                    metrics={currentResults}
                    onViewDuplicates={() => handleViewDetails('', 'duplicates')}
                    onViewNulls={(columnName) =>
                      handleViewDetails(columnName, 'nulls')
                    }
                    onViewIssues={(columnName) =>
                      handleViewDetails(columnName, 'nulls')
                    }
                    onExportProblems={(type, columnName) => 
                      handleExport(type, columnName ? { columnName } : undefined)
                    }
                    onAuthRequired={() => setShowAuthModal(true)}
                  />
                )}

        

                {/* Export Panel */}
                {currentView === 'export' && (
                  <ExportPanel
                    fileName={activeFile?.fileName || 'Unknown'}
                    onExport={handleExport}
                    onAuthRequired={() => setShowAuthModal(true)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Row Details Modal */}
      <RowDetailsModal
        isOpen={rowDetailsModal.isOpen}
        onClose={() =>
          setRowDetailsModal({ ...rowDetailsModal, isOpen: false })
        }
        title={rowDetailsModal.title}
        type={rowDetailsModal.type}
        columnName={rowDetailsModal.columnName}
        data={rowDetailsModal.data}
        onExport={handleExport}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="login"
        onLoginSuccess={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default InspectorPanel;
