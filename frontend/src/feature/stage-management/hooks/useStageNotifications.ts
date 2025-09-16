'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook customizado para gerenciar notificações toast e error callbacks
 * Centraliza a lógica de notificação para evitar duplicação
 */
export function useStageNotifications(
  onError: (error: string) => void,
  onClearError: () => void
) {
  // Exibe toast de sucesso e limpa erros
  const showSuccess = useCallback((message: string) => {
    toast.success(message);
    onClearError();
  }, [onClearError]);

  // Exibe toast de erro e chama callback de erro
  const showError = useCallback((error: string | Error | unknown, fallbackMessage?: string) => {
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : fallbackMessage || '予期しないエラーが発生しました';
    
    toast.error(errorMessage);
    onError(errorMessage);
  }, [onError]);

  // Trata resultado de server action
  const handleServerActionResult = useCallback(
    <T>(result: { success: boolean; error?: string; data?: T }, successMessage: string) => {
      if (result.success) {
        showSuccess(successMessage);
        return { success: true, data: result.data };
      } else {
        showError(result.error || 'エラーが発生しました');
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