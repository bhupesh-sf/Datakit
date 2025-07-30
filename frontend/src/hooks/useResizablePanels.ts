import { useState, useCallback, useEffect, useRef } from 'react';

interface PanelConfig {
  storageKey: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

interface UseResizablePanelsOptions {
  leftPanel?: PanelConfig;
  rightPanel?: PanelConfig;
}

export const useResizablePanels = (options: UseResizablePanelsOptions) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Left panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (!options.leftPanel) return 0;
    const saved = localStorage.getItem(options.leftPanel.storageKey);
    return saved ? parseInt(saved, 10) : options.leftPanel.defaultWidth;
  });
  
  // Right panel state
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (!options.rightPanel) return 0;
    const saved = localStorage.getItem(options.rightPanel.storageKey);
    return saved ? parseInt(saved, 10) : options.rightPanel.defaultWidth;
  });
  
  // Resizing states
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  
  // Left panel resize handlers
  const handleLeftPanelResize = useCallback((e: MouseEvent) => {
    if (!options.leftPanel) return;
    
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(
        Math.max(
          e.clientX - containerRect.left, 
          options.leftPanel?.minWidth || 50
        ),
        options.leftPanel?.maxWidth || 400
      );

      setLeftPanelWidth(newWidth);
    });
  }, [options.leftPanel]);

  const startLeftPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const stopLeftPanelResize = useCallback(() => {
    if (isResizingLeft && options.leftPanel) {
      setIsResizingLeft(false);
      localStorage.setItem(options.leftPanel.storageKey, leftPanelWidth.toString());
    }
  }, [isResizingLeft, leftPanelWidth, options.leftPanel]);

  // Right panel resize handlers
  const handleRightPanelResize = useCallback((e: MouseEvent) => {
    if (!options.rightPanel) return;
    
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(
        Math.max(
          containerRect.right - e.clientX, 
          options.rightPanel?.minWidth || 50
        ),
        options.rightPanel?.maxWidth || 400
      );

      setRightPanelWidth(newWidth);
    });
  }, [options.rightPanel]);

  const startRightPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  const stopRightPanelResize = useCallback(() => {
    if (isResizingRight && options.rightPanel) {
      setIsResizingRight(false);
      localStorage.setItem(options.rightPanel.storageKey, rightPanelWidth.toString());
    }
  }, [isResizingRight, rightPanelWidth, options.rightPanel]);

  // Mouse event handlers
  useEffect(() => {
    if (isResizingLeft) {
      document.addEventListener('mousemove', handleLeftPanelResize);
      document.addEventListener('mouseup', stopLeftPanelResize);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleLeftPanelResize);
        document.removeEventListener('mouseup', stopLeftPanelResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizingLeft, handleLeftPanelResize, stopLeftPanelResize]);

  useEffect(() => {
    if (isResizingRight) {
      document.addEventListener('mousemove', handleRightPanelResize);
      document.addEventListener('mouseup', stopRightPanelResize);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleRightPanelResize);
        document.removeEventListener('mouseup', stopRightPanelResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizingRight, handleRightPanelResize, stopRightPanelResize]);

  return {
    containerRef,
    
    // Left panel
    leftPanelWidth,
    isResizingLeft,
    startLeftPanelResize,
    
    // Right panel
    rightPanelWidth,
    isResizingRight,
    startRightPanelResize,
  };
};