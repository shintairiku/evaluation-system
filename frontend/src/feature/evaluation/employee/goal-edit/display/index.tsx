'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Send, Loader2 } from 'lucide-react';
import { SupervisorFeedbackBanner } from '../components/SupervisorFeedbackBanner';
import { useGoalEdit } from '../hooks/useGoalEdit';
import { GoalStatusBadge } from '@/components/evaluation/GoalStatusBadge';
import type { UUID } from '@/api/types';

/**
 * Goal Edit Display Component
 *
 * This page allows employees to edit a single goal (typically a rejected or draft goal).
 * It provides:
 * - Supervisor feedback banner (if goal was rejected)
 * - Form to edit goal details
 * - Save (keep as draft) and Submit (for review) actions
 *
 * URL: /goal-edit/{goalId}
 */
export default function GoalEditDisplay() {
  const params = useParams();
  const router = useRouter();
  const goalId = params?.goalId as UUID;

  const {
    goal,
    supervisorReview,
    isLoading,
    error,
    saveDraft,
    submitGoal,
    isSaving,
  } = useGoalEdit(goalId);

  // Form state for performance goals
  const [performanceFormData, setPerformanceFormData] = useState({
    title: '',
    specificGoalText: '',
    achievementCriteriaText: '',
    meansMethodsText: '',
    performanceGoalType: 'quantitative' as 'quantitative' | 'qualitative',
  });

  // Form state for competency goals
  const [competencyFormData, setCompetencyFormData] = useState({
    actionPlan: '',
  });

  // Load goal data into form when goal is loaded
  useEffect(() => {
    if (!goal) return;

    if (goal.goalCategory === '業績目標') {
      setPerformanceFormData({
        title: goal.title || '',
        specificGoalText: goal.specificGoalText || '',
        achievementCriteriaText: goal.achievementCriteriaText || '',
        meansMethodsText: goal.meansMethodsText || '',
        performanceGoalType: goal.performanceGoalType || 'quantitative',
      });
    } else if (goal.goalCategory === 'コンピテンシー') {
      setCompetencyFormData({
        actionPlan: goal.actionPlan || '',
      });
    }
  }, [goal]);

  // Handle save as draft
  const handleSave = async () => {
    if (!goal) return;

    // For performance goals, include the performanceGoalType from original goal
    // (it's required by backend but not editable in the form)
    const goalData = goal.goalCategory === '業績目標'
      ? {
          ...performanceFormData,
          performanceGoalType: goal.performanceGoalType || 'quantitative', // Keep original value
        }
      : competencyFormData;

    const success = await saveDraft(goalData);
    if (success) {
      alert('保存しました');
    }
  };

  // Handle submit for review
  const handleSubmit = async () => {
    if (!goal) return;

    // For performance goals, include the performanceGoalType from original goal
    // (it's required by backend but not editable in the form)
    const goalData = goal.goalCategory === '業績目標'
      ? {
          ...performanceFormData,
          performanceGoalType: goal.performanceGoalType || 'quantitative', // Keep original value
        }
      : competencyFormData;

    const success = await submitGoal(goalData);
    if (success) {
      router.push('/goal-list');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !goal) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {error || '目標が見つかりませんでした'}
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => router.push('/goal-list')}
          variant="outline"
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          目標一覧に戻る
        </Button>
      </div>
    );
  }

  const isPerformanceGoal = goal.goalCategory === '業績目標';

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => router.push('/goal-list')}
          variant="ghost"
          size="sm"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          目標一覧に戻る
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">目標を編集</h1>
            <p className="text-muted-foreground mt-1">
              {goal.goalCategory} - {isPerformanceGoal ? performanceFormData.title || '無題の目標' : 'コンピテンシー目標'}
            </p>
          </div>
          <GoalStatusBadge status={goal.status} />
        </div>
      </div>

      {/* Supervisor Feedback Banner */}
      <SupervisorFeedbackBanner
        supervisorReview={supervisorReview}
        goalStatus={goal.status}
        className="mb-6"
      />

      {/* Goal Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>{goal.goalCategory}の編集</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Performance Goal Form */}
          {isPerformanceGoal && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  目標タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={performanceFormData.title}
                  onChange={(e) => setPerformanceFormData({ ...performanceFormData, title: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  placeholder="目標のタイトルを入力"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  具体的な目標内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={performanceFormData.specificGoalText}
                  onChange={(e) => setPerformanceFormData({ ...performanceFormData, specificGoalText: e.target.value })}
                  className="w-full p-2 border rounded-md min-h-[100px]"
                  placeholder="具体的な目標内容を入力"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  達成基準 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={performanceFormData.achievementCriteriaText}
                  onChange={(e) => setPerformanceFormData({ ...performanceFormData, achievementCriteriaText: e.target.value })}
                  className="w-full p-2 border rounded-md min-h-[100px]"
                  placeholder="達成基準を入力"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  方法
                </label>
                <textarea
                  value={performanceFormData.meansMethodsText}
                  onChange={(e) => setPerformanceFormData({ ...performanceFormData, meansMethodsText: e.target.value })}
                  className="w-full p-2 border rounded-md min-h-[100px]"
                  placeholder="方法を入力"
                />
              </div>
            </>
          )}

          {/* Competency Goal Form */}
          {!isPerformanceGoal && (
            <div>
              <label className="block text-sm font-medium mb-2">
                行動計画 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={competencyFormData.actionPlan}
                onChange={(e) => setCompetencyFormData({ ...competencyFormData, actionPlan: e.target.value })}
                className="w-full p-2 border rounded-md min-h-[200px]"
                placeholder="行動計画を入力"
              />
              <p className="text-sm text-muted-foreground mt-2">
                ※ 選択したコンピテンシーと理想的な行動は編集できません。変更が必要な場合は新しい目標を作成してください。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mt-6">
        <Button
          onClick={handleSave}
          variant="outline"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              下書き保存
            </>
          )}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              提出中...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {goal.status === 'rejected' ? '再提出' : '提出'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
