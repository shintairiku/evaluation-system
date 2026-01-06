'use client';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, AlertCircle, TrendingUp, BarChart3, Zap } from 'lucide-react';
import { DEFAULT_ACHIEVEMENT_CRITERIA_EXAMPLE, type StageWeightBudget } from '../types';
import { deleteGoalAction } from '@/api/server-actions/goals';
import type { UseGoalTrackingReturn } from '@/hooks/useGoalTracking';

interface PerformanceGoal {
  id: string;
  type: 'quantitative' | 'qualitative';
  title: string;
  specificGoal: string;
  achievementCriteria: string;
  method: string;
  weight: number;
}

interface PerformanceGoalsStepProps {
  goals: PerformanceGoal[];
  onGoalsChange: (goals: PerformanceGoal[]) => void;
  goalTracking?: UseGoalTrackingReturn;
  onNext: () => void;
  periodId?: string;
  stageBudgets: StageWeightBudget;
}

type GoalType = 'quantitative' | 'qualitative';

const goalTypeMeta: Record<GoalType, { label: string; icon: JSX.Element; helper: string }> = {
  quantitative: {
    label: '定量',
    icon: <BarChart3 className="h-4 w-4" />,
    helper: '数値目標の合計',
  },
  qualitative: {
    label: '定性',
    icon: <Zap className="h-4 w-4" />,
    helper: '定性目標の合計',
  },
};

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
};

