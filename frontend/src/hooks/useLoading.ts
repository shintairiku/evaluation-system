'use client';

import { useCallback, useEffect } from 'react';
import { useLoadingContext } from '../context/LoadingContext';

export interface UseLoadingOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface UseLoadingReturn {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  withLoading: <T>(
    asyncOperation: () => Promise<T>,
    options?: UseLoadingOptions
  ) => Promise<T>;
  startLoading: () => void;
  stopLoading: () => void;
}

/**
 * Hook for managing component-level loading states
 * Automatically registers with global loading context
 */
export function useLoading(key: string): UseLoadingReturn {
  const { setLoading: setGlobalLoading, isLoading: isGlobalLoading } = useLoadingContext();

  const isLoading = isGlobalLoading(key);

  const setLoading = useCallback(
    (loading: boolean) => {
      setGlobalLoading(key, loading);
    },
    [key, setGlobalLoading]
  );

  const startLoading = useCallback(() => {
    setLoading(true);
  }, [setLoading]);

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, [setLoading]);

  const withLoading = useCallback(
    async <T>(
      asyncOperation: () => Promise<T>,
      options: UseLoadingOptions = {}
    ): Promise<T> => {
      try {
        setLoading(true);
        options.onStart?.();
        
        const result = await asyncOperation();
        
        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        options.onError?.(errorObj);
        throw error;
      } finally {
        setLoading(false);
        options.onEnd?.();
      }
    },
    [setLoading]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, [setLoading]);

  return {
    isLoading,
    setLoading,
    withLoading,
    startLoading,
    stopLoading,
  };
}

/**
 * Hook for checking global loading state
 */
export function useGlobalLoading() {
  const { isAnyLoading, loadingStates, clearAllLoading } = useLoadingContext();

  return {
    isAnyLoading,
    loadingStates,
    clearAllLoading,
    activeLoadingKeys: Object.keys(loadingStates),
  };
}

/**
 * Hook for managing multiple loading states with a single key prefix
 */
export function useMultipleLoading(keyPrefix: string) {
  const { setLoading: setGlobalLoading, isLoading: isGlobalLoading } = useLoadingContext();

  const setLoading = useCallback(
    (subKey: string, loading: boolean) => {
      const fullKey = `${keyPrefix}.${subKey}`;
      setGlobalLoading(fullKey, loading);
    },
    [keyPrefix, setGlobalLoading]
  );

  const isLoading = useCallback(
    (subKey: string) => {
      const fullKey = `${keyPrefix}.${subKey}`;
      return isGlobalLoading(fullKey);
    },
    [keyPrefix, isGlobalLoading]
  );

  const isAnySubLoading = useCallback(() => {
    // Check if any key starting with our prefix is loading
    const context = useLoadingContext();
    return Object.keys(context.loadingStates).some(key => 
      key.startsWith(`${keyPrefix}.`)
    );
  }, [keyPrefix]);

  const withLoading = useCallback(
    async <T>(
      subKey: string,
      asyncOperation: () => Promise<T>,
      options: UseLoadingOptions = {}
    ): Promise<T> => {
      try {
        setLoading(subKey, true);
        options.onStart?.();
        
        const result = await asyncOperation();
        
        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        options.onError?.(errorObj);
        throw error;
      } finally {
        setLoading(subKey, false);
        options.onEnd?.();
      }
    },
    [setLoading]
  );

  return {
    setLoading,
    isLoading,
    isAnySubLoading,
    withLoading,
  };
}