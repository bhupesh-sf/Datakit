import { InspectorMetrics } from '@/store/inspectorStore';
import { downloadFile } from './exportUtils';

export interface ReportExportOptions {
  fileName?: string;
  includeCharts?: boolean;
  printOptimized?: boolean;
}

/**
 * Generates HTML analysis report
 */
export const generateAnalysisHTML = (
  results: InspectorMetrics,
  fileName?: string
): string => {
  if (!results) return '<html><body>No analysis data available</body></html>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Analysis Report - ${fileName || 'Unknown'}</title>
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
            <p><strong>File:</strong> ${fileName || 'Unknown'}</p>
            <p><strong>Analysis Date:</strong> ${new Date(
              results.analysisTimestamp
            ).toLocaleString()}</p>
        </div>

        <div class="health-score">
            <h2>Overall Health Score</h2>
            <div style="font-size: 48px; font-weight: bold; margin: 10px 0;">${
              results.healthScore
            }%</div>
            <div style="display: flex; justify-content: space-around; margin-top: 20px;">
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">Completeness</div>
                    <div style="font-size: 18px; font-weight: bold;">${
                      results.healthBreakdown.completeness
                    }%</div>
                </div>
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">Uniqueness</div>
                    <div style="font-size: 18px; font-weight: bold;">${
                      results.healthBreakdown.uniqueness
                    }%</div>
                </div>
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">Consistency</div>
                    <div style="font-size: 18px; font-weight: bold;">${
                      results.healthBreakdown.consistency
                    }%</div>
                </div>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Total Rows</h3>
                <div style="font-size: 24px; font-weight: bold; color: #2dd4bf;">${results.totalRows.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <h3>Total Columns</h3>
                <div style="font-size: 24px; font-weight: bold; color: #2dd4bf;">${
                  results.totalColumns
                }</div>
            </div>
            <div class="metric-card">
                <h3>Duplicate Rows</h3>
                <div style="font-size: 24px; font-weight: bold; color: ${
                  results.duplicateRows > 0 ? '#ef4444' : '#10b981'
                };">${results.duplicateRows}</div>
            </div>
            <div class="metric-card">
                <h3>Type Issues</h3>
                <div style="font-size: 24px; font-weight: bold; color: ${
                  results.typeIssues.length > 0 ? '#ef4444' : '#10b981'
                };">${results.typeIssues.length}</div>
            </div>
        </div>

        <div class="column-list">
            <h2>Column Analysis</h2>
            ${results.columnMetrics
              .map(
                (col) => `
                <div class="column-item">
                    <h4>${col.name} (${col.type})</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 10px;">
                        <div><strong>Null Count:</strong> ${col.nullCount}</div>
                        <div><strong>Null %:</strong> ${col.nullPercentage.toFixed(
                          2
                        )}%</div>
                        <div><strong>Unique Count:</strong> ${
                          col.uniqueCount
                        }</div>
                        <div><strong>Cardinality:</strong> ${col.cardinality.toFixed(
                          4
                        )}</div>
                    </div>
                    ${
                      col.numericStats
                        ? `
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                            <strong>Numeric Stats:</strong> Min: ${
                              col.numericStats.min
                            }, Max: ${
                            col.numericStats.max
                          }, Mean: ${col.numericStats.mean.toFixed(2)}
                        </div>
                    `
                        : ''
                    }
                </div>
            `
              )
              .join('')}
        </div>

        ${
          results.recommendations.length > 0
            ? `
            <div class="recommendations">
                <h2>Recommendations</h2>
                <ul>
                    ${results.recommendations
                      .map((rec) => `<li>${rec}</li>`)
                      .join('')}
                </ul>
            </div>
        `
            : ''
        }

        <div class="footer">
            Generated by DataKit Inspector on ${new Date().toLocaleDateString()}
        </div>
    </div>
