'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, ChevronLeft, Check } from 'lucide-react';
import stage1Competencies from '../data/stage1-competencies.json';

interface Competency {
  id: string;
  title: string;
  description: string;
}

interface CompetencyGoal {
  id: string; // Add ID field for tracking
  selectedCompetencyId: string;
  actionPlan: string;
}

interface CompetencyGoalsStepProps {
  goals: CompetencyGoal[];
  onGoalsChange: (goals: CompetencyGoal[]) => void;
  goalTracking?: {
    trackGoalChange: (goalId: string, goalType: 'performance' | 'competency', data: unknown) => void;
  };
  onNext: () => void;
  onPrevious: () => void;
  periodId?: string;
}

export function CompetencyGoalsStep({ goals, onGoalsChange, goalTracking, onNext, onPrevious, periodId: _periodId }: CompetencyGoalsStepProps) {
  const [selectedCompetency, setSelectedCompetency] = useState<string>('');
  const [actionPlan, setActionPlan] = useState<string>('');
  const competencies: Competency[] = stage1Competencies.competencies;

  useEffect(() => {
    // 既存のgoalsデータがある場合は復元
    if (goals.length > 0) {
      setSelectedCompetency(goals[0].selectedCompetencyId);
      setActionPlan(goals[0].actionPlan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [goals.length]); // Only depend on goals.length to prevent infinite loop when goals content changes

  const handleCompetencySelect = (competencyId: string) => {
    setSelectedCompetency(competencyId);
    // 選択変更時にデータを更新
    const updatedGoals = [{
      id: goals[0]?.id || Date.now().toString(), // Use existing ID or create temporary ID
      selectedCompetencyId: competencyId,
      actionPlan: actionPlan
    }];
    onGoalsChange(updatedGoals);
    
    // Track the goal change for auto-save
    if (goalTracking && updatedGoals[0]) {
      goalTracking.trackGoalChange(updatedGoals[0].id, 'competency', updatedGoals[0]);
    }
  };

  const handleActionPlanChange = (value: string) => {
    setActionPlan(value);
    // アクションプラン変更時にデータを更新
    if (selectedCompetency) {
      const updatedGoals = [{
        id: goals[0]?.id || Date.now().toString(), // Use existing ID or create temporary ID
        selectedCompetencyId: selectedCompetency,
        actionPlan: value
      }];
      onGoalsChange(updatedGoals);
      
      // Track the goal change for auto-save
      if (goalTracking && updatedGoals[0]) {
        goalTracking.trackGoalChange(updatedGoals[0].id, 'competency', updatedGoals[0]);
      }
    }
  };

  const canProceed = () => {
    return selectedCompetency && actionPlan.trim() !== '';
  };

  return (
    <div className="space-y-6">
      {/* コンピテンシー選択カード */}
      <div>
        <h3 className="text-lg font-semibold mb-3">コンピテンシー項目を選択してください</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {competencies.map((competency) => (
            <Card
              key={competency.id}
              className={`cursor-pointer transition-all duration-200 ${
                selectedCompetency === competency.id
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => handleCompetencySelect(competency.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {competency.title}
                      {selectedCompetency === competency.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {competency.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* アクションプラン入力 */}
      {selectedCompetency && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">アクションプランの設定</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="action-plan">アクションプラン</Label>
                <Textarea
                  id="action-plan"
                  value={actionPlan}
                  onChange={(e) => handleActionPlanChange(e.target.value)}
                  placeholder="具体的なアクションプランを記入してください"
                  rows={6}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 選択促進メッセージ */}
      {!selectedCompetency && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            上記のコンピテンシー項目から1つを選択してください。
          </AlertDescription>
        </Alert>
      )}

      {/* ナビゲーションボタン */}
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

      {/* エラー表示 */}
      {selectedCompetency && !actionPlan.trim() && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            選択したコンピテンシーに対するアクションプランを記入してください。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}