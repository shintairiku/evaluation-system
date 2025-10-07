import React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import type { SupervisorReview, GoalStatus } from '@/api/types';
import { SupervisorAction } from '@/api/types';

/**
 * Props for SupervisorCommentBanner component
 */
interface SupervisorCommentBannerProps {
  /** Supervisor review data - may have action='rejected' or 'approved' to display */
  supervisorReview: SupervisorReview | null;
  /** Goal status - fallback check for rejection/approval state */
  goalStatus: GoalStatus;
  /** Optional custom className */
  className?: string;
}

/**
 * Banner component to display supervisor comments for both rejections and approvals.
 *
 * CRITICAL: This component displays based on EITHER:
 * 1. supervisorReview.action === 'rejected'/'approved' (primary check)
 * 2. goalStatus === 'rejected'/'approved' (fallback for data consistency issues)
 *
 * Why dual check:
 * - Ideally, review.action and goal.status are in sync
 * - However, backend workflow may have timing/consistency issues
 * - Checking both ensures comments always display when needed
 * - When user edits a rejected goal, status changes to 'draft'
 * - At that point, review.action should be the source of truth
 *
 * Display logic:
 * - Rejected: Red alert with AlertCircle icon
 * - Approved: Green/default alert with CheckCircle icon
 *
 * @param props - Component props
 * @returns JSX element containing the supervisor comment banner, or null if no review
 *
 * @example
 * ```tsx
 * <SupervisorCommentBanner
 *   supervisorReview={goal.supervisorReview}
 *   goalStatus={goal.status}
 * />
 * ```
 */
export const SupervisorCommentBanner = React.memo<SupervisorCommentBannerProps>(
  function SupervisorCommentBanner({ supervisorReview, goalStatus, className }: SupervisorCommentBannerProps) {
    // Debug log
    console.log('🔍 [SupervisorCommentBanner] supervisorReview:', supervisorReview);
    console.log('🔍 [SupervisorCommentBanner] goalStatus:', goalStatus);
    console.log('🔍 [SupervisorCommentBanner] comment field:', supervisorReview?.comment);

    // Determine if goal is rejected (check both review action and goal status)
    const isRejected =
      (supervisorReview?.action === SupervisorAction.REJECTED || supervisorReview?.action === 'rejected') ||
      goalStatus === 'rejected';

    // Determine if goal is approved (check both review action and goal status)
    const isApproved =
      (supervisorReview?.action === SupervisorAction.APPROVED || supervisorReview?.action === 'approved') ||
      goalStatus === 'approved';

    // Only show if rejected or approved
    if (!isRejected && !isApproved) {
      return null;
    }

    // If there's no review but goal has status, show generic message
    if (!supervisorReview) {
      if (isRejected) {
        return (
          <Alert variant="destructive" className={className}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>目標が差し戻されました</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="font-medium">コメントなし</div>
            </AlertDescription>
          </Alert>
        );
      }
      if (isApproved) {
        return (
          <Alert className={className}>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>目標が承認されました</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="font-medium">コメントなし</div>
            </AlertDescription>
          </Alert>
        );
      }
    }

    const comment = supervisorReview.comment || 'コメントなし';
    const reviewedAt = supervisorReview.reviewed_at
      ? new Date(supervisorReview.reviewed_at).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : null;

    // Render rejection banner
    if (isRejected) {
      return (
        <Alert variant="destructive" className={className}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>目標が差し戻されました</span>
            {reviewedAt && (
              <span className="text-sm font-normal opacity-90">
                差し戻し日: {reviewedAt}
              </span>
            )}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <div className="text-sm font-semibold">上司からのコメント:</div>
            <div className="font-medium">
              {comment}
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    // Render approval banner
    if (isApproved) {
      return (
        <Alert className={className}>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>目標が承認されました</span>
            {reviewedAt && (
              <span className="text-sm font-normal opacity-90">
                承認日: {reviewedAt}
              </span>
            )}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <div className="text-sm font-semibold text-muted-foreground">上司からのコメント:</div>
            <div className="font-medium">
              {comment}
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }
);
