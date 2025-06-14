
// /hooks/useMotherDuck.ts
import { useState, useCallback } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';

interface MotherDuckConnectionInfo {
  user?: string;
  organization?: string;
  version?: string;
}

export interface UseMotherDuckResult {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Database info
  databases: Array<{ name: string; shared: boolean }>;
  connectionInfo: MotherDuckConnectionInfo | null;
  
  // Actions
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshDatabases: () => Promise<void>;
  clearError: () => void;
  
  // Utilities
  getStoredToken: () => string | null;
  clearStoredToken: () => void;
}

const STORAGE_KEY = 'datakit-motherduck-token';

/**
 * Simple hook for MotherDuck operations
 * Wraps the store functions with additional utilities
 */
export const useMotherDuck = (): UseMotherDuckResult => {
  const {
    motherDuckConnected,
    motherDuckConnecting,
    motherDuckError,
    motherDuckDatabases,
    connectToMotherDuck,
    disconnectFromMotherDuck,
    refreshMotherDuckSchemas,
  } = useDuckDBStore();

  const [connectionInfo, setConnectionInfo] = useState<MotherDuckConnectionInfo | null>(null);

  // Get stored token from localStorage
  const getStoredToken = useCallback((): string | null => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[useMotherDuck] Failed to get stored token:', err);
      return null;
    }
  }, []);

  // Store token in localStorage
  const storeToken = useCallback((token: string): void => {
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch (err) {
      console.warn('[useMotherDuck] Failed to store token:', err);
    }
  }, []);

  // Clear stored token
  const clearStoredToken = useCallback((): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[useMotherDuck] Failed to clear stored token:', err);
    }
  }, []);

  // Connect with token storage
  const connect = useCallback(async (token: string): Promise<void> => {
    try {
      await connectToMotherDuck(token);
      
      // Store token on successful connection
      storeToken(token);
      
      // Try to get connection info (optional)
      try {
        // You could query for user info here if needed
        setConnectionInfo({
          user: 'Connected User', // Placeholder
          version: '1.0.0',
        });
      } catch (infoErr) {
        console.warn('[useMotherDuck] Failed to get connection info:', infoErr);
      }
      
    } catch (err) {
      // Don't store token on failed connection
      throw err;
    }
  }, [connectToMotherDuck, storeToken]);

  // Disconnect and clear stored data
  const disconnect = useCallback(async (): Promise<void> => {
    await disconnectFromMotherDuck();
    clearStoredToken();
    setConnectionInfo(null);
  }, [disconnectFromMotherDuck, clearStoredToken]);

  // Refresh all database schemas
  const refreshDatabases = useCallback(async (): Promise<void> => {
    if (!motherDuckConnected) {
      throw new Error('Not connected to MotherDuck');
    }

    try {
      // Refresh schemas for all databases
      await Promise.all(
        motherDuckDatabases.map(db => 
          refreshMotherDuckSchemas(db.name).catch(err => {
            console.warn(`[useMotherDuck] Failed to refresh ${db.name}:`, err);
          })
        )
      );
    } catch (err) {
      console.error('[useMotherDuck] Failed to refresh databases:', err);
      throw err;
    }
  }, [motherDuckConnected, motherDuckDatabases, refreshMotherDuckSchemas]);

  // Clear error from store
  const clearError = useCallback((): void => {
    // Reset error in store (you'd need to add this action to your store)
    useDuckDBStore.setState({ motherDuckError: null });
  }, []);

  return {
    // State
    isConnected: motherDuckConnected,
    isConnecting: motherDuckConnecting,
    error: motherDuckError,
    databases: motherDuckDatabases,
    connectionInfo,
    
    // Actions
    connect,
    disconnect,
    refreshDatabases,
    clearError,
    
    // Utilities
    getStoredToken,
    clearStoredToken,
  };
};

export default useMotherDuck;