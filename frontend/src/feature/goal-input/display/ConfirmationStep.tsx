'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Brain, ChevronLeft, Send, Target } from 'lucide-react';
import { toast } from 'sonner';
import { submitGoalAction, getGoalsAction } from '@/api/server-actions/goals';
import { getCompetenciesAction } from '@/api/server-actions/competencies';
import { Competency } from '@/api/types/competency';
import { GoalStatusBadge } from '@/components/evaluation/GoalStatusBadge';
import type { UserStatus } from '@/api/types';
import { getGoalSubmissionRestriction } from '@/utils/goal-submission';
import type { StageWeightBudget, ReadOnlyGoals } from '../types';

interface PerformanceGoal {
  id: string;
  type: 'quantitative' | 'qualitative';
  title: string;
  specificGoal: string;
  achievementCriteria: string;
  method: string;
  weight: number;
}

interface CompetencyGoal {
  id: string;
  competencyIds?: string[] | null;
  selectedIdealActions?: Record<string, string[]> | null;
  actionPlan: string;
}

interface ConfirmationStepProps {
  performanceGoals: PerformanceGoal[];
  competencyGoals: CompetencyGoal[];
  readOnlyGoals?: ReadOnlyGoals | null;
  periodId?: string;
  currentUserId?: string;
  currentUserStatus?: UserStatus;
  onPrevious: () => void;
  stageBudgets?: StageWeightBudget;
  userStageId?: string;
}

