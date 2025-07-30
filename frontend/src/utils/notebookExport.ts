import type { PythonCell } from '@/lib/python/types';
import { generatePDF, downloadJSON, pdfStyles } from './exportUtils';

// Jupyter Notebook format interfaces
interface JupyterCell {
  cell_type: 'code' | 'markdown';
  source: string[];
  metadata: Record<string, any>;
  execution_count?: number | null;
  outputs?: JupyterOutput[];
}

interface JupyterOutput {
  output_type: 'display_data' | 'error' | 'execute_result' | 'stream';
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  text?: string[];
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface JupyterNotebook {
  cells: JupyterCell[];
  metadata: {
    kernelspec: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info: {
      name: string;
      version: string;
      mimetype: string;
      codemirror_mode: { name: string; version: number };
      pygments_lexer: string;
      nbconvert_exporter: string;
      file_extension: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}

/**
 * Export notebook cells as Jupyter Notebook (.ipynb) format
 */
export const exportAsJupyterNotebook = (
  cells: PythonCell[],
  notebookName: string = 'DataKit_Notebook'
): void => {
  try {
    // Convert DataKit cells to Jupyter format
    const jupyterCells: JupyterCell[] = cells.map(cell => {
      const baseCell = {
        cell_type: cell.type === 'markdown' ? 'markdown' as const : 'code' as const,
        source: cell.code.split('\n').map((line, index, array) => 
          index === array.length - 1 ? line : line + '\n'
        ),
        metadata: {},
      };

      if (cell.type === 'code') {
        const mapDataKitToJupyterOutput = (output: any): JupyterOutput => {
          switch (output.type) {
            case 'error':
              return {
                output_type: 'error',
                ename: 'Error',
                evalue: output.content,
                traceback: [output.content]
              };
            case 'text':
              return {
                output_type: 'stream',
                name: 'stdout',
                text: Array.isArray(output.content) ? output.content : [output.content]
              };
            case 'image':
              return {
                output_type: 'display_data',
                data: {
                  'image/png': output.content.includes(',') ? output.content.split(',')[1] : output.content
                },
                metadata: {}
              };
            case 'html':
              return {
                output_type: 'display_data',
                data: {
                  'text/html': Array.isArray(output.content) ? output.content : [output.content]
                },
                metadata: {}
              };
            case 'dataframe':
              return {
                output_type: 'execute_result',
                data: {
                  'text/plain': Array.isArray(output.content) ? output.content : [output.content]
                },
                metadata: {},
                execution_count: cell.executionCount
              };
            default:
              return {
                output_type: 'display_data',
                data: {
                  'text/plain': Array.isArray(output.content) ? output.content : [output.content]
                },
                metadata: {}
              };
          }
        };

        return {
          ...baseCell,
          execution_count: cell.executionCount,
          outputs: cell.output.map(mapDataKitToJupyterOutput)
        };
      }

      return baseCell;
    });

    // Create Jupyter notebook structure
    const notebook: JupyterNotebook = {
      cells: jupyterCells,
      metadata: {
        kernelspec: {
          display_name: 'Python 3 (Pyodide)',
          language: 'python',
          name: 'python3'
        },
        language_info: {
          name: 'python',
          version: '3.11.3',
          mimetype: 'text/x-python',
          codemirror_mode: { name: 'ipython', version: 3 },
          pygments_lexer: 'ipython3',
          nbconvert_exporter: 'python',
          file_extension: '.py'
        }
      },
      nbformat: 4,
      nbformat_minor: 4
    };

    // Download as .ipynb file
    downloadJSON(notebook, notebookName, 'ipynb');

  } catch (error) {
    console.error('Failed to export Jupyter notebook:', error);
    throw new Error('Jupyter notebook export failed. Please try again.');
  }
};

/**
 * Convert markdown text to HTML for PDF export
 */
const convertMarkdownToHTML = (markdown: string): string => {
  return markdown
    .replace(/^# (.*$)/gim, '<h1 style="font-size: 18px; font-weight: bold; margin: 10px 0; color: #000;">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size: 16px; font-weight: bold; margin: 8px 0; color: #000;">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 style="font-size: 14px; font-weight: bold; margin: 6px 0; color: #000;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>')
    .replace(/`(.*?)`/g, '<code style="background-color: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>')
    .replace(/^- (.*$)/gim, '<li style="margin: 4px 0;">$1</li>')
    .replace(/(\n|^)([^<\n].*?)(\n|$)/g, '<p style="margin: 8px 0; line-height: 1.4;">$2</p>')
    .replace(/(<li.*?<\/li>)+/g, '<ul style="margin: 8px 0; padding-left: 20px;">$&</ul>');
};

/**
 * Generate HTML content for PDF export from notebook cells
 */
const generateNotebookHTML = (cells: PythonCell[]): string => {
  const cellsHTML = cells.map((cell, index) => {
    let cellHTML = `
      <div style="${pdfStyles.cellContainer}">
        <div style="${pdfStyles.cellHeader}">
          ${cell.type === 'code' ? 'Code' : 'Markdown'} Cell [${index + 1}]
        </div>
        <div style="${pdfStyles.cellContent}">
    `;

    if (cell.type === 'markdown') {
      // Render markdown as HTML
      cellHTML += convertMarkdownToHTML(cell.code);
    } else {
      // Render code with syntax highlighting
      cellHTML += `
        <pre style="${pdfStyles.codeBlock}">${cell.code}</pre>
      `;

      // Add outputs if they exist
      if (cell.output.length > 0) {
        cellHTML += `
          <div style="font-weight: bold; margin-top: 10px; margin-bottom: 5px; font-size: 12px;">
            Output:
          </div>
          <div style="${pdfStyles.outputBlock}">
        `;

        cell.output.forEach(output => {
          if (output.type === 'error') {
            cellHTML += `
              <div style="color: #d32f2f; font-weight: bold; margin-bottom: 5px; font-size: 11px; font-family: Consolas, Monaco, monospace;">
                ${output.content}
              </div>
            `;
          } else if (output.type === 'image') {
            cellHTML += `
              <img src="${output.content}" style="max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px;" />
            `;
          } else {
            cellHTML += `
              <div style="color: #333333; white-space: pre-wrap; margin-bottom: 5px; font-size: 11px; font-family: Consolas, Monaco, monospace;">
                ${output.content}
              </div>
            `;
          }
        });

        cellHTML += '</div>';
      }
    }

    cellHTML += `
        </div>
      </div>
    `;

    return cellHTML;
  }).join('');

  return cellsHTML;
};

/**
 * Export notebook cells as PDF
 */
export const exportNotebookAsPDF = async (
  cells: PythonCell[],
  notebookName: string = 'DataKit_Notebook'
): Promise<void> => {
  try {
    const htmlContent = generateNotebookHTML(cells);
    
    await generatePDF(htmlContent, {
      filename: notebookName,
      title: notebookName,
      includeTimestamp: true
    });

  } catch (error) {
    console.error('Failed to export notebook as PDF:', error);
    throw new Error('PDF export failed. Please try again.');
  }
};

/**
 * Export notebook cells as plain Python script
 */
export const exportAsPythonScript = (
  cells: PythonCell[],
  scriptName: string = 'DataKit_Script'
): void => {
  try {
    const pythonContent = cells
      .filter(cell => cell.type === 'code')
      .map((cell, index) => {
        const cellComment = `# Cell ${index + 1}\n`;
        return cellComment + cell.code;
      })
      .join('\n\n');

    const blob = new Blob([pythonContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scriptName}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Failed to export Python script:', error);
    throw new Error('Python script export failed. Please try again.');
  }
};

/**
 * Export notebook cells as Markdown document
 */
export const exportAsMarkdown = (
  cells: PythonCell[],
  documentName: string = 'DataKit_Document'
): void => {
  try {
    const markdownContent = cells.map((cell, index) => {
      if (cell.type === 'markdown') {
        return cell.code;
      } else {
        let content = `## Code Cell ${index + 1}\n\n\`\`\`python\n${cell.code}\n\`\`\`\n`;
        
        if (cell.output.length > 0) {
          content += '\n### Output\n\n';
          cell.output.forEach(output => {
            if (output.type === 'error') {
              content += `\`\`\`\nError: ${output.content}\n\`\`\`\n\n`;
            } else {
              content += `\`\`\`\n${output.content}\n\`\`\`\n\n`;
            }
          });
        }
        
        return content;
      }
    }).join('\n\n---\n\n');

    const fullDocument = `# ${documentName}\n\n*Generated from DataKit Notebook on ${new Date().toLocaleDateString()}*\n\n${markdownContent}`;

    const blob = new Blob([fullDocument], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Failed to export Markdown document:', error);
    throw new Error('Markdown export failed. Please try again.');
  }
};