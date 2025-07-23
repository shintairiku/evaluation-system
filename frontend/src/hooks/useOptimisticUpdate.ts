'use client';

import { useCallback, useState, useRef } from 'react';
import { toast } from 'sonner';

export interface OptimisticUpdateOptions<T> {
  // Immediate state update function
  optimisticUpdate: (currentState: T) => T;
  // Async operation to perform
  asyncOperation: () => Promise<T>;
  // Success message for toast
  successMessage?: string;
  // Error message for toast
  errorMessage?: string;
  // Rollback message for toast
  rollbackMessage?: string;
  // Custom error handler
  onError?: (error: Error, rollbackState: T) => void;
  // Custom success handler
  onSuccess?: (result: T) => void;
  // Enable/disable toast notifications
  enableToasts?: boolean;
}

export interface OptimisticUpdateReturn<T> {
  // Current state (with optimistic updates)
  state: T;
  // Whether an operation is in progress
  isPending: boolean;
  // Execute optimistic update
  execute: () => Promise<T>;
  // Manually rollback to previous state
  rollback: () => void;
  // Reset to initial state
  reset: (newState: T) => void;
}

/**
 * Hook for managing optimistic updates with automatic rollback on failure
 * Provides immediate UI feedback while API operations are in progress
 */
export function useOptimisticUpdate<T>(
  initialState: T,
  options: OptimisticUpdateOptions<T>
): OptimisticUpdateReturn<T> {
  const [state, setState] = useState<T>(initialState);
  const [isPending, setIsPending] = useState(false);
  const previousStateRef = useRef<T>(initialState);
  const currentOperationRef = useRef<Promise<T> | null>(null);

  const {
    optimisticUpdate,
    asyncOperation,
    successMessage = '操作が完了しました',
    errorMessage = '操作に失敗しました',
    rollbackMessage = '変更を元に戻しました',
    onError,
    onSuccess,
    enableToasts = true
  } = options;

  const rollback = useCallback(() => {
    setState(previousStateRef.current);
    if (enableToasts) {
      toast.info(rollbackMessage);
    }
  }, [rollbackMessage, enableToasts]);

  const reset = useCallback((newState: T) => {
    setState(newState);
    previousStateRef.current = newState;
    setIsPending(false);
    currentOperationRef.current = null;
  }, []);

  const execute = useCallback(async (): Promise<T> => {
    // Prevent concurrent operations
    if (currentOperationRef.current) {
      return currentOperationRef.current;
    }

    // Store current state for rollback
    previousStateRef.current = state;

    // Apply optimistic update immediately
    const optimisticState = optimisticUpdate(state);
    setState(optimisticState);
    setIsPending(true);

    // Create and store the operation promise
    const operationPromise = (async (): Promise<T> => {
      try {
        const result = await asyncOperation();
        
        // Update state with actual result
        setState(result);
        previousStateRef.current = result;
        
        if (enableToasts) {
          toast.success(successMessage);
        }
        
        onSuccess?.(result);
        return result;
      } catch (error) {
        // Rollback optimistic changes
        setState(previousStateRef.current);
        
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        if (enableToasts) {
          toast.error(errorMessage);
        }
        
        onError?.(errorObj, previousStateRef.current);
        throw error;
      } finally {
        setIsPending(false);
        currentOperationRef.current = null;
      }
    })();

    currentOperationRef.current = operationPromise;
    return operationPromise;
  }, [
    state,
    optimisticUpdate,
    asyncOperation,
    successMessage,
    errorMessage,
    onError,
    onSuccess,
    enableToasts
  ]);

  return {
    state,
    isPending,
    execute,
    rollback,
    reset
  };
}

/**
 * Simplified hook for optimistic updates with predefined state patterns
 */
export function useOptimisticList<T extends { id: string | number }>(
  initialItems: T[]
) {
  return {
    add: (item: T, asyncAdd: () => Promise<T>) => 
      useOptimisticUpdate(initialItems, {
        optimisticUpdate: (currentItems) => [...currentItems, item],
        asyncOperation: async () => {
          const result = await asyncAdd();
          return [...initialItems.filter(i => i.id !== item.id), result];
        },
        successMessage: 'アイテムが追加されました',
        errorMessage: 'アイテムの追加に失敗しました'
      }),
    
    remove: (id: string | number, asyncRemove: () => Promise<void>) =>
      useOptimisticUpdate(initialItems, {
        optimisticUpdate: (currentItems) => currentItems.filter(item => item.id !== id),
        asyncOperation: async () => {
          await asyncRemove();
          return initialItems.filter(item => item.id !== id);
        },
        successMessage: 'アイテムが削除されました',
        errorMessage: 'アイテムの削除に失敗しました'
      }),
    
    update: (id: string | number, updates: Partial<T>, asyncUpdate: () => Promise<T>) =>
      useOptimisticUpdate(initialItems, {
        optimisticUpdate: (currentItems) =>
          currentItems.map(item =>
            item.id === id ? { ...item, ...updates } : item
          ),
        asyncOperation: async () => {
          const result = await asyncUpdate();
          return initialItems.map(item => item.id === id ? result : item);
        },
        successMessage: 'アイテムが更新されました',
        errorMessage: 'アイテムの更新に失敗しました'
      })
  };
}

/**
 * Hook for optimistic form submissions with validation
 */
export function useOptimisticForm<TForm, TResult>(
  onSubmit: (data: TForm) => Promise<TResult>,
  options: {
    onOptimisticUpdate?: (data: TForm) => void;
    onSuccess?: (result: TResult) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
    errorMessage?: string;
    enableToasts?: boolean;
  } = {}
) {
  const [isOptimistic, setIsOptimistic] = useState(false);
  
  const {
    onOptimisticUpdate,
    onSuccess,
    onError,
    successMessage = 'フォームの送信が完了しました',
    errorMessage = 'フォームの送信に失敗しました',
    enableToasts = true
  } = options;

  const submitOptimistically = useCallback(async (data: TForm): Promise<TResult> => {
    setIsOptimistic(true);
    
    // Apply optimistic update immediately
    onOptimisticUpdate?.(data);
    
    try {
      const result = await onSubmit(data);
      
      if (enableToasts) {
        toast.success(successMessage);
      }
      
      onSuccess?.(result);
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      if (enableToasts) {
        toast.error(errorMessage);
      }
      
      onError?.(errorObj);
      throw error;
    } finally {
      setIsOptimistic(false);
    }
  }, [onSubmit, onOptimisticUpdate, onSuccess, onError, successMessage, errorMessage, enableToasts]);

  return {
    submitOptimistically,
    isOptimistic
  };
}