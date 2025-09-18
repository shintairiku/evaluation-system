import { useState, useCallback, useRef, useEffect } from 'react';

export interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  completed: boolean;
}

export interface AsyncOperationOptions<T = unknown> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface AsyncOperationResult<T> {
  state: AsyncOperationState<T>;
  execute: (...args: any[]) => Promise<T | undefined>;
  retry: () => Promise<T | undefined>;
  reset: () => void;
  cancel: () => void;
}

/**
 * Hook for managing async operations with loading states, error handling, and retry logic
 */
export function useAsyncOperation<T = unknown>(
  asyncFunction: (...args: unknown[]) => Promise<T>,
  options: AsyncOperationOptions<T> = {}
): AsyncOperationResult<T> {
  const {
    onSuccess,
    onError,
    retryAttempts = 3,
    retryDelay = 1000
  } = options;

  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
    completed: false,
  });

  const lastArgsRef = useRef<any[]>([]);
  const cancelRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);

  // Reset the operation state
  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      completed: false,
    });
    retryCountRef.current = 0;
    cancelRef.current = false;
  }, []);

  // Cancel the operation
  const cancel = useCallback(() => {
    cancelRef.current = true;
    setState(prev => ({
      ...prev,
      loading: false,
    }));
  }, []);

  // Execute the async operation with retry logic
  const executeWithRetry = useCallback(async (
    args: any[],
    attempt: number = 0
  ): Promise<T | undefined> => {
    if (cancelRef.current) {
      return undefined;
    }

    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      const result = await asyncFunction(...args);

      if (cancelRef.current) {
        return undefined;
      }

      setState({
        data: result,
        loading: false,
        error: null,
        completed: true,
      });

      retryCountRef.current = 0;
      onSuccess?.(result);
      return result;

    } catch (error) {
      if (cancelRef.current) {
        return undefined;
      }

      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

      // Check if we should retry
      if (attempt < retryAttempts && isRetryableError(error)) {
        retryCountRef.current = attempt + 1;

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));

        if (!cancelRef.current) {
          return executeWithRetry(args, attempt + 1);
        }
      }

      // All retries exhausted or non-retryable error
      setState({
        data: null,
        loading: false,
        error: errorMessage,
        completed: true,
      });

      onError?.(errorMessage);
      throw error;
    }
  }, [asyncFunction, onSuccess, onError, retryAttempts, retryDelay]);

  // Main execute function
  const execute = useCallback(async (...args: any[]): Promise<T | undefined> => {
    lastArgsRef.current = args;
    cancelRef.current = false;
    retryCountRef.current = 0;

    return executeWithRetry(args);
  }, [executeWithRetry]);

  // Retry with the last used arguments
  const retry = useCallback(async (): Promise<T | undefined> => {
    if (lastArgsRef.current.length === 0) {
      throw new Error('No previous execution to retry');
    }

    return execute(...lastArgsRef.current);
  }, [execute]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  return {
    state,
    execute,
    retry,
    reset,
    cancel,
  };
}

/**
 * Determine if an error should trigger a retry
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('fetch')) {
      return true;
    }

    // Server errors (5xx)
    if (message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')) {
      return true;
    }

    // Rate limiting
    if (message.includes('429') || message.includes('rate limit')) {
      return true;
    }
  }

  return false;
}

/**
 * Hook for managing multiple async operations
 */
export function useAsyncOperations<T extends Record<string, any>>(
  operations: { [K in keyof T]: (...args: any[]) => Promise<T[K]> },
  options: AsyncOperationOptions = {}
) {
  const operationHooks = Object.fromEntries(
    Object.entries(operations).map(([key, fn]) => [
      key,
      useAsyncOperation(fn as any, options)
    ])
  ) as { [K in keyof T]: AsyncOperationResult<T[K]> };

  const reset = useCallback(() => {
    Object.values(operationHooks).forEach(hook => (hook as any).reset());
  }, [operationHooks]);

  const cancel = useCallback(() => {
    Object.values(operationHooks).forEach(hook => (hook as any).cancel());
  }, [operationHooks]);

  const isAnyLoading = Object.values(operationHooks).some(
    hook => (hook as any).state.loading
  );

  const hasAnyError = Object.values(operationHooks).some(
    hook => (hook as any).state.error
  );

  return {
    operations: operationHooks,
    reset,
    cancel,
    isAnyLoading,
    hasAnyError,
  };
}

/**
 * Hook for form submission with loading states
 */
export function useFormSubmission<T = any>(
  submitFunction: (formData: any) => Promise<T>,
  options: AsyncOperationOptions & {
    resetOnSuccess?: boolean;
  } = {}
) {
  const { resetOnSuccess = false, ...asyncOptions } = options;

  const asyncOp = useAsyncOperation(submitFunction, {
    ...asyncOptions,
    onSuccess: (data) => {
      if (resetOnSuccess) {
        // Reset form state after successful submission
        setTimeout(() => asyncOp.reset(), 100);
      }
      options.onSuccess?.(data);
    },
  });

  const handleSubmit = useCallback(async (formData: any) => {
    try {
      return await asyncOp.execute(formData);
    } catch (error) {
      // Error is already handled by the async operation
      return undefined;
    }
  }, [asyncOp]);

  return {
    ...asyncOp,
    handleSubmit,
    isSubmitting: asyncOp.state.loading,
    submitError: asyncOp.state.error,
    isSubmitted: asyncOp.state.completed && !asyncOp.state.error,
  };
}