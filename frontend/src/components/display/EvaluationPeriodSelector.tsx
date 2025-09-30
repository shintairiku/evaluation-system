'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import type { EvaluationPeriod } from '@/api/types';
import { getStatusVariant, getStatusLabel } from '@/lib/evaluation-period-status';

interface EvaluationPeriodSelectorProps {
  onPeriodSelected: (period: EvaluationPeriod) => void;
}

export function EvaluationPeriodSelector({ onPeriodSelected }: EvaluationPeriodSelectorProps) {
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<EvaluationPeriod | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadEvaluationPeriods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEvaluationPeriods = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await getCategorizedEvaluationPeriodsAction();

      if (result.success && result.data) {
        // Use the 'all' array which contains all periods regardless of status
        const allPeriods = result.data.all || [];
        setPeriods(allPeriods);
      } else {
        setError(result.error || 'Failed to load evaluation periods');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluation periods');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePeriodSelect = (period: EvaluationPeriod) => {
    setSelectedPeriod(period);
  };

  const handleConfirmSelection = () => {
    if (selectedPeriod) {
      onPeriodSelected(selectedPeriod);
    }
  };

  // Use the imported getStatusVariant function instead of local implementation

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isDeadlinePassed = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">評価期間を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadEvaluationPeriods}
            className="ml-2"
          >
            再試行
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (periods.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          利用可能な評価期間がありません。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          目標設定の評価期間を選択してください
        </h2>
        <p className="text-gray-600">
          目標を設定する評価期間を選んでください。選択後、既存の目標があれば自動的に読み込まれます。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {periods.map((period) => {
          const isSelected = selectedPeriod?.id === period.id;
          const deadlinePassed = isDeadlinePassed(period.goal_submission_deadline);
          
          return (
            <Card
              key={period.id}
              className={`cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:bg-gray-50'
              } ${deadlinePassed ? 'opacity-75' : ''}`}
              onClick={() => handlePeriodSelect(period)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{period.name}</CardTitle>
                  <Badge variant={getStatusVariant(period.status)}>
                    {getStatusLabel(period.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(period.start_date)} 〜 {formatDate(period.end_date)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span className={deadlinePassed ? 'text-red-600' : 'text-gray-600'}>
                      目標提出期限: {formatDate(period.goal_submission_deadline)}
                      {deadlinePassed && (
                        <span className="text-red-600 font-medium ml-1">(期限切れ)</span>
                      )}
                    </span>
                  </div>

                  {deadlinePassed && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        目標提出期限が過ぎています。管理者にご相談ください。
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedPeriod && (
        <div className="text-center pt-4 border-t">
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900">選択された評価期間</h3>
            <p className="text-blue-700">{selectedPeriod.name}</p>
            <p className="text-sm text-blue-600">
              {formatDate(selectedPeriod.start_date)} 〜 {formatDate(selectedPeriod.end_date)}
            </p>
          </div>
          
          <Button 
            onClick={handleConfirmSelection}
            size="lg"
            className="px-8"
          >
            この期間で目標設定を開始
          </Button>
        </div>
      )}
    </div>
  );
}