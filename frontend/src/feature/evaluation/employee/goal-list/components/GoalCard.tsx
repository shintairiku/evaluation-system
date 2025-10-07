import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoalStatusBadge } from '@/feature/evaluation/superviser/goal-review/components/GoalStatusBadge';
import { RejectionCommentBanner } from './RejectionCommentBanner';
import type { GoalResponse } from '@/api/types';
import { useRouter } from 'next/navigation';

/**
 * Props for GoalCard component
 */
interface GoalCardProps {
  /** Goal data to display */
  goal: GoalResponse & { supervisorReview?: { action: 'approved' | 'rejected' | 'pending'; comment: string; reviewed_at?: string } | null };
  /** Optional custom className */
  className?: string;
}

/**
 * Card component to display a single goal with its status, details, and actions.
 *
 * Features:
 * - Displays goal title/category and status badge
 * - Shows rejection comments if applicable (persists based on supervisorReview.action)
 * - Provides action buttons based on goal status:
 *   - draft: 編集 / 提出
 *   - submitted: 確認 (read-only)
 *   - approved: 確認 (read-only)
 *   - rejected: 編集・再提出
 *
 * @param props - Component props
 * @returns JSX element containing the goal card
 *
 * @example
 * ```tsx
 * <GoalCard goal={goal} />
 * ```
 */
export const GoalCard = React.memo<GoalCardProps>(
  function GoalCard({ goal, className }: GoalCardProps) {
    const router = useRouter();

    // Determine display title based on goal category
    const displayTitle = goal.goalCategory === '業績目標'
      ? goal.title || '無題の目標'
      : goal.actionPlan
        ? `${goal.actionPlan.substring(0, 50)}${goal.actionPlan.length > 50 ? '...' : ''}`
        : 'コンピテンシー目標';

    // Format dates
    const updatedAt = new Date(goal.updatedAt).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Determine button text and action based on status
    const getActionButton = () => {
      switch (goal.status) {
        case 'draft':
          return (
            <Button
              onClick={() => router.push(`/goal-input?edit=${goal.id}`)}
              variant="outline"
            >
              編集
            </Button>
          );
        case 'rejected':
          return (
            <Button
              onClick={() => router.push(`/goal-input?edit=${goal.id}`)}
              variant="default"
            >
              編集・再提出
            </Button>
          );
        case 'submitted':
        case 'approved':
          return (
            <Button
              onClick={() => router.push(`/goal-input?view=${goal.id}`)}
              variant="outline"
            >
              確認
            </Button>
          );
        default:
          return null;
      }
    };

    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{displayTitle}</CardTitle>
              <CardDescription className="mt-1">
                {goal.goalCategory} • 更新日: {updatedAt}
              </CardDescription>
            </div>
            <GoalStatusBadge status={goal.status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Display rejection comment if exists - based on supervisorReview.action */}
          {goal.supervisorReview && (
            <RejectionCommentBanner supervisorReview={goal.supervisorReview} />
          )}

          {/* Goal details preview */}
          <div className="space-y-2">
            {goal.goalCategory === '業績目標' && goal.specificGoalText && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">具体的な目標</p>
                <p className="text-sm mt-1">
                  {goal.specificGoalText.substring(0, 100)}
                  {goal.specificGoalText.length > 100 ? '...' : ''}
                </p>
              </div>
            )}
            {goal.goalCategory === 'コンピテンシー' && goal.actionPlan && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">行動計画</p>
                <p className="text-sm mt-1">
                  {goal.actionPlan.substring(0, 100)}
                  {goal.actionPlan.length > 100 ? '...' : ''}
                </p>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end">
          {getActionButton()}
        </CardFooter>
      </Card>
    );
  }
);
