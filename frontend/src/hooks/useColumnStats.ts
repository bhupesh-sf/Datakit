import { useEffect, useState, useRef } from 'react';
import { useInspectorStore, ColumnMetrics } from '@/store/inspectorStore';
import { useAppStore } from '@/store/appStore';

interface UseColumnStatsOptions {
  fileId?: string;
  enabled?: boolean;
  fileSizeThresholdMB?: number;
  manualTrigger?: boolean; // New option to disable auto-loading
}

interface UseColumnStatsResult {
  columnStats: ColumnMetrics[];
  isLoading: boolean;
  error: string | null;
  shouldLoadStats: boolean;
  triggerAnalysis: () => void; // New function to manually trigger analysis
}

export const useColumnStats = ({
  fileId,
  enabled = true,
  fileSizeThresholdMB = 300,
  manualTrigger = false,
}: UseColumnStatsOptions = {}): UseColumnStatsResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldLoadStats, setShouldLoadStats] = useState(false);
  const loadingRef = useRef(false);
  
  const { 
    analyzeFile, 
    results, 
    activeFileId,
    isAnalyzing,
    error: inspectorError 
  } = useInspectorStore();
  
  const file = fileId 
    ? useAppStore.getState().files.find(f => f.id === fileId)
    : useAppStore.getState().files.find(f => f.id === activeFileId);

  // Get current results
  const currentFileId = fileId || activeFileId;
  const currentResults = currentFileId ? results.get(currentFileId) : null;
  const columnStats = currentResults?.columnMetrics || [];
  
  // Manual trigger function
  const triggerAnalysis = async () => {
    if (!file || !currentFileId || loadingRef.current || isAnalyzing) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useColumnStats] Manual analysis triggered for:', file.fileName);
      
      const tableName = file.tableName;
      if (!tableName) {
        throw new Error('Table name not found for file');
      }

      await analyzeFile(currentFileId, tableName);
      
      console.log('[useColumnStats] Manual analysis completed successfully');
    } catch (err) {
      console.error('[useColumnStats] Manual analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load column statistics');
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Reset state when file changes
    setError(null);
    setShouldLoadStats(false);
    
    if (!enabled || !file || !currentFileId) {
      return;
    }

    // Skip stats for remote sources
    if (file.isRemote) {
      console.log('[useColumnStats] Skipping stats for remote source:', file.remoteProvider);
      setShouldLoadStats(false);
      return;
    }

    // Check file size threshold
    const fileSizeMB = file.fileSize ? file.fileSize / (1024 * 1024) : 0;
    if (fileSizeMB > fileSizeThresholdMB) {
      console.log(`[useColumnStats] File too large for auto-stats: ${fileSizeMB.toFixed(2)}MB > ${fileSizeThresholdMB}MB`);
      setShouldLoadStats(false);
      return;
    }

    setShouldLoadStats(true);

    // Skip automatic loading if in manual trigger mode
    if (manualTrigger) {
      console.log('[useColumnStats] Manual trigger mode - skipping auto-analysis');
      return;
    }

    // Check if we already have results
    if (currentResults) {
      console.log('[useColumnStats] Using cached results for:', currentFileId);
      return;
    }

    // Prevent duplicate analysis
    if (loadingRef.current || isAnalyzing) {
      console.log('[useColumnStats] Analysis already in progress');
      return;
    }

    // Start analysis
    const loadStats = async () => {
      loadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        console.log('[useColumnStats] Starting analysis for:', file.fileName, `(${fileSizeMB.toFixed(2)}MB)`);
        
        const tableName = file.tableName;
        if (!tableName) {
          throw new Error('Table name not found for file');
        }

        await analyzeFile(currentFileId, tableName);
        
        console.log('[useColumnStats] Analysis completed successfully');
      } catch (err) {
        console.error('[useColumnStats] Analysis failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load column statistics');
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    };

    // Add a small delay to avoid immediate analysis on mount
    const timeoutId = setTimeout(() => {
      loadStats();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentFileId, file, enabled, fileSizeThresholdMB, manualTrigger, analyzeFile, currentResults, isAnalyzing]);

  // Update loading state based on inspector store
  useEffect(() => {
    if (isAnalyzing && currentFileId === activeFileId) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [isAnalyzing, currentFileId, activeFileId]);

  // Update error state based on inspector store
  useEffect(() => {
    if (inspectorError) {
      setError(inspectorError);
    }
  }, [inspectorError]);

  return {
    columnStats,
    isLoading: isLoading || isAnalyzing,
    error,
    shouldLoadStats,
    triggerAnalysis,
  };
};