// Export utility functions for generating PDFs and other formats

export interface ExportOptions {
  filename?: string;
  title?: string;
  includeTimestamp?: boolean;
}

/**
 * Generate PDF from HTML content using jsPDF and html2canvas
 */
export const generatePDF = async (
  htmlContent: string, 
  options: ExportOptions = {}
): Promise<void> => {
  const { 
    filename = 'DataKit_Export', 
    title = 'DataKit Export',
    includeTimestamp = true 
  } = options;

  try {
    // Dynamic imports
    const jsPDF = (await import('jspdf')).default;
    const html2canvas = (await import('html2canvas')).default;
    
    // Create temporary container for PDF generation
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '794px'; // A4 width in pixels
    tempContainer.style.backgroundColor = '#ffffff';
    tempContainer.style.color = '#000000';
    tempContainer.style.fontFamily = 'Arial, sans-serif';
    tempContainer.style.padding = '40px';
    tempContainer.style.lineHeight = '1.4';
    
    // Add title
    const titleElement = document.createElement('h1');
    titleElement.textContent = title;
    titleElement.style.fontSize = '24px';
    titleElement.style.marginBottom = '20px';
    titleElement.style.color = '#000000';
    titleElement.style.fontWeight = 'bold';
    titleElement.style.textAlign = 'center';
    titleElement.style.borderBottom = '2px solid #000000';
    titleElement.style.paddingBottom = '10px';
    tempContainer.appendChild(titleElement);

    // Add timestamp if requested
    if (includeTimestamp) {
      const dateDiv = document.createElement('div');
      dateDiv.textContent = `Generated on: ${new Date().toLocaleDateString()} with DataKit`;
      dateDiv.style.fontSize = '12px';
      dateDiv.style.color = '#666666';
      dateDiv.style.textAlign = 'center';
      dateDiv.style.marginBottom = '30px';
      tempContainer.appendChild(dateDiv);
    }

    // Add main content
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = htmlContent;
    tempContainer.appendChild(contentDiv);

    document.body.appendChild(tempContainer);

    // Generate canvas from the container
    const canvas = await html2canvas(tempContainer, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
      width: 794,
      height: tempContainer.scrollHeight
    });

    // Clean up
    document.body.removeChild(tempContainer);

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Save the PDF
    pdf.save(`${filename}.pdf`);

  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw new Error('PDF generation failed. Please try again.');
  }
};

/**
 * Download JSON data as a file
 */
export const downloadJSON = (
  data: any, 
  filename: string = 'DataKit_Export',
  extension: string = 'json'
): void => {
  try {
    // Use specific MIME type for Jupyter notebooks
    const mimeType = extension === 'ipynb' 
      ? 'application/x-ipynb+json' 
      : 'application/json';
      
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: mimeType
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download JSON:', error);
    throw new Error('JSON download failed. Please try again.');
  }
};

/**
 * Download text content as a file
 */
export const downloadText = (
  content: string, 
  filename: string = 'DataKit_Export',
  extension: string = 'txt'
): void => {
  try {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download text:', error);
    throw new Error('Text download failed. Please try again.');
  }
};

/**
 * Create styled HTML content for PDF export
 */
export const createStyledHTMLContent = (content: string): string => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.4; color: #000000;">
      ${content}
    </div>
  `;
};

/**
 * Common PDF styles for different content types
 */
export const pdfStyles = {
  cellContainer: 'margin-bottom: 25px; border: 1px solid #cccccc; border-radius: 6px; overflow: hidden; page-break-inside: avoid;',
  cellHeader: 'padding: 8px 12px; background-color: #f5f5f5; border-bottom: 1px solid #cccccc; font-size: 12px; color: #666666; font-weight: bold;',
  cellContent: 'padding: 12px; background-color: #ffffff;',
  codeBlock: 'background-color: #f8f8f8; padding: 10px; border-radius: 4px; font-size: 11px; font-family: Consolas, Monaco, monospace; color: #000000; overflow: auto; white-space: pre-wrap; word-break: break-word; border: 1px solid #e0e0e0;',
  outputBlock: 'margin-top: 5px; padding: 8px; background-color: #fafafa; border-radius: 4px; border: 1px solid #e0e0e0;',
};