export function ConfirmationStep(props: ConfirmationStepProps) {
  const { performanceGoals, competencyGoals, readOnlyGoals, periodId, currentUserId, currentUserStatus, onPrevious, userStageId } = props;
  const router = useRouter();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [isLoadingCompetencies, setIsLoadingCompetencies] = useState(false);
  const [competencyError, setCompetencyError] = useState<string | null>(null);
  const submissionRestriction = getGoalSubmissionRestriction(currentUserStatus);
  const isSubmissionBlocked = Boolean(submissionRestriction);

  useEffect(() => {
    let isActive = true;
    const loadCompetencies = async () => {
      try {
        setIsLoadingCompetencies(true);
        setCompetencyError(null);
        const result = await getCompetenciesAction({
          limit: 100,
          stageId: userStageId,
        });

        if (!isActive) return;

        if (result.success && result.data?.items) {
          setCompetencies(result.data.items);
        } else {
          setCompetencyError(result.error || 'コンピテンシーを読み込めませんでした。');
        }
      } catch (error) {
        if (isActive) {
          setCompetencyError('コンピテンシーを読み込めませんでした。');
        }
      } finally {
        if (isActive) {
          setIsLoadingCompetencies(false);
        }
      }
    };

    loadCompetencies();
    return () => {
      isActive = false;
    };
  }, [userStageId]);

  const handleSubmit = () => {
    startTransition(async () => {
      if (submissionRestriction) {
        toast.error(submissionRestriction.title, {
          description: submissionRestriction.description,
        });
        return;
      }

      if (!periodId) {
        toast.error('評価期間が選択されていません。');
        return;
      }

      try {
        // Fetch ALL goals (including submitted/approved) for weight validation
        const allGoalsResult = await getGoalsAction({
          periodId,
          userId: currentUserId,
          status: ['draft', 'submitted', 'approved', 'rejected']
        });

        const allGoals = allGoalsResult.success ? allGoalsResult.data?.items || [] : [];

        // Only submit draft/rejected goals
        const submittableGoals = allGoals.filter(g => g.status === 'draft' || g.status === 'rejected');

        if (submittableGoals.length === 0) {
          toast.error('提出する目標が見つかりません。');
          return;
        }

        // Validate TOTAL weight across ALL performance goals (submitted + draft) = 100%
        const allPerformanceGoals = allGoals.filter(g => g.goalCategory === '業績目標');
        const totalWeight = allPerformanceGoals.reduce((sum, goal) => sum + goal.weight, 0);

        if (totalWeight !== 100) {
          toast.error(`業績目標の合計ウェイトは100%である必要があります。現在の合計: ${totalWeight}%`);
          return;
        }

        let allSubmitted = true;
        const submitErrors: string[] = [];

        // Submit only draft/rejected goals
        for (const goal of submittableGoals) {
          const result = await submitGoalAction(goal.id, 'submitted');
          if (!result.success) {
            allSubmitted = false;
            submitErrors.push(`${goal.goalCategory}目標の提出に失敗: ${result.error}`);
          }
        }

        setShowSubmitDialog(false);
        if (allSubmitted) {
          toast.success('目標が正常に提出されました。承認をお待ちください。');
          router.push('/goal-list');
        } else {
          toast.error(submitErrors.join(', ') || '提出に失敗しました。やり直してください。');
        }
      } catch (error) {
        setShowSubmitDialog(false);
        toast.error(error instanceof Error ? error.message : '提出に失敗しました。やり直してください。');
      }
    });
  };

  const readOnlyPerfWeight = readOnlyGoals?.performanceGoals?.reduce((sum, g) => sum + g.weight, 0) ?? 0;
  const editablePerfWeight = performanceGoals.reduce((sum, goal) => sum + goal.weight, 0);
  const performanceTotal = readOnlyPerfWeight + editablePerfWeight;

  const competencyGoal = competencyGoals[0];
  const selectedCompetencyIds = competencyGoal?.competencyIds ?? [];
  const selectedCompetencies = selectedCompetencyIds
    .map(id => competencies.find(comp => comp.id === id))
    .filter(Boolean) as Competency[];

  const hasReadOnlyGoals = readOnlyGoals && (readOnlyGoals.performanceGoals.length > 0 || readOnlyGoals.competencyGoals.length > 0);

  return (
    <div className="space-y-6">
      {/* 業績目標サマリー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            業績目標
            <Badge variant="default">{performanceTotal}%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Read-only performance goals */}
            {readOnlyGoals?.performanceGoals?.map((goal) => (
              <div key={goal.id} className="border rounded-lg p-4 bg-gray-100 border-gray-300">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-600">{goal.title}</h4>
                  <div className="flex gap-2">
                    <GoalStatusBadge status={goal.status} />
                    <Badge variant="outline">
                      {goal.type === 'quantitative' ? '定量的' : '定性的'}
                    </Badge>
                    <Badge variant="secondary">{goal.weight}%</Badge>
                  </div>
                </div>
                <div className="text-sm text-gray-500 space-y-1">
                  <p><strong>具体的目標:</strong> {goal.specificGoal}</p>
                  <p><strong>達成基準:</strong> <span className="whitespace-pre-wrap">{goal.achievementCriteria}</span></p>
                  <p><strong>実行方法:</strong> {goal.method}</p>
                </div>
              </div>
            ))}
            {/* Editable (new) performance goals */}
            {performanceGoals.map((goal) => (
              <div key={goal.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {hasReadOnlyGoals && (
                      <Badge variant="outline" className="border-blue-500 text-blue-700">新規</Badge>
                    )}
                    <h4 className="font-medium">{goal.title}</h4>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {goal.type === 'quantitative' ? '定量的' : '定性的'}
                    </Badge>
                    <Badge variant="secondary">{goal.weight}%</Badge>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>具体的目標:</strong> {goal.specificGoal}</p>
                  <p><strong>達成基準:</strong> <span className="whitespace-pre-wrap">{goal.achievementCriteria}</span></p>
                  <p><strong>実行方法:</strong> {goal.method}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* コンピテンシー目標サマリー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            コンピテンシー目標
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Read-only competency goal */}
          {readOnlyGoals?.competencyGoals?.[0] && (
            <div className="border rounded-lg p-4 bg-gray-100 border-gray-300 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <GoalStatusBadge status={readOnlyGoals.competencyGoals[0].status} />
              </div>
              {readOnlyGoals.competencyGoals[0].actionPlan && (
                <div className="text-sm text-gray-500">
                  <p><strong>アクションプラン:</strong></p>
                  <p className="whitespace-pre-line">{readOnlyGoals.competencyGoals[0].actionPlan}</p>
                </div>
              )}
            </div>
          )}

          {/* Editable competency goal */}
          {competencyGoal && competencyGoal.actionPlan ? (
            <div className="space-y-4">
              {hasReadOnlyGoals && readOnlyGoals?.competencyGoals?.length === 0 && (
                <Badge variant="outline" className="border-blue-500 text-blue-700 mb-2">新規</Badge>
              )}
              {/* Selected Competencies */}
              {selectedCompetencyIds.length > 0 && (
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3">選択されたコンピテンシー</h4>
                  {isLoadingCompetencies ? (
                    <p className="text-sm text-muted-foreground">コンピテンシーを読み込み中...</p>
                  ) : selectedCompetencies.length > 0 ? (
                    <div className="space-y-3">
                      {selectedCompetencies.map(competency => {
                        const selectedActions = competencyGoal.selectedIdealActions?.[competency.id] || [];

                        return (
                          <div key={competency.id} className="border rounded-lg p-3 bg-white">
                            <div className="font-medium text-gray-900 mb-2">{competency.name}</div>

                            {selectedActions.length > 0 && (
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-700 mb-2">選択された理想的行動:</div>
                                <div className="space-y-1">
                                  {selectedActions.map(actionKey => (
                                    <div key={actionKey} className="text-sm text-gray-600">
                                      <span className="font-medium">{actionKey}.</span> {competency.description?.[actionKey] ?? '（説明未設定）'}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>選択されたコンピテンシーの詳細を表示できませんでした。</p>
                      {competencyError && <p>{competencyError}</p>}
                      <div className="space-y-1">
                        {selectedCompetencyIds.map(id => (
                          <div key={id} className="text-xs text-muted-foreground">ID: {id}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Plan */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-medium mb-2">アクションプラン</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {competencyGoal.actionPlan}
                </p>
              </div>
            </div>
          ) : !readOnlyGoals?.competencyGoals?.[0] ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>コンピテンシー目標が設定されていません</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {submissionRestriction && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">{submissionRestriction.title}</AlertTitle>
          <AlertDescription className="text-amber-800">
            {submissionRestriction.description}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="flex gap-2 col-span-1">
          <Button onClick={onPrevious} variant="outline">
            <ChevronLeft className="h-4 w-4 mr-2" />
            前に戻る
          </Button>
        </div>
        <div className="flex gap-2 col-span-2 justify-end">
          <Button
            onClick={() => setShowSubmitDialog(true)}
            disabled={isPending || isSubmissionBlocked}
            size="lg"
            >
            <Send className="h-4 w-4 mr-2" />
            提出する
          </Button>
        </div>
      </div>

      {/* 提出確認ダイアログ */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>目標を提出しますか？</DialogTitle>
            <DialogDescription>
              提出後は上司の承認を待つ状態になります。承認前であれば編集は可能です。
            </DialogDescription>
          </DialogHeader>
          {submissionRestriction && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">{submissionRestriction.title}</AlertTitle>
              <AlertDescription className="text-amber-800">
                {submissionRestriction.description}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || isSubmissionBlocked}
            >
              {isPending ? '提出中...' : '提出する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
