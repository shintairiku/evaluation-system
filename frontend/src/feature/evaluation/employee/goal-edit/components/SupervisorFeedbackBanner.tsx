import React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { SupervisorReview, GoalStatus } from '@/api/types';
import { SupervisorAction } from '@/api/types';

/**
 * Props for SupervisorFeedbackBanner component
 */
interface SupervisorFeedbackBannerProps {
  /** Supervisor review data */
  supervisorReview: SupervisorReview | null;
  /** Goal status */
  goalStatus: GoalStatus;
  /** Optional custom className */
  className?: string;
}

/**
 * Banner component to display supervisor feedback prominently on the goal edit page.
 *
 * This is different from SupervisorCommentBanner in goal-list:
 * - Larger, more prominent display
 * - Always shown at the top of the page
 * - Provides context for why the goal needs to be edited
 *
 * @param props - Component props
 * @returns JSX element containing the supervisor feedback banner
 */
export const SupervisorFeedbackBanner = React.memo<SupervisorFeedbackBannerProps>(
  function SupervisorFeedbackBanner({ supervisorReview, goalStatus, className }: SupervisorFeedbackBannerProps) {
    // Determine if goal is rejected
    const isRejected =
      (supervisorReview?.action === SupervisorAction.REJECTED || supervisorReview?.action === 'rejected') ||
      goalStatus === 'rejected';

    // Determine if goal is approved
    const isApproved =
      (supervisorReview?.action === SupervisorAction.APPROVED || supervisorReview?.action === 'approved') ||
      goalStatus === 'approved';

    // If draft, show info message
    if (goalStatus === 'draft' && !supervisorReview) {
      return (
        <Alert className={className}>
          <Info className="h-5 w-5" />
          <AlertTitle className="text-base">下書きを編集中</AlertTitle>
          <AlertDescription className="mt-2">
            <p>この目標はまだ提出されていません。編集が完了したら「提出」ボタンをクリックしてください。</p>
          </AlertDescription>
        </Alert>
      );
    }

    // Format date
    const formatDate = (dateString?: string) => {
      if (!dateString) return null;
      return new Date(dateString).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const comment = supervisorReview?.comment || 'コメントなし';
    const reviewedAt = supervisorReview?.reviewed_at;

    // Render rejection feedback
    if (isRejected) {
      return (
        <Alert variant="destructive" className={`${className} border-2`}>
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-base font-bold">
            この目標は差し戻されました
          </AlertTitle>
          <AlertDescription className="mt-3 space-y-3">
            <div>
              <p className="text-sm font-semibold mb-1">上司からのフィードバック:</p>
              <div className="bg-white/10 p-3 rounded-md">
                <p className="whitespace-pre-wrap">{comment}</p>
              </div>
            </div>
            {reviewedAt && (
              <p className="text-sm opacity-90">
                差し戻し日時: {formatDate(reviewedAt)}
              </p>
            )}
            <div className="border-t border-white/20 pt-3 mt-3">
              <p className="text-sm font-semibold">次のステップ:</p>
              <p className="text-sm mt-1">
                上記のフィードバックを参考に目標を修正し、再度提出してください。
              </p>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    // Render approval feedback
    if (isApproved) {
      return (
        <Alert className={`${className} border-2 border-green-200 bg-green-50`}>
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-base font-bold text-green-900">
            この目標は承認されました
          </AlertTitle>
          <AlertDescription className="mt-3 space-y-3 text-green-900">
            <div>
              <p className="text-sm font-semibold mb-1">上司からのコメント:</p>
              <div className="bg-white p-3 rounded-md border border-green-200">
                <p className="whitespace-pre-wrap">{comment}</p>
              </div>
            </div>
            {reviewedAt && (
              <p className="text-sm opacity-75">
                承認日時: {formatDate(reviewedAt)}
              </p>
            )}
            <div className="border-t border-green-200 pt-3 mt-3">
              <p className="text-sm">
                この目標は承認済みです。必要に応じて編集できますが、再度承認が必要になります。
              </p>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }
);
