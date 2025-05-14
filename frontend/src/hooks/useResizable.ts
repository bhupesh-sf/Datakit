import { useState, useEffect, useCallback, RefObject } from 'react';

type Direction = 'horizontal' | 'vertical';

interface ResizeOptions {
  /** Direction of resizing: horizontal for width, vertical for height */
  direction: Direction;
  /** Initial size in pixels */
  initialSize?: number;
  /** Minimum size constraint in pixels */
  minSize?: number;
  /** Maximum size constraint in pixels */
  maxSize?: number;
  /** Optional localStorage key to persist size between sessions */
  storageKey?: string;
  /** Whether to persist relative (percentage) size instead of absolute pixels */
  useRelativeSize?: boolean;
  /** Optional parent element to calculate relative size against */
  parentRef?: RefObject<HTMLElement>;
}

/**
 * Custom hook for creating resizable elements
 */
export const useResizable = (
  ref: RefObject<HTMLElement>,
  options: ResizeOptions
) => {
  const {
    direction = 'vertical',
    initialSize = 300,
    minSize = 100,
    maxSize = 800,
    storageKey,
    useRelativeSize = false,
    parentRef
  } = options;
  
  // Try to get saved size from localStorage
  const savedSize = storageKey && localStorage.getItem(storageKey)
    ? parseFloat(localStorage.getItem(storageKey) || '0')
    : 0;
  
  // Use saved size or initial size
  const [size, setSize] = useState(savedSize || initialSize);
  const [isResizing, setIsResizing] = useState(false);
  
  // Start resizing
  const startResize = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = direction === 'vertical' ? 'row-resize' : 'col-resize';
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
  }, [direction]);
  
  // Stop resizing
  const stopResize = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Save size to localStorage if storageKey is provided
    if (storageKey && size) {
      localStorage.setItem(storageKey, size.toString());
    }
  }, [size, storageKey]);
  
  // Handle resize
  useEffect(() => {
    const handleResize = (event: MouseEvent) => {
      if (!isResizing || !ref.current) return;
      
      const rect = ref.current.getBoundingClientRect();
      const parentRect = parentRef?.current?.getBoundingClientRect();
      
      if (direction === 'vertical') {
        // Calculate new height
        const newHeight = event.clientY - rect.top;
        // Clamp the height between minSize and maxSize
        const clampedHeight = Math.max(minSize, Math.min(maxSize, newHeight));
        setSize(clampedHeight);
        
        // Apply new height
        ref.current.style.height = `${clampedHeight}px`;
        
        // Calculate and store relative size if needed
        if (useRelativeSize && parentRef?.current) {
          const relativeSize = clampedHeight / parentRect!.height;
          if (storageKey) {
            localStorage.setItem(`${storageKey}-relative`, relativeSize.toString());
          }
        }
      } else {
        // Calculate new width
        const newWidth = event.clientX - rect.left;
        // Clamp the width between minSize and maxSize
        const clampedWidth = Math.max(minSize, Math.min(maxSize, newWidth));
        setSize(clampedWidth);
        
        // Apply new width
        ref.current.style.width = `${clampedWidth}px`;
        
        // Calculate and store relative size if needed
        if (useRelativeSize && parentRef?.current) {
          const relativeSize = clampedWidth / parentRect!.width;
          if (storageKey) {
            localStorage.setItem(`${storageKey}-relative`, relativeSize.toString());
          }
        }
      }
    };
    
    // Add event listeners when resizing
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', stopResize);
    }
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, ref, direction, minSize, maxSize, stopResize, parentRef, useRelativeSize, storageKey]);
  
  // Set initial size on mount
  useEffect(() => {
    if (ref.current) {
      if (direction === 'vertical') {
        ref.current.style.height = `${size}px`;
      } else {
        ref.current.style.width = `${size}px`;
      }
    }
  }, [ref, size, direction]);
  
  // Update size when window is resized (for relative sizing)
  useEffect(() => {
    if (!useRelativeSize || !parentRef?.current || !storageKey) return;
    
    const handleWindowResize = () => {
      if (!ref.current || !parentRef.current) return;
      
      const relativeSize = localStorage.getItem(`${storageKey}-relative`);
      if (relativeSize) {
        const newSize = direction === 'vertical'
          ? parentRef.current.clientHeight * parseFloat(relativeSize)
          : parentRef.current.clientWidth * parseFloat(relativeSize);
        
        const clampedSize = Math.max(minSize, Math.min(maxSize, newSize));
        
        if (direction === 'vertical') {
          ref.current.style.height = `${clampedSize}px`;
        } else {
          ref.current.style.width = `${clampedSize}px`;
        }
        
        setSize(clampedSize);
      }
    };
    
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [ref, parentRef, direction, useRelativeSize, storageKey, minSize, maxSize]);
  
  return {
    size,
    isResizing,
    startResize,
    stopResize
  };
};