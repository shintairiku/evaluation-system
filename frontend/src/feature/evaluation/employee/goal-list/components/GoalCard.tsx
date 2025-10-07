import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoalStatusBadge } from '@/feature/evaluation/superviser/goal-review/components/GoalStatusBadge';
import { SupervisorCommentBanner } from './SupervisorCommentBanner';
import type { GoalResponse, SupervisorReview } from '@/api/types';
import { useRouter } from 'next/navigation';

/**
 * Props for GoalCard component
 */
interface GoalCardProps {
  /** Goal data to display with mapped supervisor review */
  goal: GoalResponse & { supervisorReview?: SupervisorReview | null };
  /** Optional custom className */
  className?: string;
}

/**
 * Card component to display a single goal with its status, details, and actions.
 *
 * Features:
 * - Displays goal title/category and status badge
 * - Shows supervisor comments (rejection or approval) if applicable
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

    // Debug log for rejected goals
    if (goal.status === 'rejected') {
      console.log('🔴 [GoalCard] REJECTED GOAL:', {
        id: goal.id,
        status: goal.status,
        supervisorReview: goal.supervisorReview,
        reviewAction: goal.supervisorReview?.action
      });
    }

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

          {/* Display supervisor comment (rejection or approval) */}
          <SupervisorCommentBanner
            supervisorReview={goal.supervisorReview || null}
            goalStatus={goal.status}
          />
        </CardContent>

        <CardFooter className="flex justify-end">
          {getActionButton()}
        </CardFooter>
      </Card>
    );
  }
);
