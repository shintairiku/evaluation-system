import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Brain, Calendar, Weight, Loader2 } from 'lucide-react';
import type { GoalResponse } from '@/api/types';
import { GoalApprovalHandler } from '../GoalApprovalHandler';
import { useCompetencyNames } from '../../hooks/useCompetencyNames';
import { useIdealActionsResolver } from '../../hooks/useIdealActionsResolver';

/**
 * Props for the GoalApprovalCard component
 */
interface GoalApprovalCardProps {
  /** The goal to display */
  goal: GoalResponse;
  /** Optional employee name for approval handler */
  employeeName?: string;
  /** Callback function called when goal is updated */
  onGoalUpdate?: () => void;
}

/**
 * Card component displaying goal details with approval functionality
 * Memoized to prevent unnecessary re-renders when parent updates
 */
export const GoalApprovalCard = React.memo<GoalApprovalCardProps>(function GoalApprovalCard({
  goal,
  employeeName,
  onGoalUpdate
}) {
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

  const getCategoryIcon = () => {
    if (isPerformanceGoal) {
      return <Target className="h-4 w-4" />;
    }
    if (isCompetencyGoal) {
      return <Brain className="h-4 w-4" />;
    }
    return <Target className="h-4 w-4" />;
  };

  const getStatusBadge = () => {
    switch (goal.status) {
      case 'submitted':
        return <Badge variant="secondary">承認待ち</Badge>;
      case 'approved':
        return <Badge variant="default">承認済み</Badge>;
      case 'rejected':
        return <Badge variant="destructive">差し戻し</Badge>;
      default:
        return <Badge variant="outline">{goal.status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon()}
            <span className="font-medium">{goal.goalCategory}</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Weight className="h-3 w-3" />
              <span>{goal.weight}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>提出日: {formatDate(goal.createdAt)}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
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

            {goal.performanceGoalType && (
              <div className="text-sm text-muted-foreground">
                <span>タイプ: {goal.performanceGoalType === 'quantitative' ? '定量的' : '定性的'}</span>
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
                    <p className="text-sm">{competencyNames.join(', ')}</p>
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
                          <span className="font-medium">{resolved.competencyName}:</span>
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

        {/* Approval/Rejection Info */}
        {goal.approvedAt && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <span>承認日時: {formatDate(goal.approvedAt)}</span>
            </div>
          </div>
        )}

        {/* Approval Handler - Only show for pending goals */}
        {goal.status === 'submitted' && (
          <div className="mt-6 pt-4 border-t">
            <GoalApprovalHandler goal={goal} employeeName={employeeName} onSuccess={onGoalUpdate} />
          </div>
        )}
      </CardContent>
    </Card>
  );
});