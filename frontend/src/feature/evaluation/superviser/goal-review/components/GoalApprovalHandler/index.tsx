'use client';

import { useState, useOptimistic, useRef, startTransition, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { type GoalResponse, SupervisorAction, SubmissionStatus } from '@/api/types';
import { updateSupervisorReviewAction, getSupervisorReviewByIdAction } from '@/api/server-actions/supervisor-reviews';
import { useGoalReviewContext } from '@/context/GoalReviewContext';
import { ApprovalForm, type ApprovalFormRef } from '../ApprovalForm';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { useCompetencyNames } from '../../hooks/useCompetencyNames';

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
  /** Supervisor review ID for this goal (required for approval actions) */
  reviewId?: string;
}

/**
 * Type for optimistic UI updates
 */
type OptimisticGoalUpdate = {
  status: 'approved' | 'rejected' | 'submitted';
  approvedAt?: string;
  rejectedAt?: string;
};

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
 * Handles goal approval and rejection functionality with optimistic UI updates
 *
 * @param props - The component props
 * @returns JSX element containing approval form and confirmation dialog
 */
export function GoalApprovalHandler({ goal, employeeName, onSuccess, reviewId }: GoalApprovalHandlerProps) {
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

  // Auto-save states
  const [lastSavedComment, setLastSavedComment] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine goal type
  const isCompetencyGoal = goal.goalCategory === 'コンピテンシー';

  // Get competency names for competency goals
  const { competencyNames } = useCompetencyNames(
    isCompetencyGoal ? goal.competencyIds : null
  );

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

  // Auto-save draft function
  const autoSaveDraft = useCallback(async (comment: string) => {
    if (!reviewId || !comment?.trim() || comment === lastSavedComment) {
      return; // Don't save if empty or unchanged
    }

    if (saveStatus === 'saving') {
      return; // Prevent concurrent saves
    }

    setSaveStatus('saving');

    try {
      const result = await updateSupervisorReviewAction(reviewId, {
        action: SupervisorAction.PENDING,
        comment: comment.trim(),
        status: SubmissionStatus.DRAFT
      });

      if (result.success) {
        setLastSavedComment(comment);
        setSaveStatus('saved');
        
        // Clear status after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      setSaveStatus('error');
    }
  }, [reviewId, lastSavedComment, saveStatus]);

  // Debounced auto-save (2 seconds delay)
  const handleCommentChange = useCallback((comment: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      autoSaveDraft(comment);
    }, 2000); // 2 seconds debounce
  }, [autoSaveDraft]);

  // Load existing draft on mount
  useEffect(() => {
    const loadExistingDraft = async () => {
      if (!reviewId || isDraftLoaded) return;

      try {
        const result = await getSupervisorReviewByIdAction(reviewId);
        
        if (result.success && result.data) {
          const review = result.data;
          
          // Only load if status is draft and has comment
          if (review.status === 'draft' && review.comment) {
            if (approvalFormRef.current) {
              approvalFormRef.current.setComment(review.comment);
            }
            setLastSavedComment(review.comment);
            setIsDraftLoaded(true);
            
            toast.info('下書きが読み込まれました', {
              description: '前回保存したコメントが復元されました'
            });
          }
        }
      } catch (error) {
        // Silent fail - draft loading is not critical
      }
    };

    loadExistingDraft();
  }, [reviewId, isDraftLoaded]);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentComment = approvalFormRef.current?.getComment();
      if (currentComment && currentComment !== lastSavedComment && currentComment.trim()) {
        // Try to save synchronously
        autoSaveDraft(currentComment);
        
        // Show warning if there are unsaved changes
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lastSavedComment, autoSaveDraft]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Unified confirmation handler to eliminate duplication
  const handleConfirmation = useCallback((type: 'approve' | 'reject', comment: string) => {
    setConfirmationDialog({
      open: true,
      type,
      comment
    });
  }, []);

  // Helper function to show error toast (eliminates duplication)
  const showErrorToast = useCallback((error?: string) => {
    toast.error('操作に失敗しました', {
      description: error || '不明なエラーが発生しました。'
    });
  }, []);

  // Helper function to revert optimistic update (eliminates duplication)
  const revertOptimisticUpdate = useCallback(() => {
    startTransition(() => {
      updateOptimisticGoal({ status: 'submitted' });
    });
  }, [updateOptimisticGoal]);

  const confirmAction = async () => {
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
      setConfirmationDialog({ open: false, type: 'approve' });

      // Use NEW supervisor_review architecture
      // Update supervisor_review with action + comment + status='submitted'
      // Backend will automatically sync goal.status
      const result = await updateSupervisorReviewAction(reviewId, {
        action: type === 'approve' ? SupervisorAction.APPROVED : SupervisorAction.REJECTED,
        comment: comment || null,
        status: SubmissionStatus.SUBMITTED  // This triggers backend sync to goal.status
      });

      if (!result.success) {
        // Revert optimistic update on server error
        revertOptimisticUpdate();
        showErrorToast(result.error);
        return;
      }

      // Success toast using extracted message map
      const message = SUCCESS_MESSAGES[type];
      toast.success(message.title, {
        description: message.description(goal.title)
      });

      // Reset the form
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
      console.error('Supervisor review action error:', error);

      // Revert optimistic update on network error
      revertOptimisticUpdate();
      showErrorToast();
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate appropriate goal title based on goal type
  const getGoalTitle = (): string => {
    if (isCompetencyGoal) {
      // For competency goals, use competency names
      if (competencyNames.length > 0) {
        return competencyNames.join(', ');
      }
      // Fallback to competency category
      return 'コンピテンシー目標';
    } else {
      // For performance goals, use title
      return optimisticGoal.title || '業績目標';
    }
  };

  return (
    <>
      <ApprovalForm
        ref={approvalFormRef}
        goal={optimisticGoal}
        onApprove={(comment) => handleConfirmation('approve', comment)}
        onReject={(comment) => handleConfirmation('reject', comment)}
        isProcessing={isProcessing}
        onCommentChange={handleCommentChange}
        onCommentBlur={autoSaveDraft}
        saveStatus={saveStatus}
      />

      <ConfirmationDialog
        open={confirmationDialog.open}
        onOpenChange={(open) => setConfirmationDialog(prev => ({ ...prev, open }))}
        onConfirm={confirmAction}
        type={confirmationDialog.type}
        goalTitle={getGoalTitle()}
        employeeName={employeeName || 'Unknown User'}
        comment={confirmationDialog.comment}
        isProcessing={isProcessing}
      />
    </>
  );
}