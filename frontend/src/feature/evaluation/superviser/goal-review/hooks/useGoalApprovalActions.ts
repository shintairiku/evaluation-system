import { useState, useCallback, startTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { type GoalResponse, SupervisorAction, SubmissionStatus } from '@/api/types';
import { updateSupervisorReviewAction } from '@/api/server-actions/supervisor-reviews';
import { useGoalReviewContext } from '@/context/GoalReviewContext';

/**
 * Type for optimistic UI updates
 */
type OptimisticGoalUpdate = {
  status: 'approved' | 'rejected' | 'submitted';
  approvedAt?: string;
  rejectedAt?: string;
};

/**
 * Confirmation dialog state
 */
interface ConfirmationDialogState {
  open: boolean;
  type: 'approve' | 'reject';
  comment?: string;
}

/**
 * Options for useGoalApprovalActions hook
 */
interface UseGoalApprovalActionsOptions {
  /** The goal being approved/rejected */
  goal: GoalResponse;
  /** Supervisor review ID (required for approval actions) */
  reviewId?: string;
  /** Callback called after successful action */
  onSuccess?: () => void;
}

/**
 * Return type for useGoalApprovalActions hook
 */
interface UseGoalApprovalActionsReturn {
  /** Optimistically updated goal */
  optimisticGoal: GoalResponse;
  /** Whether an action is being processed */
  isProcessing: boolean;
  /** Confirmation dialog state */
  confirmationDialog: ConfirmationDialogState;
  /** Open confirmation dialog for approve */
  handleApprove: (comment: string) => void;
  /** Open confirmation dialog for reject */
  handleReject: (comment: string) => void;
  /** Confirm and execute the pending action */
  confirmAction: () => Promise<void>;
  /** Close confirmation dialog */
  closeDialog: () => void;
}

/**
 * Success messages for approval/rejection actions
 */
const SUCCESS_MESSAGES = {
  approve: {
    title: '目標を承認しました',
    description: (title: string) => `${title}を承認しました。`
  },
  reject: {
    title: '目標を差し戻しました',
    description: (title: string) => `${title}を差し戻しました。`
  }
} as const;

/**
 * Custom hook to handle goal approval and rejection actions with optimistic updates.
 *
 * Features:
 * - Optimistic UI updates
 * - Confirmation dialog management
 * - Success/error toast notifications
 * - Automatic pending count refresh
 * - Error rollback
 *
 * @param options - Configuration options
 * @returns Object containing action handlers and state
 *
 * @example
 * ```tsx
 * const {
 *   optimisticGoal,
 *   isProcessing,
 *   confirmationDialog,
 *   handleApprove,
 *   handleReject,
 *   confirmAction,
 *   closeDialog
 * } = useGoalApprovalActions({
 *   goal,
 *   reviewId,
 *   onSuccess: () => console.log('Success!')
 * });
 * ```
 */
export function useGoalApprovalActions({
  goal,
  reviewId,
  onSuccess
}: UseGoalApprovalActionsOptions): UseGoalApprovalActionsReturn {
  const router = useRouter();
  const { refreshPendingCount } = useGoalReviewContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState>({
    open: false,
    type: 'approve'
  });

  // Optimistic updates for goal status
  const [optimisticGoal, updateOptimisticGoal] = useOptimistic(
    goal,
    (currentGoal: GoalResponse, optimisticUpdate: OptimisticGoalUpdate) => {
      return {
        ...currentGoal,
        status: optimisticUpdate.status,
        approvedAt: optimisticUpdate.approvedAt || currentGoal.approvedAt,
      };
    }
  );

  /**
   * Show error toast
   */
  const showErrorToast = useCallback((error?: string) => {
    toast.error('操作に失敗しました', {
      description: error || '不明なエラーが発生しました。'
    });
  }, []);

  /**
   * Revert optimistic update
   */
  const revertOptimisticUpdate = useCallback(() => {
    startTransition(() => {
      updateOptimisticGoal({ status: 'submitted' });
    });
  }, [updateOptimisticGoal]);

  /**
   * Open confirmation dialog for approval
   */
  const handleApprove = useCallback((comment: string) => {
    setConfirmationDialog({
      open: true,
      type: 'approve',
      comment
    });
  }, []);

  /**
   * Open confirmation dialog for rejection
   */
  const handleReject = useCallback((comment: string) => {
    setConfirmationDialog({
      open: true,
      type: 'reject',
      comment
    });
  }, []);

  /**
   * Close confirmation dialog
   */
  const closeDialog = useCallback(() => {
    setConfirmationDialog(prev => ({ ...prev, open: false }));
  }, []);

  /**
   * Confirm and execute the pending action
   */
  const confirmAction = useCallback(async () => {
    if (!confirmationDialog.open) return;

    // Validate reviewId exists
    if (!reviewId) {
      toast.error('レビューIDが見つかりません', {
        description: 'ページを更新してください。'
      });
      return;
    }

    setIsProcessing(true);
    const { type, comment } = confirmationDialog;

    try {
      // Optimistic update wrapped in transition
      const optimisticUpdate: OptimisticGoalUpdate = {
        status: type === 'approve' ? 'approved' : 'rejected',
        ...(type === 'approve'
          ? { approvedAt: new Date().toISOString() }
          : { rejectedAt: new Date().toISOString() }
        )
      };

      startTransition(() => {
        updateOptimisticGoal(optimisticUpdate);
      });

      // Close dialog immediately for better UX
      closeDialog();

      // Update supervisor_review with action + comment + status='submitted'
      // Backend will automatically sync goal.status
      const result = await updateSupervisorReviewAction(reviewId, {
        action: type === 'approve' ? SupervisorAction.APPROVED : SupervisorAction.REJECTED,
        comment: comment || undefined,
        status: SubmissionStatus.SUBMITTED
      });

      if (!result.success) {
        // Revert optimistic update on server error
        revertOptimisticUpdate();
        showErrorToast(result.error);
        return;
      }

      // Success toast
      const message = SUCCESS_MESSAGES[type];
      toast.success(message.title, {
        description: message.description(goal.title || '')
      });

      // Refresh global pending count
      await refreshPendingCount();

      // Call success callback to refresh parent data
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }

    } catch (error) {
      console.error('Supervisor review action error:', error);

      // Revert optimistic update on network error
      revertOptimisticUpdate();
      showErrorToast();
    } finally {
      setIsProcessing(false);
    }
  }, [
    confirmationDialog,
    reviewId,
    goal.title,
    closeDialog,
    updateOptimisticGoal,
    revertOptimisticUpdate,
    showErrorToast,
    refreshPendingCount,
    onSuccess,
    router
  ]);

  return {
    optimisticGoal,
    isProcessing,
    confirmationDialog,
    handleApprove,
    handleReject,
    confirmAction,
    closeDialog
  };
}
