'use client';

import { useState, useOptimistic, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { GoalResponse } from '@/api/types';
import { approveGoalAction, rejectGoalAction } from '@/api/server-actions/goals';
import { useGoalReviewContext } from '@/context/GoalReviewContext';
import { ApprovalForm, type ApprovalFormRef } from '../ApprovalForm';
import { ConfirmationDialog } from '../ConfirmationDialog';

/**
 * Props for the GoalApprovalHandler component
 */
interface GoalApprovalHandlerProps {
  /** The goal to be approved or rejected */
  goal: GoalResponse;
  /** Optional employee name for display in messages */
  employeeName?: string;
  /** Callback function called after successful approval/rejection */
  onSuccess?: () => void;
}

/**
 * Type for optimistic UI updates
 */
type OptimisticGoalUpdate = {
  status: 'approved' | 'rejected' | 'submitted';
  approvedAt?: string;
};

/**
 * Handles goal approval and rejection functionality with optimistic UI updates
 *
 * @param props - The component props
 * @returns JSX element containing approval form and confirmation dialog
 */
export function GoalApprovalHandler({ goal, employeeName, onSuccess }: GoalApprovalHandlerProps) {
  const router = useRouter();
  const { refreshPendingCount } = useGoalReviewContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject';
    comment?: string;
  }>({ open: false, type: 'approve' });

  // Reference to the ApprovalForm for form control
  const approvalFormRef = useRef<ApprovalFormRef>(null);

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

  const handleApprove = async (comment?: string) => {
    setConfirmationDialog({
      open: true,
      type: 'approve',
      comment
    });
  };

  const handleReject = async (comment: string) => {
    setConfirmationDialog({
      open: true,
      type: 'reject',
      comment
    });
  };

  const confirmAction = async () => {
    if (!confirmationDialog.open) return;

    setIsProcessing(true);
    const { type, comment } = confirmationDialog;

    try {
      // Optimistic update
      const optimisticUpdate: OptimisticGoalUpdate = {
        status: type === 'approve' ? 'approved' : 'rejected',
        ...(type === 'approve'
          ? { approvedAt: new Date().toISOString() }
          : { rejectedAt: new Date().toISOString() }
        )
      };

      updateOptimisticGoal(optimisticUpdate);

      // Close dialog immediately for better UX
      setConfirmationDialog({ open: false, type: 'approve' });

      let result;

      if (type === 'approve') {
        result = await approveGoalAction(goal.id);

        if (result.success) {
          toast.success('目標を承認しました', {
            description: `${goal.title}を承認しました。`
          });
        }
      } else {
        if (!comment) {
          // Revert optimistic update on validation error
          updateOptimisticGoal({ status: 'submitted' });
          toast.error('差し戻し時はコメントが必要です');
          return;
        }

        result = await rejectGoalAction(goal.id, comment);

        if (result.success) {
          toast.success('目標を差し戻しました', {
            description: `${goal.title}を差し戻しました。`
          });
        }
      }

      if (!result.success) {
        // Revert optimistic update on server error
        updateOptimisticGoal({ status: 'submitted' });

        toast.error('操作に失敗しました', {
          description: result.error || '不明なエラーが発生しました。'
        });
        return;
      }

      // Success: Reset the form
      if (approvalFormRef.current) {
        approvalFormRef.current.resetForm();
      }

      // Refresh global pending count
      await refreshPendingCount();

      // Call success callback to refresh parent data
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }

    } catch (error) {
      console.error('Goal action error:', error);

      // Revert optimistic update on network error
      updateOptimisticGoal({ status: 'submitted' });

      toast.error('操作に失敗しました', {
        description: '不明なエラーが発生しました。'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Use provided employee name or fallback
  const finalEmployeeName = employeeName || 'Unknown User';

  return (
    <>
      <ApprovalForm
        ref={approvalFormRef}
        goal={optimisticGoal}
        onApprove={handleApprove}
        onReject={handleReject}
        isProcessing={isProcessing}
      />

      <ConfirmationDialog
        open={confirmationDialog.open}
        onOpenChange={(open) => setConfirmationDialog(prev => ({ ...prev, open }))}
        onConfirm={confirmAction}
        type={confirmationDialog.type}
        goalTitle={optimisticGoal.title || 'タイトルなし'}
        employeeName={finalEmployeeName}
        comment={confirmationDialog.comment}
        isProcessing={isProcessing}
      />
    </>
  );
}