import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Target, Brain, Calendar, Weight, Loader2, AlertCircle } from 'lucide-react';
import { GoalStatusBadge } from '@/feature/evaluation/superviser/goal-review/components/GoalStatusBadge';
import { SupervisorCommentBanner } from './SupervisorCommentBanner';
import { useCompetencyNames } from '@/feature/evaluation/superviser/goal-review/hooks/useCompetencyNames';
import { useIdealActionsResolver } from '@/feature/evaluation/superviser/goal-review/hooks/useIdealActionsResolver';
import type { GoalResponse, SupervisorReview } from '@/api/types';
import { useRouter } from 'next/navigation';

/**
 * Props for GoalCard component
 */
interface GoalCardProps {
  /** Goal data to display with mapped supervisor review and previousGoalReview */
  goal: GoalResponse & {
    supervisorReview?: SupervisorReview | null;
    previousGoalReview?: SupervisorReview | null;
  };
  /** Optional custom className */
  className?: string;
}

/**
 * Card component to display a single goal with its status, details, and actions.
 *
 * Features:
 * - Displays goal category icon and status badge
 * - Shows all goal fields (similar to GoalApprovalCard)
 * - Shows supervisor comments (rejection or approval) if applicable
 * - Provides action buttons based on goal status:
 *   - draft: 編集
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
    const isPerformanceGoal = goal.goalCategory === '業績目標';
    const isCompetencyGoal = goal.goalCategory === 'コンピテンシー';

    // Resolve competency IDs to names for display
    const { competencyNames, loading: competencyLoading } = useCompetencyNames(
      isCompetencyGoal ? goal.competencyIds : null
    );

    // Resolve ideal action IDs to descriptive texts
    const { resolvedActions, loading: actionsLoading } = useIdealActionsResolver(
      isCompetencyGoal ? goal.selectedIdealActions : null,
      goal.competencyIds
    );

    // Get category icon
    const getCategoryIcon = () => {
      if (isPerformanceGoal) {
        return <Target className="h-4 w-4" />;
      }
      if (isCompetencyGoal) {
        return <Brain className="h-4 w-4" />;
      }
      return <Target className="h-4 w-4" />;
    };

    // Format dates
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Determine button text and action based on status
    // Only show action buttons when employee can/should take action
    const getActionButton = () => {
      switch (goal.status) {
        case 'draft':
          return (
            <Button
              onClick={() => router.push(`/goal-edit/${goal.id}`)}
              variant="outline"
            >
              編集
            </Button>
          );
        case 'rejected':
          return (
            <Button
              onClick={() => router.push(`/goal-edit/${goal.id}`)}
              variant="default"
            >
              編集・再提出
            </Button>
          );
        case 'submitted':
        case 'approved':
          // No action needed - all info is already visible in the card
          return null;
        default:
          return null;
      }
    };

    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getCategoryIcon()}
              <span className="font-medium">{goal.goalCategory}</span>
            </div>
            <div className="flex items-center gap-2">
              <GoalStatusBadge status={goal.status} />
              {goal.previousGoalId && (
                <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50">
                  再提出
                </Badge>
              )}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Weight className="h-3 w-3" />
                <span>{goal.weight}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <time dateTime={goal.createdAt}>
              提出日: {formatDate(goal.createdAt)}
            </time>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Rejection History Banner - shown if this goal was created from a rejected goal */}
          {goal.previousGoalId && goal.previousGoalReview && (
            <Alert variant="default" className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="ml-2">
                <div className="space-y-2">
                  <p className="font-semibold text-amber-900">
                    この目標は以前差し戻されました
                  </p>
                  {goal.previousGoalReview.comment && (
                    <div className="bg-white p-3 rounded border border-amber-200">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        前回のコメント:
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {goal.previousGoalReview.comment}
                      </p>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Performance Goal Content */}
          {isPerformanceGoal && (
            <div className="space-y-4">
              {goal.title && (
                <div>
                  <h4 className="font-semibold mb-2">目標タイトル</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm">{goal.title}</p>
                  </div>
                </div>
              )}

              {goal.specificGoalText && (
                <div>
                  <h4 className="font-semibold mb-2">具体的な目標内容</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{goal.specificGoalText}</p>
                  </div>
                </div>
              )}

              {goal.achievementCriteriaText && (
                <div>
                  <h4 className="font-semibold mb-2">達成基準</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{goal.achievementCriteriaText}</p>
                  </div>
                </div>
              )}

              {goal.meansMethodsText && (
                <div>
                  <h4 className="font-semibold mb-2">方法</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{goal.meansMethodsText}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Competency Goal Content */}
          {isCompetencyGoal && (
            <div className="space-y-4">
              {goal.competencyIds && goal.competencyIds.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">選択したコンピテンシー</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    {competencyLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        コンピテンシー名を読み込み中...
                      </div>
                    ) : competencyNames.length > 0 ? (
                      <p className="text-sm">
                        {competencyNames.join(', ')}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        コンピテンシーID: {goal.competencyIds.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {goal.selectedIdealActions && Object.keys(goal.selectedIdealActions).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">理想的な行動</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    {actionsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        理想的な行動を読み込み中...
                      </div>
                    ) : resolvedActions.length > 0 ? (
                      <div className="space-y-2">
                        {resolvedActions.map((resolved, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">
                              {resolved.competencyName}:
                            </span>
                            <ul className="list-disc list-inside ml-2 mt-1">
                              {resolved.actions.map((action, actionIndex) => (
                                <li key={actionIndex}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(goal.selectedIdealActions).map(([key, actions]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium">{key}:</span>
                            <ul className="list-disc list-inside ml-2 mt-1">
                              {actions.map((action, index) => (
                                <li key={index}>行動 {action}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {goal.actionPlan && (
                <div>
                  <h4 className="font-semibold mb-2">行動計画</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{goal.actionPlan}</p>
                  </div>
                </div>
              )}
            </div>
          )}

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
