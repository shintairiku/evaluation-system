import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Simplified async operation hook
 * Focuses on core functionality without overengineering
 */

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsyncOperation<T = unknown>(
  asyncFunction: (...args: unknown[]) => Promise<T>
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const cancelRef = useRef<boolean>(false);

  const execute = useCallback(async (...args: unknown[]): Promise<T | undefined> => {
    cancelRef.current = false;

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const result = await asyncFunction(...args);

      if (!cancelRef.current) {
        setState({
          data: result,
          loading: false,
          error: null,
        });
      }

      return result;
    } catch (error) {
      if (!cancelRef.current) {
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        });
      }
      throw error;
    }
  }, [asyncFunction]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setState(prev => ({
      ...prev,
      loading: false,
    }));
  }, []);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  return {
    ...state,
    execute,
    reset,
    cancel,
  };
}