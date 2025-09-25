'use client';

import { useState, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { GoalResponse } from '@/api/types';
import { approveGoalAction, rejectGoalAction } from '@/api/server-actions/goals';
import { ApprovalForm } from '../ApprovalForm';
import { ConfirmationDialog } from '../ConfirmationDialog';

interface GoalApprovalHandlerProps {
  goal: GoalResponse;
  onSuccess?: () => void;
}

type OptimisticGoalUpdate = {
  status: 'approved' | 'rejected' | 'pending_approval';
  approvedAt?: string;
  rejectedAt?: string;
};

export function GoalApprovalHandler({ goal, onSuccess }: GoalApprovalHandlerProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject';
    comment?: string;
  }>({ open: false, type: 'approve' });

  // Optimistic updates for goal status
  const [optimisticGoal, updateOptimisticGoal] = useOptimistic(
    goal,
    (currentGoal: GoalResponse, optimisticUpdate: OptimisticGoalUpdate) => {
      return {
        ...currentGoal,
        status: optimisticUpdate.status,
        approvedAt: optimisticUpdate.approvedAt || currentGoal.approvedAt,
        rejectedAt: optimisticUpdate.rejectedAt || currentGoal.rejectedAt,
      };
    }
  );

  const handleApprove = async (goalId: string, comment?: string) => {
    setConfirmationDialog({
      open: true,
      type: 'approve',
      comment
    });
  };

  const handleReject = async (goalId: string, comment: string) => {
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
          updateOptimisticGoal({ status: 'pending_approval' });
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
        updateOptimisticGoal({ status: 'pending_approval' });

        toast.error('操作に失敗しました', {
          description: result.error || '不明なエラーが発生しました。'
        });
        return;
      }

      // Call success callback to refresh parent data
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }

    } catch (error) {
      console.error('Goal action error:', error);

      // Revert optimistic update on network error
      updateOptimisticGoal({ status: 'pending_approval' });

      toast.error('操作に失敗しました', {
        description: '不明なエラーが発生しました。'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Find employee name from goal data or use fallback
  const employeeName = goal.user?.name || 'Unknown User';

  return (
    <>
      <ApprovalForm
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
        goalTitle={optimisticGoal.title}
        employeeName={employeeName}
        comment={confirmationDialog.comment}
        isProcessing={isProcessing}
      />
    </>
  );
}