'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, Send, Target, Brain, Save } from 'lucide-react';
import stage1Competencies from '../data/stage1-competencies.json';
import { toast } from 'sonner';
import { createGoalAction, updateGoalAction, submitGoalAction, getGoalsAction } from '@/api/server-actions/goals';
import type { GoalCreateRequest, GoalUpdateRequest } from '@/api/types/goal';

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
  selectedCompetencyId: string;
  actionPlan: string;
}

interface ConfirmationStepProps {
  performanceGoals: PerformanceGoal[];
  competencyGoals: CompetencyGoal[];
  periodId?: string;
  onPrevious: () => void;
}

export function ConfirmationStep({ performanceGoals, competencyGoals, periodId, onPrevious }: ConfirmationStepProps) {
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDraftPending, startDraftTransition] = useTransition();
  
  // Helper function to save or update goals as drafts
  const saveGoalsAsDraft = async () => {
    if (!periodId) return { success: false, error: '評価期間が選択されていません。' };
    
    try {
      // Get existing goals to determine create vs update
      const existingGoalsResult = await getGoalsAction({ 
        periodId,
        status: 'incomplete'
      });

      const existingGoals = existingGoalsResult.success ? existingGoalsResult.data?.items || [] : [];
      const existingPerformanceGoals = existingGoals.filter(g => g.goalCategory === '業績目標');
      const existingCompetencyGoals = existingGoals.filter(g => g.goalCategory === 'コンピテンシー');

      let allSuccessful = true;
      const errors: string[] = [];

      // Handle performance goals
      for (let i = 0; i < performanceGoals.length; i++) {
        const pg = performanceGoals[i];
        const existingGoal = existingPerformanceGoals[i];

        if (existingGoal) {
          // Performance goal update - only include performance fields
          const updateData: GoalUpdateRequest = {
            weight: pg.weight,
            title: pg.title,
            performanceGoalType: pg.type,
            specificGoalText: pg.specificGoal,
            achievementCriteriaText: pg.achievementCriteria,
            meansMethodsText: pg.method,
          };
          const result = await updateGoalAction(existingGoal.id, updateData);
          if (!result.success) {
            allSuccessful = false;
            errors.push(`業績目標${i + 1}の更新に失敗: ${result.error}`);
          }
        } else {
          const createData: GoalCreateRequest = {
            periodId,
            goalCategory: '業績目標',
            status: 'draft', // Set status to 'draft' for draft save
            title: pg.title,
            performanceGoalType: pg.type,
            specificGoalText: pg.specificGoal,
            achievementCriteriaText: pg.achievementCriteria,
            meansMethodsText: pg.method,
            weight: pg.weight,
          };
          const result = await createGoalAction(createData);
          if (!result.success) {
            allSuccessful = false;
            errors.push(`業績目標${i + 1}の作成に失敗: ${result.error}`);
          }
        }
      }

      // Handle competency goal
      if (competencyGoals.length > 0) {
        const competencyGoal = competencyGoals[0];
        const existingCompetencyGoal = existingCompetencyGoals[0];

        if (existingCompetencyGoal) {
          // Competency goal update - only include competency fields
          const updateData: GoalUpdateRequest = {
            competencyId: competencyGoal.selectedCompetencyId,
            actionPlan: competencyGoal.actionPlan,
          };
          const result = await updateGoalAction(existingCompetencyGoal.id, updateData);
          if (!result.success) {
            allSuccessful = false;
            errors.push(`コンピテンシー目標の更新に失敗: ${result.error}`);
          }
        } else {
          const createData: GoalCreateRequest = {
            periodId,
            goalCategory: 'コンピテンシー',
            status: 'draft', // Set status to 'draft' for draft save
            weight: 100,
            competencyId: competencyGoal.selectedCompetencyId,
            actionPlan: competencyGoal.actionPlan,
          };
          const result = await createGoalAction(createData);
          if (!result.success) {
            allSuccessful = false;
            errors.push(`コンピテンシー目標の作成に失敗: ${result.error}`);
          }
        }
      }

      return {
        success: allSuccessful,
        error: errors.length > 0 ? errors.join(', ') : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存に失敗しました。'
      };
    }
  };

  const handleSubmit = () => {
    startTransition(async () => {
      if (!periodId) {
        toast.error('評価期間が選択されていません。');
        return;
      }
      
      try {
        // First save/update goals as drafts
        const saveResult = await saveGoalsAsDraft();
        if (!saveResult.success) {
          toast.error(saveResult.error || '目標の保存に失敗しました。');
          return;
        }

        // Then get all goals and submit them
        const goalsResult = await getGoalsAction({ 
          periodId,
          status: 'draft' // Get draft goals for submission
        });

        if (!goalsResult.success || !goalsResult.data) {
          toast.error('目標の取得に失敗しました。');
          return;
        }

        const goals = goalsResult.data.items;
        let allSubmitted = true;
        const submitErrors: string[] = [];

        // Submit each goal individually (changes status to 'pending_approval')
        for (const goal of goals) {
          const result = await submitGoalAction(goal.id);
          if (!result.success) {
            allSubmitted = false;
            submitErrors.push(`${goal.goalCategory}目標の提出に失敗: ${result.error}`);
          }
        }

        setShowSubmitDialog(false);
        if (allSubmitted) {
          toast.success('目標が正常に提出されました。承認をお待ちください。');
        } else {
          toast.error(submitErrors.join(', ') || '提出に失敗しました。やり直してください。');
        }
      } catch (error) {
        setShowSubmitDialog(false);
        toast.error(error instanceof Error ? error.message : '提出に失敗しました。やり直してください。');
      }
    });
  };

  const performanceTotal = performanceGoals.reduce((sum, goal) => sum + goal.weight, 0);
  
  const getSelectedCompetency = () => {
    if (competencyGoals.length === 0) return null;
    return stage1Competencies.competencies.find(
      comp => comp.id === competencyGoals[0].selectedCompetencyId
    );
  };

  const selectedCompetency = getSelectedCompetency();

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
            {performanceGoals.map((goal) => (
              <div key={goal.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{goal.title}</h4>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {goal.type === 'quantitative' ? '定量的' : '定性的'}
                    </Badge>
                    <Badge variant="secondary">{goal.weight}%</Badge>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>具体的目標:</strong> {goal.specificGoal}</p>
                  <p><strong>達成基準:</strong> {goal.achievementCriteria}</p>
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
          {selectedCompetency ? (
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{selectedCompetency.title}</h4>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <div>
                  <strong>説明:</strong>
                  <p className="mt-1 whitespace-pre-line">{selectedCompetency.description}</p>
                </div>
                <div>
                  <strong>アクションプラン:</strong>
                  <p className="mt-1 whitespace-pre-line">{competencyGoals[0].actionPlan}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>コンピテンシー目標が選択されていません</p>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex gap-2 col-span-1">
          <Button onClick={onPrevious} variant="outline">
            <ChevronLeft className="h-4 w-4 mr-2" />
            前に戻る
          </Button>
        </div>
        <div className="flex gap-2 col-span-2 justify-end">
          <Button variant="outline" disabled={isDraftPending || isPending} onClick={() => {
            startDraftTransition(async () => {
              if (competencyGoals.length === 0 || !competencyGoals[0].selectedCompetencyId) {
                toast.error('コンピテンシー目標を入力してください。');
                return;
              }
              const result = await saveGoalsAsDraft();
              if (result.success) {
                toast.success('下書きとして保存しました。');
              } else {
                toast.error(result.error || '保存に失敗しました。');
              }
            });
          }}>
            <Save className="h-4 w-4 mr-2" />
            {isDraftPending ? '保存中...' : '下書き保存'}
          </Button>
          <Button
            onClick={() => setShowSubmitDialog(true)}
            disabled={isDraftPending || isPending}
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
              disabled={isPending}
            >
              {isPending ? '提出中...' : '提出する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}