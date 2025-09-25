import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Brain, Calendar, Weight } from 'lucide-react';
import type { GoalResponse } from '@/api/types';
import { GoalApprovalHandler } from '../GoalApprovalHandler';

interface GoalApprovalCardProps {
  goal: GoalResponse;
  onGoalUpdate?: () => void;
}

export function GoalApprovalCard({ goal, onGoalUpdate }: GoalApprovalCardProps) {
  const isPerformanceGoal = goal.goalCategory === '業績目標';
  const isCompetencyGoal = goal.goalCategory === 'コンピテンシー';

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
      case 'pending_approval':
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
                  <p className="text-sm">コンピテンシーID: {goal.competencyIds.join(', ')}</p>
                </div>
              </div>
            )}

            {goal.selectedIdealActions && Object.keys(goal.selectedIdealActions).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">理想的な行動</h4>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="space-y-2">
                    {Object.entries(goal.selectedIdealActions).map(([key, actions]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium">{key}:</span>
                        <ul className="list-disc list-inside ml-2 mt-1">
                          {actions.map((action, index) => (
                            <li key={index}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
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
        {goal.status === 'pending_approval' && (
          <div className="mt-6 pt-4 border-t">
            <GoalApprovalHandler goal={goal} onSuccess={onGoalUpdate} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}