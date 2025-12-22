'use client';

import { useRef } from 'react';
import { type GoalResponse, type SupervisorReview } from '@/api/types';
import { ApprovalForm, type ApprovalFormRef } from '../ApprovalForm';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useGoalApprovalActions } from '../../hooks/useGoalApprovalActions';
import { resolveCompetencyNamesForDisplay } from '@/utils/goal-competency-names';

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
  /** Supervisor review for this goal (used for approval + draft comment auto-save) */
  review?: SupervisorReview;
}

/**
 * Handles goal approval and rejection functionality with optimistic UI updates.
 * Refactored to use custom hooks for better separation of concerns.
 *
 * @param props - The component props
 * @returns JSX element containing approval form and confirmation dialog
 */
export function GoalApprovalHandler({ goal, employeeName, onSuccess, review }: GoalApprovalHandlerProps) {
  // Reference to the ApprovalForm for form control
  const approvalFormRef = useRef<ApprovalFormRef>(null);
  const reviewId = review?.id;

  // Determine goal type
  const isCompetencyGoal = goal.goalCategory === 'コンピテンシー';

  // Auto-save hook - handles draft save, load, and before unload
  const { saveStatus, debouncedSave, save } = useAutoSave({
    reviewId,
    initialComment: review?.comment,
    initialStatus: review?.status,
    getComment: () => approvalFormRef.current?.getComment() || '',
    setComment: (comment) => approvalFormRef.current?.setComment(comment)
  });

  // Approval actions hook - handles approve/reject with optimistic updates
  const {
    optimisticGoal,
    isProcessing,
    confirmationDialog,
    handleApprove,
    handleReject,
    confirmAction,
    closeDialog
  } = useGoalApprovalActions({
    goal,
    reviewId,
    onSuccess: () => {
      // Reset the form on success
      if (approvalFormRef.current) {
        approvalFormRef.current.resetForm();
      }
      // Call parent success callback
      if (onSuccess) {
        onSuccess();
      }
    }
  });

  // Generate appropriate goal title based on goal type
  const getGoalTitle = (): string => {
    if (isCompetencyGoal) {
      const names = resolveCompetencyNamesForDisplay(optimisticGoal.competencyIds, optimisticGoal.competencyNames);
      if (names) return names.join(', ');
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
        onApprove={handleApprove}
        onReject={handleReject}
        isProcessing={isProcessing}
        onCommentChange={debouncedSave}
        onCommentBlur={save}
        saveStatus={saveStatus}
      />

      <ConfirmationDialog
        open={confirmationDialog.open}
        onOpenChange={closeDialog}
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