export function PerformanceGoalsStep({ goals, onGoalsChange, goalTracking, onNext, stageBudgets }: PerformanceGoalsStepProps) {
  // Derive values directly from props to avoid local-state divergence
  const currentGoals = goals;
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  const goalTypes: GoalType[] = ['quantitative', 'qualitative'];

  const isTemporaryGoalId = (goalId: string) => /^\d+$/.test(goalId);

  const getBudgetForType = (type: GoalType) => {
    return type === 'quantitative' ? stageBudgets.quantitative : stageBudgets.qualitative;
  };

  const getTotalByType = (type: GoalType, excludeGoalId?: string) => {
    return currentGoals
      .filter(goal => goal.type === type && goal.id !== excludeGoalId)
      .reduce((sum, goal) => sum + goal.weight, 0);
  };

  const getMaxAllocatableWeight = (type: GoalType, excludeGoalId?: string) => {
    const budget = getBudgetForType(type);
    const allocated = getTotalByType(type, excludeGoalId);
    const remaining = budget - allocated;
    return remaining > 0 ? remaining : 0;
  };

  const zeroBudgetTypes = useMemo(
    () => goalTypes.filter(type => getBudgetForType(type) === 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stageBudgets.quantitative, stageBudgets.qualitative],
  );

  const zeroBudgetMessage = zeroBudgetTypes.length
    ? `${zeroBudgetTypes.map(type => goalTypeMeta[type].label).join('／')} はこのステージで0%に設定されているため追加できません`
    : null;

  const addGoal = () => {
    const preferredType: GoalType = getMaxAllocatableWeight('quantitative') > 0
      ? 'quantitative'
      : 'qualitative';
    const initialWeight = getMaxAllocatableWeight(preferredType);
    const newGoal: PerformanceGoal = {
      id: Date.now().toString(), // Temporary ID for new goals
      type: preferredType,
      title: '',
      specificGoal: '',
      achievementCriteria: DEFAULT_ACHIEVEMENT_CRITERIA_EXAMPLE,
      method: '',
      weight: initialWeight > 0 ? initialWeight : 0
    };
    const updatedGoals = [...currentGoals, newGoal];
    onGoalsChange(updatedGoals);
    
    // Show immediate feedback
    toast.success('新しい目標を追加しました', {
      duration: 1500
    });
  };

  const removeGoal = async (id: string) => {
    if (currentGoals.length === 1) {
      toast.error('目標は少なくとも1件必要です');
      return;
    }

    const goalToRemove = currentGoals.find(goal => goal.id === id);
    if (!goalToRemove) return;

    const applyRemoval = () => {
      const updatedGoals = currentGoals.filter(goal => goal.id !== id);
      onGoalsChange(updatedGoals);
      goalTracking?.clearChanges(id);
    };

    if (isTemporaryGoalId(id)) {
      applyRemoval();
      const goalTitle = goalToRemove.title || '目標';
      toast.success(`「${goalTitle}」を削除しました`, { duration: 2000 });
      return;
    }

    setDeletingGoalId(id);
    const loadingToast = toast.loading('目標を削除しています...');
    try {
      const result = await deleteGoalAction(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete goal');
      }
      applyRemoval();
      toast.success('目標を削除しました', { id: loadingToast, duration: 2500 });
    } catch (error) {
      console.error('Failed to delete performance goal', { goalId: id, error });
      toast.error('目標の削除に失敗しました', {
        id: loadingToast,
        description: error instanceof Error ? error.message : undefined,
        duration: 4000,
      });
    } finally {
      setDeletingGoalId(null);
    }
  };

  const clampWeightForGoal = (goalId: string, type: GoalType, rawValue: number) => {
    const cleaned = Number.isFinite(rawValue) ? rawValue : 0;
    const max = getMaxAllocatableWeight(type, goalId);
    if (max === 0) {
      return 0;
    }
    return Math.min(Math.max(cleaned, 0), max);
  };

  const updateGoal = (id: string, field: keyof PerformanceGoal, value: string | number) => {
    let didChangeWeights = false;
    const updatedGoals = currentGoals.map(goal => {
      if (goal.id !== id) return goal;
      let updatedGoal = { ...goal };

      if (field === 'weight') {
        const numericValue = typeof value === 'number' ? value : Number(value);
        const clamped = clampWeightForGoal(id, goal.type, Number.isNaN(numericValue) ? 0 : numericValue);
        updatedGoal.weight = clamped;
        didChangeWeights = true;
      } else if (field === 'type') {
        const newType = value as GoalType;
        const clamped = clampWeightForGoal(id, newType, goal.weight);
        updatedGoal = {
          ...goal,
          type: newType,
          weight: clamped,
        };
        didChangeWeights = true;
      } else {
        updatedGoal = { ...goal, [field]: value };
      }
      return updatedGoal;
    });
    onGoalsChange(updatedGoals);
    
    // Track the specific goal that was changed for auto-save
    const updatedGoal = updatedGoals.find(goal => goal.id === id);
    if (updatedGoal && goalTracking) {
      goalTracking.trackGoalChange(id, 'performance', updatedGoal);
    }
    
    if (didChangeWeights) {
      const statuses = goalTypes.map(type => buildTypeStatus(type));
      if (statuses.every(status => status.state === 'success')) {
        toast.success('重み配分が完了しました！', { duration: 2000 });
      }
    }
  };

  const buildTypeStatus = (type: GoalType) => {
    const budget = getBudgetForType(type);
    const allocated = getTotalByType(type);
    const remaining = budget - allocated;

    if (budget === 0) {
      return {
        type,
        budget,
        allocated,
        remaining,
        state: allocated === 0 ? 'success' : 'error',
        message: allocated === 0 ? 'このステージでは設定不要です' : 'このステージでは0%のため設定できません',
      } as const;
    }

    if (remaining === 0) {
      return { type, budget, allocated, remaining, state: 'success', message: '配分完了' } as const;
    }

    if (remaining > 0) {
      return {
        type,
        budget,
        allocated,
        remaining,
        state: 'warning',
        message: `あと${formatPercent(remaining)}%必要です`,
      } as const;
    }

    return {
      type,
      budget,
      allocated,
      remaining,
      state: 'error',
      message: `${formatPercent(Math.abs(remaining))}%オーバーしています`,
    } as const;
  };

  const typeStatuses = goalTypes.map(type => buildTypeStatus(type));

  const canProceed = () => {
    const budgetsSatisfied = typeStatuses.every(status => status.state === 'success');
    const hasGoals = currentGoals.length > 0;
    const requiredFieldsSatisfied = currentGoals.every(goal => goal.title && goal.specificGoal && goal.achievementCriteria);
    return budgetsSatisfied && hasGoals && requiredFieldsSatisfied;
  };

  const hasRemainingBudget = goalTypes.some(type => getMaxAllocatableWeight(type) > 0);

  const shouldShowError = typeStatuses.some(status => status.state === 'error');

  return (
    <div className="space-y-6">

      {/* ヘッダーカード */}
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              ステージ配分: 定量 {formatPercent(stageBudgets.quantitative)}% / 定性 {formatPercent(stageBudgets.qualitative)}%
              {zeroBudgetMessage && (
                <p className="mt-1 text-xs text-muted-foreground">{zeroBudgetMessage}</p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {typeStatuses.map(status => (
                <div
                  key={status.type}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {goalTypeMeta[status.type].icon}
                      <span className="font-medium">{goalTypeMeta[status.type].label}</span>
                    </div>
                    <Badge
                      variant={
                        status.state === 'success'
                          ? 'default'
                          : status.state === 'error'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {formatPercent(status.allocated)}% / {formatPercent(status.budget)}%
                    </Badge>
                  </div>
                  <Progress value={status.budget === 0 ? (status.allocated === 0 ? 100 : 100) : Math.min(100, (status.allocated / status.budget) * 100)} />
                  <p className={`text-xs ${
                    status.state === 'error'
                      ? 'text-destructive'
                      : status.state === 'success'
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                  }`}>
                    {status.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 目標一覧 */}
      <div className="space-y-4">
        {currentGoals.map((goal, index) => (
          <Card key={goal.id} className="relative">
            <CardContent>
              {/* ヘッダー */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                    <span className="text-sm font-semibold text-blue-800">{index + 1}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* 目標タイプ選択 */}
                  <Tabs 
                    value={goal.type} 
                    onValueChange={(value) => updateGoal(goal.id, 'type', value as GoalType)}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger
                        value="quantitative"
                        className="flex items-center gap-1"
                        disabled={getBudgetForType('quantitative') === 0}
                      >
                        <BarChart3 className="h-3 w-3" />
                        定量的
                      </TabsTrigger>
                      <TabsTrigger
                        value="qualitative"
                        className="flex items-center gap-1"
                        disabled={getBudgetForType('qualitative') === 0}
                      >
                        <Zap className="h-3 w-3" />
                        定性的
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  {/* 重み入力 */}
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      value={goal.weight}
                      onChange={(e) => updateGoal(goal.id, 'weight', Number(e.target.value))}
                      className="w-16 text-center border-0 p-0 text-sm font-semibold"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  
                  {currentGoals.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeGoal(goal.id)}
                      disabled={deletingGoalId === goal.id}
                      className="text-gray-400 hover:text-destructive hover:bg-destructive/10 opacity-50 hover:opacity-100"
                      title="この目標を削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* 入力フィールド */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor={`title-${goal.id}`} className="mb-2">目標タイトル</Label>
                  <Input
                    id={`title-${goal.id}`}
                    value={goal.title}
                    onChange={(e) => updateGoal(goal.id, 'title', e.target.value)}
                    placeholder="例：売上目標達成、新規顧客獲得など"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`specific-${goal.id}`} className="mb-2">具体的な目標</Label>
                    <Textarea
                      id={`specific-${goal.id}`}
                      value={goal.specificGoal}
                      onChange={(e) => updateGoal(goal.id, 'specificGoal', e.target.value)}
                      placeholder="数値や期限を含む具体的な目標を記入"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`criteria-${goal.id}`} className="mb-2">達成基準</Label>
                    <Textarea
                      id={`criteria-${goal.id}`}
                      value={goal.achievementCriteria}
                      onChange={(e) => updateGoal(goal.id, 'achievementCriteria', e.target.value)}
                      placeholder="どのような状態になれば達成とみなすか"
                      rows={3}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`method-${goal.id}`} className="mb-2">実行方法・アプローチ</Label>
                  <Textarea
                    id={`method-${goal.id}`}
                    value={goal.method}
                    onChange={(e) => updateGoal(goal.id, 'method', e.target.value)}
                    placeholder="目標達成のための具体的な方法やアプローチ"
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* エラー表示 */}
      {shouldShowError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            重みの配分が正しくありません。各目標の重みを調整してください。
          </AlertDescription>
        </Alert>
      )}

      {/* 目標追加ボタン */}
      <div className="grid grid-cols-3 gap-4 items-start">
        <Button 
          className="col-span-2"
          onClick={addGoal}
          disabled={!hasRemainingBudget}
        >
          <Plus className="h-4 w-4 mr-2" />
          目標を追加
        </Button>
        <Button
          className="col-span-1"
          onClick={onNext}
          disabled={!canProceed()}
        >
          次へ進む
        </Button>
        {!hasRemainingBudget && (
          <p className="col-span-3 text-right text-sm text-muted-foreground">
            {zeroBudgetMessage ?? 'ステージ配分の上限に達しています。既存の重みを調整してください。'}
          </p>
        )}
      </div>

    </div>
  );
}
