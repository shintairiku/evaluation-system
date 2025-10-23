import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Target, Brain, Calendar, Weight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { GoalStatusBadge } from '@/components/evaluation/GoalStatusBadge';
import { useCompetencyNames } from '@/hooks/evaluation/useCompetencyNames';
import { useIdealActionsResolver } from '@/hooks/evaluation/useIdealActionsResolver';
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
  /** Current user ID to determine if edit button should be shown */
  currentUserId?: string;
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
  function GoalCard({ goal, className, currentUserId }: GoalCardProps) {
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

    // Determine button text and action based on status and ownership
    // Only show edit button for own goals in draft status
    const getActionButton = () => {
      // Check if this is the current user's goal
      const isOwnGoal = currentUserId && currentUserId === goal.userId;

      // Only show edit button for own goals in draft status
      if (isOwnGoal && goal.status === 'draft') {
        return (
          <Button
            onClick={() => router.push(`/goal-edit/${goal.id}`)}
            variant="outline"
          >
            編集
          </Button>
        );
      }

      // No action for:
      // - Other users' goals (supervisor viewing subordinates)
      // - Submitted goals (awaiting review)
      // - Approved goals (finalized)
      // - Rejected goals (read-only, new draft created automatically)
      return null;
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
          {/* Rejection History - shown if this goal has rejection history */}
          {goal.rejectionHistory && goal.rejectionHistory.length > 0 && (
            <div className="space-y-3">
              {goal.rejectionHistory.map((rejection, index) => (
                <Alert key={rejection.id} variant="default" className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="ml-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-amber-900">
                          {goal.rejectionHistory.length > 1
                            ? `${index + 1}回目の差し戻し`
                            : 'この目標は以前差し戻されました'}
                        </p>
                        <p className="text-sm text-amber-800 ml-auto">
                          差し戻し日: {formatDate(rejection.reviewed_at || rejection.updated_at || rejection.created_at)}
                        </p>
                      </div>
                      {rejection.comment && (
                        <div className="bg-white p-3 rounded border border-amber-200">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            上司からのコメント:
                          </p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {rejection.comment}
                          </p>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Approval Banner - shown if this goal is approved */}
          {goal.status === 'approved' && goal.supervisorReview && goal.supervisorReview.comment && (
            <Alert variant="default" className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="ml-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-green-900">
                      目標が承認されました
                    </p>
                    <p className="text-sm text-green-800 ml-auto">
                      承認日: {formatDate(goal.supervisorReview.reviewed_at || goal.supervisorReview.updated_at || goal.supervisorReview.created_at)}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded border border-green-200">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      上司からのコメント:
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {goal.supervisorReview.comment}
                    </p>
                  </div>
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
        </CardContent>

        <CardFooter className="flex justify-end">
          {getActionButton()}
        </CardFooter>
      </Card>
    );
  }
);