</body>
</html>`;
};

/**
 * Generates print-optimized HTML report
 */
export const generatePrintOptimizedHTML = (
  results: InspectorMetrics,
  fileName?: string
): string => {
  if (!results) return '<html><body>No analysis data available</body></html>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Analysis Report - ${fileName || 'Unknown'}</title>
    <style>
        @media print {
            body { margin: 0; background: white !important; }
            .container { max-width: none; margin: 0; padding: 20px; box-shadow: none; border-radius: 0; }
            .page-break { page-break-before: always; }
            .no-print { display: none; }
        }
        body { font-family: Arial, sans-serif; margin: 20px; background: white; color: #000; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; }
        .header { border-bottom: 2px solid #2dd4bf; padding-bottom: 20px; margin-bottom: 30px; }
        .health-score { background: #f0fdf4; border: 2px solid #2dd4bf; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric-card { background: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #2dd4bf; }
        .column-list { margin-bottom: 30px; }
        .column-item { background: #f8fafc; padding: 15px; margin-bottom: 10px; border-radius: 6px; border-left: 3px solid #94a3b8; break-inside: avoid; }
        .chart-placeholder { background: #f1f5f9; border: 1px dashed #cbd5e1; padding: 20px; text-align: center; color: #64748b; margin: 10px 0; }
        .recommendations { background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; break-inside: avoid; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
        h1 { color: #1a202c; }
        h2 { color: #2d3748; margin-top: 30px; }
        h3 { color: #4a5568; margin-bottom: 10px; }
        h4 { color: #4a5568; margin-bottom: 8px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        th { background-color: #f7fafc; font-weight: bold; }
        .problem-section { margin: 20px 0; padding: 15px; border-left: 4px solid #ef4444; background: #fef2f2; break-inside: avoid; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Data Analysis Report</h1>
            <p><strong>File:</strong> ${fileName || 'Unknown'}</p>
            <p><strong>Analysis Date:</strong> ${new Date(
              results.analysisTimestamp
            ).toLocaleString()}</p>
            <p><strong>Total Rows:</strong> ${results.totalRows.toLocaleString()} | <strong>Columns:</strong> ${
    results.totalColumns
  }</p>
        </div>

        <div class="health-score">
            <h2>Overall Health Score</h2>
            <div style="font-size: 42px; font-weight: bold; margin: 10px 0; color: #2dd4bf;">${
              results.healthScore
            }%</div>
            <div style="display: flex; justify-content: space-around; margin-top: 20px;">
                <div>
                    <div style="font-size: 12px; color: #64748b;">Completeness</div>
                    <div style="font-size: 16px; font-weight: bold;">${
                      results.healthBreakdown.completeness
                    }%</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: #64748b;">Uniqueness</div>
                    <div style="font-size: 16px; font-weight: bold;">${
                      results.healthBreakdown.uniqueness
                    }%</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: #64748b;">Consistency</div>
                    <div style="font-size: 16px; font-weight: bold;">${
                      results.healthBreakdown.consistency
                    }%</div>
                </div>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Total Rows</h3>
                <div style="font-size: 20px; font-weight: bold; color: #2dd4bf;">${results.totalRows.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <h3>Total Columns</h3>
                <div style="font-size: 20px; font-weight: bold; color: #2dd4bf;">${
                  results.totalColumns
                }</div>
            </div>
            <div class="metric-card">
                <h3>Duplicate Rows</h3>
                <div style="font-size: 20px; font-weight: bold; color: ${
                  results.duplicateRows > 0 ? '#ef4444' : '#10b981'
                };">${results.duplicateRows}</div>
                <div style="font-size: 12px; color: #64748b;">${results.duplicatePercentage.toFixed(
                  2
                )}% of total</div>
            </div>
            <div class="metric-card">
                <h3>Type Issues</h3>
                <div style="font-size: 20px; font-weight: bold; color: ${
                  results.typeIssues.length > 0 ? '#ef4444' : '#10b981'
                };">${results.typeIssues.length}</div>
            </div>
        </div>

        ${
          results.typeIssues.length > 0
            ? `
            <div class="problem-section">
                <h3>⚠️ Data Quality Issues</h3>
                ${results.typeIssues
                  .map(
                    (issue) => `
                    <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
                        <strong>${issue.column}:</strong> ${issue.issue} (${
                      issue.count
                    } occurrences)
                        ${
                          issue.examples
                            ? `<br><em>Examples: ${issue.examples
                                .slice(0, 3)
                                .join(', ')}</em>`
                            : ''
                        }
                    </div>
                `
                  )
                  .join('')}
            </div>
        `
            : ''
        }

        <div class="page-break"></div>
        
        <div class="column-list">
            <h2>Column Analysis</h2>
            ${results.columnMetrics
              .map(
                (col) => `
                <div class="column-item">
                    <h4>${
                      col.name
                    } <span style="color: #64748b; font-weight: normal;">(${
                  col.type
                })</span></h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 8px;">
                        <div><strong>Null Count:</strong> ${col.nullCount}</div>
                        <div><strong>Null %:</strong> ${col.nullPercentage.toFixed(
                          1
                        )}%</div>
                        <div><strong>Unique:</strong> ${col.uniqueCount}</div>
                        <div><strong>Cardinality:</strong> ${col.cardinality.toFixed(
                          3
                        )}</div>
                    </div>
                    ${
                      col.numericStats
                        ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 14px;">
                            <strong>📊 Statistics:</strong> 
                            Min: ${col.numericStats.min} | 
                            Max: ${col.numericStats.max} | 
                            Mean: ${col.numericStats.mean.toFixed(2)} | 
                            Std Dev: ${
                              col.numericStats.stdDev?.toFixed(2) || 'N/A'
                            }
                        </div>
                    `
                        : ''
                    }
                    ${
                      col.topValues && col.topValues.length > 0
                        ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 14px;">
                            <strong>🔝 Top Values:</strong> 
                            ${col.topValues
                              .slice(0, 5)
                              .map((tv) => `${tv.value} (${tv.count})`)
                              .join(', ')}
                        </div>
                    `
                        : ''
                    }
                </div>
            `
              )
              .join('')}
        </div>

        ${
          results.recommendations.length > 0
            ? `
            <div class="recommendations">
                <h2>💡 Recommendations</h2>
                <ul style="margin: 0; padding-left: 20px;">
                    ${results.recommendations
                      .map((rec) => `<li style="margin: 8px 0;">${rec}</li>`)
                      .join('')}
                </ul>
            </div>
        `
            : ''
        }

        <div class="footer">
            Generated by DataKit Inspector on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            <br>
            For interactive charts and real-time analysis, visit your DataKit.
        </div>
    </div>
</body>
</html>`;
};

