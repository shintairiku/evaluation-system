'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, Loader2, Send } from 'lucide-react';
import { SupervisorFeedbackBanner } from '../components/SupervisorFeedbackBanner';
import { useGoalEdit } from '../hooks/useGoalEdit';
import { useGoalAutoSave } from '../hooks/useGoalAutoSave';
import { GoalStatusBadge } from '@/components/evaluation/GoalStatusBadge';
import { CompetencyAccordion } from '@/components/competency/CompetencyAccordion';
import { useCurrentUserContext } from '@/context/CurrentUserContext';
import { getGoalSubmissionRestriction } from '@/utils/goal-submission';
import { getCompetenciesAction } from '@/api/server-actions/competencies';
import type { Competency } from '@/api/types/competency';
import type { UUID, GoalUpdateRequest } from '@/api/types';

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
  const currentUserContext = useCurrentUserContext();
  const submissionRestriction = getGoalSubmissionRestriction(currentUserContext.user?.status);
  const isSubmissionBlocked = Boolean(submissionRestriction);

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
    competencyIds: [] as string[],
    selectedIdealActions: {} as Record<string, string[]>,
    actionPlan: '',
  });

  // Competency loading state
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [isLoadingCompetencies, setIsLoadingCompetencies] = useState(true);

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
        competencyIds: goal.competencyIds || [],
        selectedIdealActions: goal.selectedIdealActions || {},
        actionPlan: goal.actionPlan || '',
      });
    }
  }, [goal]);

  // Determine if current goal is performance goal
  const isPerformanceGoal = goal?.goalCategory === '業績目標';

  // Load competencies from server for competency goals
  const userStageId = currentUserContext.user?.stage?.id;
  useEffect(() => {
    if (isPerformanceGoal) return;
    if (!userStageId) return;

    const loadCompetencies = async () => {
      try {
        setIsLoadingCompetencies(true);
        const result = await getCompetenciesAction({ limit: 100, stageId: userStageId });
        if (result.success && result.data?.items) {
          setCompetencies(result.data.items);
        }
      } catch (error) {
        console.error('Error loading competencies:', error);
      } finally {
        setIsLoadingCompetencies(false);
      }
    };

    loadCompetencies();
  }, [isPerformanceGoal, userStageId]);

  // Get current form data based on goal type
  const getFormData = useCallback((): GoalUpdateRequest => {
    if (isPerformanceGoal) {
      return {
        ...performanceFormData,
        performanceGoalType: goal?.performanceGoalType || 'quantitative'
      };
    } else {
      return {
        competencyIds: competencyFormData.competencyIds.length > 0
          ? competencyFormData.competencyIds : null,
        selectedIdealActions: Object.keys(competencyFormData.selectedIdealActions).length > 0
          ? competencyFormData.selectedIdealActions : null,
        actionPlan: competencyFormData.actionPlan,
      };
    }
  }, [isPerformanceGoal, performanceFormData, competencyFormData, goal?.performanceGoalType]);

  // Set form data from auto-save
  const setFormData = useCallback((data: Partial<GoalUpdateRequest>) => {
    if (isPerformanceGoal) {
      setPerformanceFormData(prev => ({ ...prev, ...data }));
    } else {
      setCompetencyFormData(prev => ({
        ...prev,
        ...('competencyIds' in data ? { competencyIds: data.competencyIds || [] } : {}),
        ...('selectedIdealActions' in data ? { selectedIdealActions: data.selectedIdealActions || {} } : {}),
        ...('actionPlan' in data ? { actionPlan: data.actionPlan || '' } : {}),
      }));
    }
  }, [isPerformanceGoal]);

  // Auto-save hook
  const { saveStatus, debouncedSave, save: autoSave } = useGoalAutoSave({
    goalId: goal?.id,
    getFormData,
    setFormData
  });

  // Helper function for performance goal field changes
  const handlePerformanceFieldChange = useCallback((field: keyof typeof performanceFormData, value: string) => {
    const newData = { ...performanceFormData, [field]: value };
    setPerformanceFormData(newData);
    debouncedSave({ ...newData, performanceGoalType: goal?.performanceGoalType || 'quantitative' });
  }, [performanceFormData, debouncedSave, goal?.performanceGoalType]);

  // Helper function for competency action plan changes
  const handleActionPlanChange = useCallback((value: string) => {
    const newData = { ...competencyFormData, actionPlan: value };
    setCompetencyFormData(newData);
    debouncedSave({
      competencyIds: newData.competencyIds.length > 0 ? newData.competencyIds : null,
      selectedIdealActions: Object.keys(newData.selectedIdealActions).length > 0 ? newData.selectedIdealActions : null,
      actionPlan: newData.actionPlan,
    });
  }, [competencyFormData, debouncedSave]);

  // Helper to build save payload from competency form data
  const buildCompetencySavePayload = useCallback((data: typeof competencyFormData) => ({
    competencyIds: data.competencyIds.length > 0 ? data.competencyIds : null,
    selectedIdealActions: Object.keys(data.selectedIdealActions).length > 0 ? data.selectedIdealActions : null,
    actionPlan: data.actionPlan,
  }), []);

  // Competency selection handler
  const handleCompetencySelect = useCallback((competencyId: string, checked: boolean) => {
    const newIds = checked
      ? [...competencyFormData.competencyIds, competencyId]
      : competencyFormData.competencyIds.filter(id => id !== competencyId);
    const newActions = { ...competencyFormData.selectedIdealActions };
    if (!checked) delete newActions[competencyId];

    const updated = { ...competencyFormData, competencyIds: newIds, selectedIdealActions: newActions };
    setCompetencyFormData(updated);
    debouncedSave(buildCompetencySavePayload(updated));
  }, [competencyFormData, debouncedSave, buildCompetencySavePayload]);

  // Ideal action selection handler
  const handleIdealActionSelect = useCallback((competencyId: string, actionKey: string, checked: boolean) => {
    if (!competencyFormData.competencyIds.includes(competencyId)) return;

    const currentActions = competencyFormData.selectedIdealActions[competencyId] || [];
    const newActions = checked
      ? [...currentActions, actionKey]
      : currentActions.filter(key => key !== actionKey);

    const newSelectedActions = { ...competencyFormData.selectedIdealActions };
    if (newActions.length === 0) {
      delete newSelectedActions[competencyId];
    } else {
      newSelectedActions[competencyId] = newActions;
    }

    const updated = { ...competencyFormData, selectedIdealActions: newSelectedActions };
    setCompetencyFormData(updated);
    debouncedSave(buildCompetencySavePayload(updated));
  }, [competencyFormData, debouncedSave, buildCompetencySavePayload]);

  // Handle submit for review
  const handleSubmit = async () => {
    if (!goal) return;
    if (isSubmissionBlocked) return;

    const success = await submitGoal(getFormData());
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
          <CardTitle className="flex items-center justify-between">
            <span>{goal.goalCategory}の編集</span>
            {/* Auto-save status indicator */}
            {saveStatus === 'saving' && (
              <span className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" aria-hidden="true" />
                保存中...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span aria-hidden="true">✓</span> 一時保存済み
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <span aria-hidden="true">⚠</span> 保存失敗
              </span>
            )}
          </CardTitle>
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
                  onChange={(e) => handlePerformanceFieldChange('title', e.target.value)}
                  onBlur={() => autoSave(getFormData())}
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
                  onChange={(e) => handlePerformanceFieldChange('specificGoalText', e.target.value)}
                  onBlur={() => autoSave(getFormData())}
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
                  onChange={(e) => handlePerformanceFieldChange('achievementCriteriaText', e.target.value)}
                  onBlur={() => autoSave(getFormData())}
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
                  onChange={(e) => handlePerformanceFieldChange('meansMethodsText', e.target.value)}
                  onBlur={() => autoSave(getFormData())}
                  className="w-full p-2 border rounded-md min-h-[100px]"
                  placeholder="方法を入力"
                />
              </div>
            </>
          )}

          {/* Competency Goal Form */}
          {!isPerformanceGoal && (
            <div className="space-y-6">
              {/* Competency Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">コンピテンシーの選択 (任意)</Label>

                {isLoadingCompetencies ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">コンピテンシーを読み込み中...</p>
                    </div>
                  </div>
                ) : (
                  <CompetencyAccordion
                    competencies={competencies}
                    selectedCompetencyIds={competencyFormData.competencyIds}
                    selectedIdealActions={competencyFormData.selectedIdealActions}
                    onCompetencySelect={handleCompetencySelect}
                    onIdealActionSelect={handleIdealActionSelect}
                    showSelection={true}
                    showEditButtons={false}
                    editMode={false}
                  />
                )}
              </div>

              {/* Selection Summary */}
              {competencyFormData.competencyIds.length > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-base text-blue-900">選択中のコンピテンシー</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {competencyFormData.competencyIds.map(competencyId => {
                        const competency = competencies.find(c => c.id === competencyId);
                        const selectedActionKeys = competencyFormData.selectedIdealActions[competencyId] || [];

                        return (
                          <div key={competencyId} className="text-sm space-y-1">
                            <div className="font-medium text-blue-900">
                              {competency?.name}: {selectedActionKeys.length}個選択
                            </div>
                            {selectedActionKeys.length > 0 && (
                              <div className="ml-4 space-y-1">
                                {selectedActionKeys.map(actionKey => {
                                  const actionText = competency?.description?.[actionKey];
                                  return actionText ? (
                                    <div key={actionKey} className="text-blue-700">
                                      - {actionText}
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Plan */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  行動計画 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={competencyFormData.actionPlan}
                  onChange={(e) => handleActionPlanChange(e.target.value)}
                  onBlur={() => autoSave(getFormData())}
                  className="w-full p-2 border rounded-md min-h-[200px]"
                  placeholder="行動計画を入力"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {submissionRestriction && (
        <Alert className="mt-6 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">{submissionRestriction.title}</AlertTitle>
          <AlertDescription className="text-amber-800">
            {submissionRestriction.description}
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end mt-6">
        <Button
          onClick={handleSubmit}
          disabled={isSaving || isSubmissionBlocked}
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
