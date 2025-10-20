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
    // Determine if goal is rejected (handle both lowercase and uppercase from backend)
    const isRejected =
      supervisorReview?.action?.toUpperCase() === 'REJECTED' ||
      goalStatus === 'rejected';

    // Determine if goal is approved (handle both lowercase and uppercase from backend)
    const isApproved =
      supervisorReview?.action?.toUpperCase() === 'APPROVED' ||
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
        <div className={`${className} bg-white border-2 border-red-300 rounded-lg p-6 shadow-md`}>
          {/* Header with icon and title */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-red-900 mb-1">
                目標が差し戻されました
              </h3>
              {reviewedAt && (
                <p className="text-sm text-red-700">
                  {formatDate(reviewedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Feedback section */}
          <div className="bg-gray-50 rounded-lg p-4 shadow-sm border border-red-200 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-6 bg-red-500 rounded-full"></div>
              <h4 className="font-bold text-gray-900">上司からのフィードバック</h4>
            </div>
            <div className="pl-4 border-l-2 border-red-200">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{comment}</p>
            </div>
          </div>

          {/* Next steps */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-300">
            <h4 className="font-semibold text-red-900 mb-2">
              次のステップ
            </h4>
            <p className="text-sm text-red-800">
              上記のフィードバックを参考に目標を修正し、下記のフォームから再度提出してください。
            </p>
          </div>
        </div>
      );
    }

    // Render approval feedback
    if (isApproved) {
      return (
        <div className={`${className} bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-6 shadow-md`}>
          {/* Header with icon and title */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-900 mb-1">
                目標が承認されました
              </h3>
              {reviewedAt && (
                <p className="text-sm text-green-700">
                  {formatDate(reviewedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Feedback section */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-green-200 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
              <h4 className="font-bold text-gray-900">上司からのコメント</h4>
            </div>
            <div className="pl-4 border-l-2 border-green-200">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{comment}</p>
            </div>
          </div>

          {/* Info note */}
          <div className="bg-green-500/10 rounded-lg p-4 border border-green-300">
            <h4 className="font-semibold text-green-900 mb-2">
              お知らせ
            </h4>
            <p className="text-sm text-green-800">
              この目標は承認済みです。必要に応じて編集できますが、変更した場合は再度承認が必要になります。
            </p>
          </div>
        </div>
      );
    }

    return null;
  }
);
