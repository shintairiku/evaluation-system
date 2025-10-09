import { useState, useCallback } from 'react';
import { submitGoalAction } from '@/api/server-actions/goals';
import { useRouter } from 'next/navigation';
import type { UUID } from '@/api/types';

/**
 * Return type for the useGoalResubmit hook
 */
export interface UseGoalResubmitReturn {
  /** Function to resubmit a goal */
  resubmit: (goalId: UUID) => Promise<void>;
  /** Loading state during resubmission */
  isResubmitting: boolean;
  /** Error message if resubmission fails */
  error: string | null;
}

/**
 * Custom hook to handle goal resubmission logic.
 *
 * Features:
 * - Calls submitGoalAction to change status from draft/rejected to submitted
 * - Handles loading and error states
 * - Redirects to goal list page on success
 * - Can be used with toast notifications (if available)
 *
 * Workflow:
 * 1. User edits rejected goal
 * 2. User clicks "再提出" button
 * 3. This hook calls submitGoalAction(goalId, 'submitted')
 * 4. On success, redirects to /goal-list
 * 5. On error, displays error message
 *
 * @returns Object containing resubmit function and state
 *
 * @example
 * ```tsx
 * const { resubmit, isResubmitting, error } = useGoalResubmit();
 *
 * <Button onClick={() => resubmit(goalId)} disabled={isResubmitting}>
 *   {isResubmitting ? '提出中...' : '再提出'}
 * </Button>
 * ```
 */
export function useGoalResubmit(): UseGoalResubmitReturn {
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const resubmit = useCallback(async (goalId: UUID) => {
    try {
      setIsResubmitting(true);
      setError(null);

      // Call submit action to change status to 'submitted'
      const result = await submitGoalAction(goalId, 'submitted');

      if (result.success) {
        // Success - redirect to goal list
        // TODO: Add toast notification if toast system is available
        // toast.success('目標を再提出しました');
        router.push('/(evaluation)/(employee)/goal-list');
      } else {
        setError(result.error || '目標の再提出に失敗しました');
      }
    } catch (err) {
      console.error('Error resubmitting goal:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsResubmitting(false);
    }
  }, [router]);

  return {
    resubmit,
    isResubmitting,
    error,
  };
}
