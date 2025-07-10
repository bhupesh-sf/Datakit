import { useState, useCallback } from 'react';

import { EditingState } from '@/types/grid';

export const useGridEditing = (
  data: string[][],
  onDataUpdate?: (newData: string[][]) => void
) => {
  const [editingState, setEditingState] = useState<EditingState>({
    cell: null,
    value: ''
  });

  const handleCellClick = useCallback((row: number, col: number) => {
    // Disable all editing - cells are now read-only
    return;
  }, []);

  const handleCellEdit = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingState(prev => ({
      ...prev,
      value: e.target.value
    }));
  }, []);

  const handleCellBlur = useCallback(() => {
    if (editingState.cell && data[editingState.cell.row]) {
      const newData = [...data];
      newData[editingState.cell.row][editingState.cell.col] = editingState.value;
      
      if (onDataUpdate) {
        onDataUpdate(newData);
      }
      
      setEditingState({ cell: null, value: '' });
    }
  }, [editingState, data, onDataUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCellBlur();
    } else if (e.key === "Escape") {
      setEditingState({ cell: null, value: '' });
    }
  }, [handleCellBlur]);

  return {
    editingCell: editingState.cell,
    editValue: editingState.value,
    handleCellClick,
    handleCellEdit,
    handleCellBlur,
    handleKeyDown
  };
};