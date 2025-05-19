import React, { useState, useRef, useEffect } from "react";
import { ensureSafeJSON } from "@/lib/duckdb/utils";
import { createPortal } from "react-dom";

interface TableCellProps {
  value: any;
  width: number;
}

const TableCell: React.FC<TableCellProps> = ({ value, width }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  
  // Create a portal container for tooltips if it doesn't exist
  useEffect(() => {
    if (!document.getElementById('tooltip-container')) {
      const tooltipContainer = document.createElement('div');
      tooltipContainer.id = 'tooltip-container';
      tooltipContainer.style.position = 'fixed';
      tooltipContainer.style.zIndex = '9999';
      tooltipContainer.style.pointerEvents = 'none';
      document.body.appendChild(tooltipContainer);
    }
  }, []);

  // Check if content is truncated on mount and resize
  useEffect(() => {
    const checkIfTruncated = () => {
      if (cellRef.current) {
        const isTruncated = cellRef.current.scrollWidth > cellRef.current.clientWidth;
        setIsTruncated(isTruncated);
      }
    };

    // Use requestAnimationFrame to ensure the DOM has updated
    requestAnimationFrame(checkIfTruncated);
    
    window.addEventListener('resize', checkIfTruncated);
    return () => {
      window.removeEventListener('resize', checkIfTruncated);
    };
  }, [value]);

  // Update tooltip position when mouse moves over the cell
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTruncated) {
      // Get mouse position
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      // Set tooltip to appear above the mouse cursor
      let top = mouseY - 10;
      let left = mouseX + 10;
      
      // Adjust if tooltip would go outside viewport
      if (tooltipRef.current) {
        const tooltipWidth = tooltipRef.current.offsetWidth;
        const tooltipHeight = tooltipRef.current.offsetHeight;
        
        // Check if tooltip would go off right edge
        if (left + tooltipWidth > window.innerWidth - 20) {
          left = mouseX - tooltipWidth - 10;
        }
        
        // Check if tooltip would go off top
        if (top - tooltipHeight < 10) {
          top = mouseY + 20; // Position below cursor instead
        }
      }
      
      setTooltipPosition({ top, left });
    }
  };

  // Determine value style based on data type
  const getValueStyle = (value: any): string => {
    if (value === null || value === undefined) {
      return "text-white/30 italic";
    }
    if (typeof value === "number") {
      return "text-tertiary font-mono text-right";
    }
    if (typeof value === "boolean") {
      return "text-primary text-center";
    }
    if (
      typeof value === "string" &&
      (/^\d{4}-\d{2}-\d{2}/.test(value) || // ISO date
        /^\d{2}\/\d{2}\/\d{4}/.test(value)) // US date
    ) {
      return "text-secondary";
    }
    return "";
  };

  // Format value for display
  const formatValue = (value: any) => {
    // First ensure the value is safe for JSON
    const safeValue = ensureSafeJSON(value);

    if (safeValue === null || safeValue === undefined) {
      return <span className="text-gray-400">null</span>;
    }

    // Handle objects and arrays
    if (typeof safeValue === "object") {
      try {
        return <span>{JSON.stringify(safeValue)}</span>;
      } catch (e) {
        return <span className="text-red-500">Error formatting value</span>;
      }
    }

    // Return the safe value
    return <span>{String(safeValue)}</span>;
  };

  // Get a display string for the tooltip
  const getValueString = (value: any): string => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2); // Pretty print for tooltip
      } catch (e) {
        return "Error formatting value";
      }
    }
    return String(value);
  };

  const valueStyle = getValueStyle(value);
  const valueString = getValueString(value);

  // Format JSON objects for tooltip display with proper indentation
  const getFormattedTooltipContent = () => {
    if (typeof value === "object" && value !== null) {
      try {
        return (
          <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-60 max-w-md">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      } catch (e) {
        return "Error formatting value";
      }
    }
    return valueString;
  };

  return (
    <div
      ref={cellRef}
      style={{
        width: width,
        minWidth: width,
      }}
      className={`p-2 text-xs border-b border-r border-white/10 ${valueStyle} truncate`}
      onMouseEnter={() => isTruncated && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onMouseMove={handleMouseMove}
    >
      {formatValue(value)}

      {/* Tooltip Portal - rendered directly in body to avoid virtualization issues */}
      {showTooltip && isTruncated && document.getElementById('tooltip-container') && 
        createPortal(
          <div
            ref={tooltipRef}
            className="bg-black border-primary p-2 rounded shadow-lg text-white text-xs"
            style={{
              position: 'fixed',
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              maxWidth: '400px',
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            {getFormattedTooltipContent()}
          </div>,
          document.getElementById('tooltip-container')!
        )
      }
    </div>
  );
};

export default TableCell;