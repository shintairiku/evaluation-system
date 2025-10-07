import React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { SupervisorReview } from '@/api/types';

/**
 * Props for RejectionCommentBanner component
 */
interface RejectionCommentBannerProps {
  /** Supervisor review data - must have action='rejected' to display */
  supervisorReview: SupervisorReview | null;
  /** Optional custom className */
  className?: string;
}

/**
 * Banner component to display supervisor rejection comments.
 *
 * CRITICAL: This component displays based on supervisorReview.action === 'rejected',
 * NOT on goal.status. This ensures comments persist even when goal status changes
 * to 'draft' during editing.
 *
 * Why this matters:
 * - When user edits a rejected goal, status changes to 'draft'
 * - If display is based on status, comments disappear
 * - User loses context about what needs to be fixed
 * - Display based on review action ensures comments persist
 *
 * @param props - Component props
 * @returns JSX element containing the rejection comment banner, or null if no rejection
 *
 * @example
 * ```tsx
 * <RejectionCommentBanner
 *   supervisorReview={goal.supervisorReview}
 * />
 * ```
 */
export const RejectionCommentBanner = React.memo<RejectionCommentBannerProps>(
  function RejectionCommentBanner({ supervisorReview, className }: RejectionCommentBannerProps) {
    // Only display if there is a supervisor review with action='rejected'
    if (!supervisorReview || supervisorReview.action !== 'rejected') {
      return null;
    }

    const comment = supervisorReview.comment || 'コメントなし';
    const reviewedAt = supervisorReview.reviewed_at
      ? new Date(supervisorReview.reviewed_at).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : null;

    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>目標が差し戻されました</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <div className="font-medium">
            {comment}
          </div>
          {reviewedAt && (
            <div className="text-sm opacity-90">
              差し戻し日: {reviewedAt}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }
);
