import { InspectorMetrics } from '@/store/inspectorStore';

interface HTMLReportOptions {
  fileName?: string;
  includeRecommendations?: boolean;
  includeDetailedStats?: boolean;
}

/**
 * Generates a comprehensive HTML analysis report
 */
export const generateAnalysisHTML = (
  currentResults: InspectorMetrics,
  activeFile?: { fileName: string }
): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Analysis Report - ${activeFile?.fileName || 'Unknown File'}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background: #f8fafc; color: #1a202c; }
        .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 40px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
        .header h1 { margin: 0 0 10px 0; color: #2d3748; font-size: 32px; font-weight: 700; }
        .header p { margin: 5px 0; color: #64748b; font-size: 16px; }
        .health-score { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
        .health-score h2 { margin: 0 0 20px 0; font-size: 24px; opacity: 0.95; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
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
            Generated by DataKit Inspector on ${new Date().toLocaleDateString()} <br />
            For interactive charts and real-time analysis, visit your DataKit.
        </div>
    </div>
</body>
</html>`;
};

/**
 * Generates an HTML report and initiates download
 */
export const exportHTMLReport = (
  currentResults: InspectorMetrics,
  activeFile?: { fileName: string },
  options?: HTMLReportOptions
) => {
  const htmlContent = generateAnalysisHTML(currentResults, activeFile);
  const fileName = options?.fileName || `${activeFile?.fileName || 'data'}_analysis_report_${new Date().toISOString().split('T')[0]}.html`;
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};