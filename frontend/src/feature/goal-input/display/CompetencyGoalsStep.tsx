'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { Competency } from '@/api/types/competency';
import { CompetencyAccordion } from '@/components/competency/CompetencyAccordion';
import { getCompetenciesAction } from '@/api/server-actions/competencies';
import type { StageWeightBudget } from '../types';
import type { UseGoalTrackingReturn } from '@/hooks/useGoalTracking';

interface CompetencyGoal {
  id: string;
  competencyIds?: string[] | null;
  selectedIdealActions?: Record<string, string[]> | null;
  actionPlan: string;
}

interface CompetencyGoalsStepProps {
  goals: CompetencyGoal[];
  onGoalsChange: (goals: CompetencyGoal[]) => void;
  goalTracking?: UseGoalTrackingReturn;
  onNext: () => void;
  onPrevious: () => void;
  periodId?: string;
  stageBudgets: StageWeightBudget;
  userStageId?: string;
}

export function CompetencyGoalsStep({
  goals,
  onGoalsChange,
  goalTracking,
  onNext,
  onPrevious,
  stageBudgets,
  userStageId
}: CompetencyGoalsStepProps) {
  // Derive values directly from props to avoid local-state divergence
  const currentGoal = goals[0];
  const selectedCompetencyIds = currentGoal?.competencyIds || [];
  const selectedIdealActions = currentGoal?.selectedIdealActions || {};
  const actionPlan = currentGoal?.actionPlan || '';
  
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [isLoadingCompetencies, setIsLoadingCompetencies] = useState(true);
  const [competencyError, setCompetencyError] = useState<string | null>(null);
  const currentGoalRef = useRef<CompetencyGoal | null>(null);
  const draftGoalRef = useRef<CompetencyGoal | null>(null);
  const tempGoalIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentGoalRef.current = currentGoal ?? null;
    if (currentGoal?.id) {
      tempGoalIdRef.current = currentGoal.id;
      draftGoalRef.current = currentGoal;
    }
  }, [currentGoal]);

  // Load competencies from server on component mount
  useEffect(() => {
    const loadCompetencies = async () => {
      try {
        setIsLoadingCompetencies(true);
        setCompetencyError(null);
        
        // Filter competencies by user's stage
        // For admin users, explicitly pass stageId to avoid seeing all stages
        const result = await getCompetenciesAction({
          limit: 100,
          stageId: userStageId
        });
        
        if (result.success && result.data?.items) {
          setCompetencies(result.data.items);
        } else {
          setCompetencyError(result.error || 'Failed to load competencies');
        }
      } catch (error) {
        setCompetencyError('Failed to load competencies');
        console.error('Error loading competencies:', error);
      } finally {
        setIsLoadingCompetencies(false);
      }
    };

    loadCompetencies();
  }, [userStageId]);

  const updateGoal = (patch: Partial<CompetencyGoal>) => {
    const baseGoal = draftGoalRef.current ?? currentGoalRef.current ?? (() => {
      const id = tempGoalIdRef.current ?? Date.now().toString();
      tempGoalIdRef.current = id;
      return {
        id,
        competencyIds: null,
        selectedIdealActions: null,
        actionPlan: '',
      };
    })();

    const updatedGoal: CompetencyGoal = {
      id: baseGoal.id,
      competencyIds: baseGoal.competencyIds ?? null,
      selectedIdealActions: baseGoal.selectedIdealActions ?? null,
      actionPlan: baseGoal.actionPlan ?? '',
      ...patch,
    };

    if (!updatedGoal.competencyIds || updatedGoal.competencyIds.length === 0) {
      updatedGoal.competencyIds = null;
    }
    if (!updatedGoal.selectedIdealActions || Object.keys(updatedGoal.selectedIdealActions).length === 0) {
      updatedGoal.selectedIdealActions = null;
    }

    draftGoalRef.current = updatedGoal;
    onGoalsChange([updatedGoal]);

    if (goalTracking) {
      goalTracking.trackGoalChange(updatedGoal.id, 'competency', updatedGoal);
    }
  };

  const handleCompetencySelect = (competencyId: string, checked: boolean) => {
    let newSelectedIds: string[];
    const newSelectedActions = { ...selectedIdealActions };
    
    if (checked) {
      newSelectedIds = [...selectedCompetencyIds, competencyId];
    } else {
      newSelectedIds = selectedCompetencyIds.filter(id => id !== competencyId);
      // Remove ideal actions for this competency when deselected
      delete newSelectedActions[competencyId];
    }
    const nextSelectedActions = checked ? selectedIdealActions : newSelectedActions;

    updateGoal({
      competencyIds: newSelectedIds.length > 0 ? newSelectedIds : null,
      selectedIdealActions: Object.keys(nextSelectedActions).length > 0 ? nextSelectedActions : null,
    });
  };

  const handleIdealActionSelect = (competencyId: string, actionKey: string, checked: boolean) => {
    if (!selectedCompetencyIds.includes(competencyId)) {
      return; // Can't select ideal actions if competency isn't selected
    }

    const currentActions = selectedIdealActions[competencyId] || [];
    let newActions: string[];

    if (checked) {
      newActions = [...currentActions, actionKey];
    } else {
      newActions = currentActions.filter(key => key !== actionKey);
    }

    const newSelectedActions = {
      ...selectedIdealActions,
      [competencyId]: newActions,
    };

    // Remove empty arrays
    if (newActions.length === 0) {
      delete newSelectedActions[competencyId];
    }

    updateGoal({
      selectedIdealActions: Object.keys(newSelectedActions).length > 0 ? newSelectedActions : null,
    });
  };

  const handleActionPlanChange = (value: string) => {
    updateGoal({ actionPlan: value });
  };

  const canProceed = () => {
    return actionPlan.trim() !== '';
  };

  if ((stageBudgets?.competency ?? 0) === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertTitle>コンピテンシー目標は不要です</AlertTitle>
          <AlertDescription>
            現在のステージ「{stageBudgets.stageName ?? '未設定'}」ではコンピテンシー配分が 0% に設定されているため、このステップでの入力は不要です。
          </AlertDescription>
        </Alert>
        <Separator />
        <div className="grid grid-cols-3 gap-4">
          <Button onClick={onPrevious} variant="outline" className="col-span-1">
            <ChevronLeft className="h-4 w-4 mr-2" />
            前に戻る
          </Button>
          <Button onClick={onNext} className="col-span-2">
            次へ進む
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">コンピテンシー目標の設定</h3>
        <p className="text-sm text-muted-foreground mb-4">
          コンピテンシーの選択は任意です。特定のコンピテンシーを選択する場合は、該当する理想的行動も選択できます。
        </p>
      </div>

      {/* Competency Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">
            ステージ配分: コンピテンシー {stageBudgets.competency ?? 0}% 
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Label className="text-base font-medium">コンピテンシーの選択 (任意)</Label>
        
        {isLoadingCompetencies ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">コンピテンシーを読み込み中...</p>
            </div>
          </div>
        ) : competencyError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              コンピテンシーの読み込みに失敗しました: {competencyError}
            </AlertDescription>
          </Alert>
        ) : (
          <CompetencyAccordion
            competencies={competencies}
            selectedCompetencyIds={selectedCompetencyIds}
            selectedIdealActions={selectedIdealActions}
            onCompetencySelect={handleCompetencySelect}
            onIdealActionSelect={handleIdealActionSelect}
            showSelection={true}
            showEditButtons={false}
            editMode={false}
          />
        )}
      </div>

      {/* Selection Summary */}
      {selectedCompetencyIds.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base text-blue-900">選択中のコンピテンシー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedCompetencyIds.map(competencyId => {
                const competency = competencies.find(c => c.id === competencyId);
                const selectedActionKeys = selectedIdealActions[competencyId] || [];
                
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

      {/* Action Plan Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">アクションプランの設定</CardTitle>
          <p className="text-sm text-muted-foreground">
            具体的なアクションプランを記入してください。（必須）
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="action-plan">アクションプラン *</Label>
              <Textarea
                id="action-plan"
                value={actionPlan}
                onChange={(e) => handleActionPlanChange(e.target.value)}
                placeholder="コンピテンシー向上に向けた具体的なアクションプランを記入してください"
                rows={6}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Messages */}
      {!actionPlan.trim() && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            アクションプランの記入は必須です。
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <Separator />
      <div className="grid grid-cols-3 gap-4">
        <Button onClick={onPrevious} variant="outline" className="col-span-1">
          <ChevronLeft className="h-4 w-4 mr-2" />
          前に戻る
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed()}
          className="col-span-2"
        >
          次へ進む
        </Button>
      </div>
    </div>
  );
}