import { useState, useEffect, useCallback, RefObject } from 'react';

interface ResizeOptions {
  direction: 'horizontal' | 'vertical';
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  storageKey?: string;
}

/**
 * Hook for creating resizable panels
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
    storageKey
  } = options;
  
  // Try to get saved size from localStorage
  const savedSize = storageKey 
    ? parseInt(localStorage.getItem(storageKey) || '0', 10) 
    : 0;
  
  // Use saved size or initial size
  const [size, setSize] = useState(savedSize || initialSize);
  const [isResizing, setIsResizing] = useState(false);
  
  // Start resizing
  const startResize = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
  }, []);
  
  // Stop resizing
  const stopResize = useCallback(() => {
    setIsResizing(false);
    
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
      
      if (direction === 'vertical') {
        // Calculate new height
        const newHeight = event.clientY - rect.top;
        // Clamp the height between minSize and maxSize
        const clampedHeight = Math.max(minSize, Math.min(maxSize, newHeight));
        setSize(clampedHeight);
        
        // Apply new height
        ref.current.style.height = `${clampedHeight}px`;
      } else {
        // Calculate new width
        const newWidth = event.clientX - rect.left;
        // Clamp the width between minSize and maxSize
        const clampedWidth = Math.max(minSize, Math.min(maxSize, newWidth));
        setSize(clampedWidth);
        
        // Apply new width
        ref.current.style.width = `${clampedWidth}px`;
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
  }, [isResizing, ref, direction, minSize, maxSize, stopResize]);
  
  // Set initial size
  useEffect(() => {
    if (ref.current) {
      if (direction === 'vertical') {
        ref.current.style.height = `${size}px`;
      } else {
        ref.current.style.width = `${size}px`;
      }
    }
  }, [ref, size, direction]);
  
  return {
    size,
    isResizing,
    startResize,
    stopResize
  };
};