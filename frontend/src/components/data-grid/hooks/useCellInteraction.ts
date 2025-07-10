import { useState, useCallback } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

export interface CellContextState {
  isOpen: boolean;
  position: { x: number; y: number };
  rowIndex: number;
  columnIndex: number;
  cellValue: string;
  isHeader: boolean;
}

export const useCellInteraction = () => {
  const { showSuccess } = useNotifications();
  const [contextMenu, setContextMenu] = useState<CellContextState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    rowIndex: -1,
    columnIndex: -1,
    cellValue: '',
    isHeader: false,
  });

  const handleCellClick = useCallback((
    event: React.MouseEvent,
    rowIndex: number,
    columnIndex: number,
    cellValue: string
  ) => {
    event.preventDefault();
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const isHeader = rowIndex === 0;
    
    setContextMenu({
      isOpen: true,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
      rowIndex,
      columnIndex,
      cellValue,
      isHeader,
    });
  }, []);

  const handleCopyCell = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(contextMenu.cellValue);
      showSuccess(
        'Copied to clipboard',
        `"${contextMenu.cellValue.length > 20 ? contextMenu.cellValue.substring(0, 20) + '...' : contextMenu.cellValue}" copied successfully`,
        { duration: 2000 }
      );
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = contextMenu.cellValue;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      showSuccess(
        'Copied to clipboard',
        'Cell value copied successfully',
        { duration: 2000 }
      );
    }
  }, [contextMenu.cellValue, showSuccess]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return {
    contextMenu,
    handleCellClick,
    handleCopyCell,
    closeContextMenu,
  };
};