/**
 * Exports HTML analysis report
 */
export const exportHTMLReport = (
  results: InspectorMetrics,
  activeFile?: { fileName?: string },
  options: ReportExportOptions = {}
) => {
  const { printOptimized = false } = options;

  const htmlContent = printOptimized
    ? generatePrintOptimizedHTML(results, activeFile?.fileName)
    : generateAnalysisHTML(results, activeFile?.fileName);

  const fileName = `${activeFile?.fileName || 'data'}_report_${
    new Date().toISOString().split('T')[0]
  }.html`;
  downloadFile(htmlContent, fileName, 'text/html');
};

/**
 * Exports PDF report (via print-optimized HTML)
 */
export const exportPDFReport = async (
  results: InspectorMetrics,
  activeFile?: { fileName?: string },
  options: ReportExportOptions = {}
) => {
  try {
    // Generate comprehensive HTML content optimized for PDF printing
    const htmlContent = generatePrintOptimizedHTML(
      results,
      activeFile?.fileName
    );
    const fileName = `${activeFile?.fileName || 'data'}_report_${
      new Date().toISOString().split('T')[0]
    }.html`;

    // Download the HTML file
    downloadFile(htmlContent, fileName, 'text/html');

    // Create a temporary preview window with print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load, then open print dialog
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  } catch (error) {
    console.error('PDF export failed:', error);
    // Fallback: just download HTML
    const htmlContent = generateAnalysisHTML(results, activeFile?.fileName);
    const fileName = `${activeFile?.fileName || 'data'}_report_${
      new Date().toISOString().split('T')[0]
    }.html`;
    downloadFile(htmlContent, fileName, 'text/html');
    throw new Error(
      'PDF export completed as HTML. Use browser print to convert to PDF.'
    );
  }
};
