export interface ChartExportOptions {
  width?: number;
  height?: number;
  format?: 'svg' | 'png';
  backgroundColor?: string;
}

/**
 * Creates SVG chart representation for column data
 */
export const createChartSVG = (
  column: any,
  options: ChartExportOptions = {}
): string => {
  const { width = 400, height = 300, backgroundColor = '#1a1a1a' } = options;

  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Create basic histogram or bar chart SVG
  let chartContent = '';

  if (column.histogramData && column.histogramData.length > 0) {
    // Histogram
    const maxCount = Math.max(...column.histogramData.map((d: any) => d.count));
    const barWidth = chartWidth / column.histogramData.length;

    chartContent = column.histogramData
      .map((bin: any, i: number) => {
        const barHeight = (bin.count / maxCount) * chartHeight;
        const x = i * barWidth;
        const y = chartHeight - barHeight;

        return `<rect x="${x}" y="${y}" width="${
          barWidth - 1
        }" height="${barHeight}" fill="#2dd4bf" opacity="0.8"/>`;
      })
      .join('');
  } else {
    // Simple bar for basic stats
    const stats = [
      { label: 'Total', value: column.uniqueCount },
      { label: 'Nulls', value: column.nullCount },
      { label: 'Unique', value: column.uniqueCount },
    ];

    const maxValue = Math.max(...stats.map((s) => s.value));
    const barHeight = chartHeight / stats.length;

    chartContent = stats
      .map((stat, i) => {
        const barWidth = (stat.value / maxValue) * chartWidth;
        const y = i * barHeight;

        return `
        <rect x="0" y="${y}" width="${barWidth}" height="${
          barHeight - 5
        }" fill="#2dd4bf" opacity="0.8"/>
        <text x="5" y="${y + barHeight / 2 + 5}" fill="white" font-size="12">${
          stat.label
        }: ${stat.value}</text>
      `;
      })
      .join('');
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: ${backgroundColor};">
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
        <text x="${
          chartWidth / 2
        }" y="-5" text-anchor="middle" fill="white" font-size="14" font-weight="bold">
          ${column.name} Distribution
        </text>
        
        <!-- Axis labels -->
        <text x="${chartWidth / 2}" y="${
    chartHeight + 30
  }" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="12">
          Values
        </text>
        <text x="-40" y="${
          chartHeight / 2
        }" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="12" transform="rotate(-90, -40, ${
    chartHeight / 2
  })">
          Count
        </text>
      </g>
    </svg>
  `;
};

/**
 * Exports chart as SVG file
 */
export const exportChartAsSVG = (
  column: any,
  fileName?: string,
  options: ChartExportOptions = {}
) => {
  try {
    const svgContent = createChartSVG(column, options);
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
    const finalFileName = fileName || `${column.name}_chart_${Date.now()}.svg`;

    const link = document.createElement('a');
    const url = URL.createObjectURL(svgBlob);
    link.setAttribute('href', url);
    link.setAttribute('download', finalFileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('SVG chart export failed:', error);
    throw error;
  }
};

/**
 * Exports chart as PNG file (converts SVG to PNG via Canvas)
 */
export const exportChartAsPNG = (
  column: any,
  fileName?: string,
  options: ChartExportOptions = {}
) => {
  try {
    const { width = 400, height = 300 } = options;
    const svgContent = createChartSVG(column, options);
    const finalFileName = fileName || `${column.name}_chart_${Date.now()}.png`;

    // Convert SVG to PNG using canvas
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    img.onload = () => {
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = finalFileName;
            link.click();
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
      }
    };

    const svgBlob = new Blob([svgContent], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  } catch (error) {
    console.error('PNG chart export failed:', error);
    throw error;
  }
};

/**
 * Generic chart export function that handles both SVG and PNG
 */
export const exportChart = (
  column: any,
  format: 'svg' | 'png' = 'svg',
  fileName?: string,
  options: ChartExportOptions = {}
) => {
  if (format === 'png') {
    return exportChartAsPNG(column, fileName, options);
  } else {
    return exportChartAsSVG(column, fileName, options);
  }
};
