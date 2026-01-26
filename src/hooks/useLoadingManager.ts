/**
 * useLoadingManager Hook
 * 
 * React hook for managing loading states with the LoadingManager
 * 
 * Requirements: 7.3
 */

import { useEffect, useState, useCallback } from 'react';
import { LoadingManager, LoaderConfig, LoadingState } from '@/lib/loadingManager';

export interface UseLoadingManagerOptions {
  id: string;
  config?: LoaderConfig;
}

export interface UseLoadingManagerReturn {
  isLoading: boolean;
  error: Error | null;
  startLoading: () => void;
  stopLoading: (error?: Error) => Promise<void>;
  clearError: () => void;
  state: LoadingState | null;
}

/**
 * Hook to manage loading state with minimum display time
 */
export function useLoadingManager(options: UseLoadingManagerOptions): UseLoadingManagerReturn {
  const { id, config } = options;
  
  const [state, setState] = useState<LoadingState | null>(() => 
    LoadingManager.getLoadingState(id)
  );

  // Register loader on mount
  useEffect(() => {
    if (config) {
      LoadingManager.registerLoader(id, config);
    }

    // Subscribe to state changes
    const unsubscribe = LoadingManager.subscribe(id, (newState) => {
      setState(newState);
    });

    // Get initial state
    const initialState = LoadingManager.getLoadingState(id);
    if (initialState) {
      setState(initialState);
    }

    return () => {
      unsubscribe();
      // Optionally unregister on unmount
      // LoadingManager.unregisterLoader(id);
    };
  }, [id, config]);

  const startLoading = useCallback(() => {
    LoadingManager.startLoading(id);
  }, [id]);

  const stopLoading = useCallback(async (error?: Error) => {
    await LoadingManager.stopLoading(id, error);
  }, [id]);

  const clearError = useCallback(() => {
    LoadingManager.clearError(id);
  }, [id]);

  return {
    isLoading: state?.isLoading || false,
    error: state?.error || null,
    startLoading,
    stopLoading,
    clearError,
    state,
  };
}

/**
 * Hook to track multiple loading states
 */
export function useMultipleLoadingStates(ids: string[]): {
  isAnyLoading: boolean;
  loadingStates: Map<string, LoadingState | null>;
} {
  const [loadingStates, setLoadingStates] = useState<Map<string, LoadingState | null>>(
    new Map(ids.map(id => [id, LoadingManager.getLoadingState(id)]))
  );

  useEffect(() => {
    const unsubscribers = ids.map(id => 
      LoadingManager.subscribe(id, (newState) => {
        setLoadingStates(prev => new Map(prev).set(id, newState));
      })
    );

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [ids]);

  const isAnyLoading = Array.from(loadingStates.values()).some(
    state => state?.isLoading
  );

  return {
    isAnyLoading,
    loadingStates,
  };
}
