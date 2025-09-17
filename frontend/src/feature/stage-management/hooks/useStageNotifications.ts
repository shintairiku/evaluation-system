'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for managing toast notifications and error callbacks
 * Centralizes notification logic to reduce code duplication and ensure consistency
 * 
 * @param onError - Callback function to handle error states
 * @param onClearError - Callback function to clear error states
 * @returns Object containing notification functions
 */
export function useStageNotifications(
  onError: (error: string) => void,
  onClearError: () => void
) {
  // Display success toast and clear any existing errors
  const showSuccess = useCallback((message: string) => {
    toast.success(message);
    onClearError();
  }, [onClearError]);

  // Display error toast and trigger error callback
  const showError = useCallback((error: string | Error | unknown, fallbackMessage?: string) => {
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : fallbackMessage || 'An unexpected error occurred';
    
    toast.error(errorMessage);
    onError(errorMessage);
  }, [onError]);

  // Handle server action results with appropriate notifications
  const handleServerActionResult = useCallback(
    <T>(result: { success: boolean; error?: string; data?: T }, successMessage: string) => {
      if (result.success) {
        showSuccess(successMessage);
        return { success: true, data: result.data };
      } else {
        showError(result.error || 'An error occurred');
        return { success: false, error: result.error };
      }
    },
    [showSuccess, showError]
  );

  return {
    showSuccess,
    showError, 
    handleServerActionResult
  };
}