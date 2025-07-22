'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, AlertCircle, TrendingUp, BarChart3, Zap } from 'lucide-react';

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
  onNext: () => void;
}

export function PerformanceGoalsStep({ goals, onGoalsChange, onNext }: PerformanceGoalsStepProps) {
  const [currentGoals, setCurrentGoals] = useState<PerformanceGoal[]>(goals);

  useEffect(() => {
    // 初期設定：目標がない場合は1つ追加
    if (goals.length === 0) {
      const initialGoal: PerformanceGoal = {
        id: Date.now().toString(),
        type: 'quantitative',
        title: '',
        specificGoal: '',
        achievementCriteria: '',
        method: '',
        weight: 50
      };
      setCurrentGoals([initialGoal]);
      onGoalsChange([initialGoal]);
    }
  }, [goals, onGoalsChange]);

  const addGoal = () => {
    const remainingWeight = 100 - getTotalWeight();
    const newGoal: PerformanceGoal = {
      id: Date.now().toString(),
      type: 'quantitative',
      title: '',
      specificGoal: '',
      achievementCriteria: '',
      method: '',
      weight: Math.min(remainingWeight, 30)
    };
    const updatedGoals = [...currentGoals, newGoal];
    setCurrentGoals(updatedGoals);
    onGoalsChange(updatedGoals);
  };

  const removeGoal = (id: string) => {
    if (currentGoals.length === 1) return; // 最低1つは残す
    const updatedGoals = currentGoals.filter(goal => goal.id !== id);
    setCurrentGoals(updatedGoals);
    onGoalsChange(updatedGoals);
  };

  const updateGoal = (id: string, field: keyof PerformanceGoal, value: string | number) => {
    const updatedGoals = currentGoals.map(goal =>
      goal.id === id ? { ...goal, [field]: value } : goal
    );
    setCurrentGoals(updatedGoals);
    onGoalsChange(updatedGoals);
  };

  const getTotalWeight = () => {
    return currentGoals.reduce((sum, goal) => sum + goal.weight, 0);
  };

  const getWeightStatus = () => {
    const total = getTotalWeight();
    if (total === 100) return { status: 'success', message: '重み配分が完了しました' };
    if (total > 100) return { status: 'error', message: `${total - 100}%オーバーしています` };
    return { status: 'warning', message: `あと${100 - total}%必要です` };
  };

  const canProceed = () => {
    return getTotalWeight() === 100 && currentGoals.length > 0 && 
           currentGoals.every(goal => goal.title && goal.specificGoal && goal.achievementCriteria);
  };

  const weightStatus = getWeightStatus();

  return (
    <div className="space-y-6">

      {/* ヘッダーカード */}
      <Card>
        <CardContent>
          {/* 重み配分の視覚化 */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">重み配分の進捗</span>
              <Badge variant={weightStatus.status === 'success' ? "default" : 
                             weightStatus.status === 'error' ? "destructive" : "secondary"}>
                {getTotalWeight()}% / 100%
              </Badge>
            </div>
            <Progress value={getTotalWeight()} />
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
                    onValueChange={(value) => updateGoal(goal.id, 'type', value as 'quantitative' | 'qualitative')}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="quantitative" className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        定量的
                      </TabsTrigger>
                      <TabsTrigger value="qualitative" className="flex items-center gap-1">
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
                      max="100"
                      value={goal.weight}
                      onChange={(e) => updateGoal(goal.id, 'weight', parseInt(e.target.value) || 0)}
                      className="w-16 text-center border-0 p-0 text-sm font-semibold"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  
                  {currentGoals.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGoal(goal.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* 入力フィールド */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor={`title-${goal.id}`}>目標タイトル</Label>
                  <Input
                    id={`title-${goal.id}`}
                    value={goal.title}
                    onChange={(e) => updateGoal(goal.id, 'title', e.target.value)}
                    placeholder="例：売上目標達成、新規顧客獲得など"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`specific-${goal.id}`}>具体的な目標</Label>
                    <Textarea
                      id={`specific-${goal.id}`}
                      value={goal.specificGoal}
                      onChange={(e) => updateGoal(goal.id, 'specificGoal', e.target.value)}
                      placeholder="数値や期限を含む具体的な目標を記入"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`criteria-${goal.id}`}>達成基準</Label>
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
                  <Label htmlFor={`method-${goal.id}`}>実行方法・アプローチ</Label>
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
      {weightStatus.status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            重みの合計が100%を超えています。各目標の重みを調整してください。
          </AlertDescription>
        </Alert>
      )}

      {/* 目標追加ボタン */}
      <div className="grid grid-cols-3 gap-4">
        <Button 
          className="col-span-2"
          onClick={addGoal}
          disabled={getTotalWeight() >= 100}
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
      </div>

    </div>
  );
}