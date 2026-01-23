import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Target, Brain, Calendar, Weight } from 'lucide-react';
import type { GoalResponse, SupervisorReview } from '@/api/types';
import { GoalApprovalHandler } from '../GoalApprovalHandler';
import { GoalRemandHandler } from '../GoalRemandHandler';
import { GoalStatusBadge } from '@/components/evaluation/GoalStatusBadge';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useResponsiveBreakpoint } from '@/hooks/useResponsiveBreakpoint';
import { generateAccessibilityId } from '@/utils/accessibility';
import { resolveCompetencyNamesForDisplay } from '@/utils/goal-competency-names';

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
  /** Supervisor review for this goal (used for auto-save + approval actions) */
  review?: SupervisorReview;
}

/**
 * Card component displaying goal details with approval functionality
 * Memoized to prevent unnecessary re-renders when parent updates
 */
export const GoalApprovalCard = React.memo<GoalApprovalCardProps>(function GoalApprovalCard({
  goal,
  employeeName,
  onGoalUpdate,
  review,
}) {
  const isPerformanceGoal = goal.goalCategory === '業績目標';
  const isCompetencyGoal = goal.goalCategory === 'コンピテンシー';

  // Accessibility and responsive hooks
  const { containerRef } = useKeyboardNavigation({
    enableArrowKeys: false,
    enableTabNavigation: true,
    enableEscapeKey: false
  });
  const { isMobile } = useResponsiveBreakpoint();

  // Generate unique IDs for accessibility
  const cardId = React.useMemo(() => generateAccessibilityId('goal-card'), []);
  const titleId = React.useMemo(() => generateAccessibilityId('goal-title'), []);
  const statusId = React.useMemo(() => generateAccessibilityId('goal-status'), []);

  const competencyNamesForDisplay = React.useMemo(() => {
    return resolveCompetencyNamesForDisplay(
      isCompetencyGoal ? goal.competencyIds : null,
      goal.competencyNames,
    );
  }, [goal.competencyIds, goal.competencyNames, isCompetencyGoal]);

  const resolvedIdealActions = React.useMemo(() => {
    if (!isCompetencyGoal || !goal.selectedIdealActions) return [];

    return Object.entries(goal.selectedIdealActions).map(([competencyId, actionIds]) => {
      const competencyName = goal.competencyNames?.[competencyId] ?? competencyId;
      const resolved = goal.idealActionTexts?.[competencyId];

      return {
        competencyName,
        actions: Array.isArray(resolved) && resolved.length > 0
          ? resolved
          : actionIds.map(actionId => `行動 ${actionId}`),
      };
    });
  }, [goal.competencyNames, goal.idealActionTexts, goal.selectedIdealActions, isCompetencyGoal]);

  const getCategoryIcon = () => {
    if (isPerformanceGoal) {
      return <Target className="h-4 w-4" />;
    }
    if (isCompetencyGoal) {
      return <Brain className="h-4 w-4" />;
    }
    return <Target className="h-4 w-4" />;
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Card
      ref={containerRef as React.Ref<HTMLDivElement>}
      className={`w-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 transition-all ${isMobile ? 'mx-2' : ''}`}
      role="article"
      aria-labelledby={titleId}
      aria-describedby={statusId}
      id={cardId}
    >
      <CardHeader className={`pb-3 ${isMobile ? 'px-3 py-3' : 'pb-3'}`}>
        <div className={`flex items-center ${isMobile ? 'flex-col gap-2' : 'justify-between'}`}>
          <div className="flex items-center gap-2" id={titleId}>
            {getCategoryIcon()}
            <span className="font-medium" role="heading" aria-level={3}>
              {goal.goalCategory}
            </span>
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'self-start' : ''}`} id={statusId}>
            <GoalStatusBadge status={goal.status} />
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Weight className="h-3 w-3" aria-hidden="true" />
              <span aria-label={`目標の重み: ${goal.weight}パーセント`}>{goal.weight}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" aria-hidden="true" />
          <time
            dateTime={goal.createdAt}
            aria-label={`提出日: ${formatDate(goal.createdAt)}`}
          >
            提出日: {formatDate(goal.createdAt)}
          </time>
        </div>
      </CardHeader>

      <CardContent className={`pt-0 ${isMobile ? 'px-3' : 'pt-0'}`}>
        {/* Performance Goal Content */}
        {isPerformanceGoal && (
          <div className="space-y-4">
            {goal.title && (
              <div>
                <h4 className="font-semibold mb-2" role="heading" aria-level={4}>目標タイトル</h4>
                <div className="bg-gray-50 p-3 rounded-md" role="region" aria-labelledby="goal-title-label">
                  <p className="text-sm" id="goal-title-label">{goal.title}</p>
                </div>
              </div>
            )}

            {goal.specificGoalText && (
              <div>
                <h4 className="font-semibold mb-2" role="heading" aria-level={4}>具体的な目標内容</h4>
                <div className="bg-gray-50 p-3 rounded-md" role="region" aria-labelledby="specific-goal-label">
                  <p className="text-sm whitespace-pre-wrap" id="specific-goal-label">{goal.specificGoalText}</p>
                </div>
              </div>
            )}

            {goal.achievementCriteriaText && (
              <div>
                <h4 className="font-semibold mb-2" role="heading" aria-level={4}>達成基準</h4>
                <div className="bg-gray-50 p-3 rounded-md" role="region" aria-labelledby="achievement-criteria-label">
                  <p className="text-sm whitespace-pre-wrap" id="achievement-criteria-label">{goal.achievementCriteriaText}</p>
                </div>
              </div>
            )}

            {goal.meansMethodsText && (
              <div>
                <h4 className="font-semibold mb-2" role="heading" aria-level={4}>方法</h4>
                <div className="bg-gray-50 p-3 rounded-md" role="region" aria-labelledby="methods-label">
                  <p className="text-sm whitespace-pre-wrap" id="methods-label">{goal.meansMethodsText}</p>
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
                <h4 className="font-semibold mb-2" role="heading" aria-level={4}>選択したコンピテンシー</h4>
                <div className="bg-gray-50 p-3 rounded-md" role="region" aria-labelledby="competencies-label">
                  {competencyNamesForDisplay ? (
                    <p className="text-sm" id="competencies-label"
                       aria-label={`選択されたコンピテンシー: ${competencyNamesForDisplay.join(', ')}`}>
                      {competencyNamesForDisplay.join(', ')}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground" id="competencies-label"
                       aria-label={`コンピテンシーID: ${goal.competencyIds.join(', ')}`}>
                      コンピテンシーID: {goal.competencyIds.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {goal.selectedIdealActions && Object.keys(goal.selectedIdealActions).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2" role="heading" aria-level={4}>理想的な行動</h4>
                <div className="bg-gray-50 p-3 rounded-md" role="region" aria-labelledby="ideal-actions-label">
                  <div className="space-y-2" id="ideal-actions-label">
                    {resolvedIdealActions.map((resolved, index) => (
                      <div key={index} className="text-sm" role="group"
                           aria-labelledby={`competency-${index}-title`}>
                        <span className="font-medium" id={`competency-${index}-title`}>
                          {resolved.competencyName}:
                        </span>
                        <ul className="list-disc list-inside ml-2 mt-1"
                            role="list"
                            aria-label={`${resolved.competencyName}の理想的な行動`}>
                          {resolved.actions.map((action, actionIndex) => (
                            <li key={actionIndex} role="listitem">{action}</li>
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
                <h4 className="font-semibold mb-2" role="heading" aria-level={4}>行動計画</h4>
                <div className="bg-gray-50 p-3 rounded-md" role="region" aria-labelledby="action-plan-label">
                  <p className="text-sm whitespace-pre-wrap" id="action-plan-label">{goal.actionPlan}</p>
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
          <div className={`mt-6 pt-4 border-t ${isMobile ? 'mt-4 pt-3' : 'mt-6 pt-4'}`}
               role="region"
               aria-label="目標承認操作">
            <GoalApprovalHandler
              goal={goal}
              employeeName={employeeName}
              onSuccess={onGoalUpdate}
              review={review}
            />
          </div>
        )}

        {/* Remand Handler - Only show for approved goals */}
        {goal.status === 'approved' && (
          <div className={`mt-6 pt-4 border-t ${isMobile ? 'mt-4 pt-3' : 'mt-6 pt-4'}`}
               role="region"
               aria-label="目標差戻し操作">
            <GoalRemandHandler
              goal={goal}
              employeeName={employeeName}
              onSuccess={onGoalUpdate}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});
