'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, Send, Target, Brain, Save } from 'lucide-react';
import stage1Competencies from '../data/stage1-competencies.json';
import { toast } from 'sonner';

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
  onPrevious: () => void;
}

export function ConfirmationStep({ performanceGoals, competencyGoals, onPrevious }: ConfirmationStepProps) {
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // ダミーの送信処理
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setShowSubmitDialog(false);
    
    // 成功メッセージ表示など
    toast.success('目標が正常に提出されました。承認をお待ちください。');
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
            {performanceGoals.map((goal, index) => (
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
          <Button variant="outline">
            <Save className="h-4 w-4 mr-2" />
            一時保存
          </Button>
          <Button
            onClick={() => setShowSubmitDialog(true)}
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
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '提出中...' : '提出する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}