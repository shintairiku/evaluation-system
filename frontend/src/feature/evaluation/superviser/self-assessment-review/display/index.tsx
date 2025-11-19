'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { getPendingSelfAssessmentReviewsAction } from '@/api/server-actions/self-assessment-reviews';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import type { SupervisorFeedback, EvaluationPeriod } from '@/api/types';
import { useSelfAssessmentReviewContext } from '@/context/SelfAssessmentReviewContext';

export default function SelfAssessmentReviewPage() {
  const [items, setItems] = useState<SupervisorFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const { pendingCount, refreshPendingCount } = useSelfAssessmentReviewContext();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const periodResp = await getCategorizedEvaluationPeriodsAction();
      if (periodResp.success && periodResp.data) {
        const all = periodResp.data.all || [];
        setPeriods(all);
        const resolved = selectedPeriodId || periodResp.data.current?.id || all[0]?.id || '';
        setSelectedPeriodId(resolved);
        setCurrentPeriod(periodResp.data.current || null);
      }

      const result = await getPendingSelfAssessmentReviewsAction({
        pagination: { limit: 100 },
        periodId: selectedPeriodId || undefined,
      });
      if (!result.success || !result.data) {
        setError(result.error || '自己評価レビューの取得に失敗しました');
      } else {
        setItems(result.data.items || []);
        setError(null);
      }
      setLoading(false);
    };
    load();
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [items.length, refreshPendingCount]);

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold">自己評価承認</h1>
          <Badge variant="secondary" className="text-sm">{pendingCount}</Badge>
        </div>
        <div className="shrink-0">
          <EvaluationPeriodSelector
            periods={periods}
            selectedPeriodId={selectedPeriodId}
            currentPeriodId={currentPeriod?.id || null}
            onPeriodChange={handlePeriodChange}
            isLoading={loading}
          />
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="text-red-700 text-sm py-4">
            {error}
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2">承認待ちの自己評価はありません</h3>
          <p className="text-muted-foreground text-sm sm:text-base">
            現在、承認が必要な自己評価はありません。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 underline"
          >
            データを再読み込み
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map(item => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-base font-semibold">自己評価レビュー</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div><span className="font-medium text-foreground">ステータス:</span> {item.status}</div>
                <div><span className="font-medium text-foreground">自己評価ID:</span> {item.self_assessment_id}</div>
                <div><span className="font-medium text-foreground">期間:</span> {item.period_id}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
