import { useState, useEffect, useMemo, useRef, useCallback } from "react";

export type GridData = string[][];

export interface Cell {
  row: number;
  col: number;
}

export interface AnimationPosition {
  row: number;
  col: number;
}

export interface GridEditingHookResult {
  editCell: Cell | null;
  editValue: string;
  handleCellClick: (row: number, col: number) => void;
  handleCellEdit: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCellBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export interface WelcomeAnimationHookResult {
  activeWordIndex: number;
  animationMessage: string[];
  animationActive: boolean;
}

/**
 * Custom hook to generate an empty grid
 *
 * @returns A 2D array representing an empty grid with headers
 */
export const useEmptyGrid = (): GridData => {
  return useMemo(() => {
    const headers = [
      " ",
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
    ];
    const rows: GridData = [headers];

    for (let i = 1; i <= 25; i++) {
      const row: string[] = [i.toString()];
      for (let j = 1; j < headers.length; j++) {
        row.push("");
      }
      rows.push(row);
    }

    return rows;
  }, []);
};

/**
 * Custom hook to handle cell editing functionality
 *
 * @param gridData Current grid data
 * @param setGridData Function to update grid data
 * @returns Object containing editing state and handlers
 */
export const useGridEditing = (
  gridData: GridData,
  setGridData: React.Dispatch<React.SetStateAction<GridData>>
): GridEditingHookResult => {
  const [editCell, setEditCell] = useState<Cell | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const handleCellClick = useCallback(
    (row: number, col: number): void => {
      // Don't allow editing header row or row number column
      if (row === 0 || col === 0) return;

      setEditCell({ row, col });
      setEditValue(gridData[row][col]);
    },
    [gridData]
  );

  const handleCellEdit = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setEditValue(e.target.value);
    },
    []
  );

  const handleCellBlur = useCallback((): void => {
    if (editCell) {
      const newGrid: GridData = [...gridData];
      newGrid[editCell.row][editCell.col] = editValue;
      setGridData(newGrid);
      setEditCell(null);
    }
  }, [editCell, editValue, gridData, setGridData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === "Enter") {
        handleCellBlur();
      } else if (e.key === "Escape") {
        setEditCell(null);
      }
    },
    [handleCellBlur]
  );

  return {
    editCell,
    editValue,
    handleCellClick,
    handleCellEdit,
    handleCellBlur,
    handleKeyDown,
  };
};

/**
 * Custom hook for welcome animation
 *
 * @param emptyGrid - The empty grid to use as a base for animation
 * @param setGridData - Function to update grid data
 * @param hasData - Whether we have data to display (true prevents animation)
 * @returns Object containing animation state and configuration
 */
export const useWelcomeAnimation = (
  emptyGrid: GridData,
  setGridData: React.Dispatch<React.SetStateAction<GridData>>,
  hasData: boolean
): WelcomeAnimationHookResult => {
  // Animation configuration
  const animationMessage: string[] = [
    "Your",
    "Datakit",
    "is",
    "here,",
    "upload",
    "a",
    "file.",
  ];
  const animationPositions: AnimationPosition[] = [
    { row: 8, col: 3 }, // "Your"
    { row: 8, col: 4 }, // "Datakit"
    { row: 8, col: 5 }, // "is"
    { row: 8, col: 6 }, // "here,"
    { row: 8, col: 7 }, // "upload"
    { row: 8, col: 8 }, // "a"
    { row: 8, col: 9 }, // "file."
  ];

  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [animationActive, setAnimationActive] = useState<boolean>(false);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track if this is the first render
  const isFirstRender = useRef(true);

  // Start or stop animation based on data state
  useEffect(() => {
    // If we have data, always disable animation regardless of previous state
    if (hasData) {
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      setAnimationActive(false);
      setActiveWordIndex(-1);
      return;
    }

    // If we don't have data and animation is not running, start it
    // But only if this isn't the first render or we've explicitly marked it inactive
    if (!hasData && (!animationActive || !isFirstRender.current)) {
      setAnimationActive(true);
      startAnimation();
    }

    // Mark first render complete
    isFirstRender.current = false;

    return () => {
      // Cleanup on unmount
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [hasData, animationActive]);

  // Function to start the animation
  const startAnimation = useCallback((): void => {
    // Reset state
    setActiveWordIndex(-1);

    // Clear existing timer
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    // Short delay before starting
    setTimeout(() => {
      // Only start if we still should show animation
      if (hasData) return;

      // Start with a fresh grid
      const initialGrid: GridData = JSON.parse(JSON.stringify(emptyGrid));
      setGridData(initialGrid);

      // Use smoother timing between words
      animationTimerRef.current = setInterval(() => {
        setActiveWordIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= animationMessage.length) {
            if (animationTimerRef.current) {
              clearInterval(animationTimerRef.current);
              animationTimerRef.current = null;
            }
            return prevIndex;
          }
          return nextIndex;
        });
      }, 500); // Slightly faster timing for smoother flow
    }, 100); // Shorter initial delay
  }, [emptyGrid, setGridData, animationMessage.length, hasData]);

  // Effect to update grid with animation words
  useEffect(() => {
    // Skip if we have data or no active word
    if (hasData || activeWordIndex < 0) return;

    // Create a deep copy of the grid to avoid reference issues
    const newGrid: GridData = JSON.parse(JSON.stringify(emptyGrid));

    // Add words up to current index
    for (let i = 0; i <= activeWordIndex; i++) {
      if (i < animationPositions.length) {
        const { row, col } = animationPositions[i];
        newGrid[row][col] = animationMessage[i];
      }
    }

    setGridData(newGrid);
  }, [activeWordIndex, hasData]);

  return {
    activeWordIndex,
    animationMessage,
    animationActive,
  };
};
