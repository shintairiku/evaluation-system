'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { getPendingSelfAssessmentReviewsAction, updateBucketDecisionsAction } from '@/api/server-actions/self-assessment-reviews';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import type { SelfAssessmentReview, EvaluationPeriod, BucketDecision } from '@/api/types';
import { useSelfAssessmentReviewContext } from '@/context/SelfAssessmentReviewContext';
import { BucketReviewCard } from '../components/BucketReviewCard';
import { Loader2 } from 'lucide-react';

const BUCKET_LABELS = {
  performance: 'パフォーマンス (Performance)',
  competency: 'コンピテンシー (Competency)',
};

export default function SelfAssessmentReviewPage() {
  const [items, setItems] = useState<SelfAssessmentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [bucketUpdates, setBucketUpdates] = useState<Record<string, BucketDecision[]>>({});
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
        // Initialize bucket updates state
        const initialUpdates: Record<string, BucketDecision[]> = {};
        result.data.items?.forEach(item => {
          initialUpdates[item.id] = item.bucketDecisions;
        });
        setBucketUpdates(initialUpdates);
        setError(null);
      }
      setLoading(false);
    };
    load();
  }, [selectedPeriodId, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [items.length, refreshPendingCount]);

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
  };

  const handleBucketUpdate = (reviewId: string, updatedBucket: BucketDecision) => {
    setBucketUpdates(prev => ({
      ...prev,
      [reviewId]: prev[reviewId]?.map(b =>
        b.bucket === updatedBucket.bucket ? updatedBucket : b
      ) || []
    }));
  };

  const handleSaveDraft = async (reviewId: string) => {
    setSavingStates(prev => ({ ...prev, [reviewId]: true }));
    try {
      const result = await updateBucketDecisionsAction(reviewId, {
        bucketDecisions: bucketUpdates[reviewId] || [],
        status: 'draft'
      });

      if (!result.success) {
        setError(result.error || '下書き保存に失敗しました');
      }
    } catch (err) {
      setError('下書き保存に失敗しました');
    } finally {
      setSavingStates(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  const handleSubmit = async (reviewId: string) => {
    setSavingStates(prev => ({ ...prev, [reviewId]: true }));
    try {
      const result = await updateBucketDecisionsAction(reviewId, {
        bucketDecisions: bucketUpdates[reviewId] || [],
        status: 'submitted'
      });

      if (result.success) {
        // Refresh list
        const refreshResult = await getPendingSelfAssessmentReviewsAction({
          pagination: { limit: 100 },
          periodId: selectedPeriodId || undefined,
        });
        if (refreshResult.success && refreshResult.data) {
          setItems(refreshResult.data.items || []);
        }
      } else {
        setError(result.error || '提出に失敗しました');
      }
    } catch (err) {
      setError('提出に失敗しました');
    } finally {
      setSavingStates(prev => ({ ...prev, [reviewId]: false }));
    }
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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2">承認待ちの自己評価はありません</h3>
          <p className="text-muted-foreground text-sm sm:text-base">
            現在、承認が必要な自己評価はありません。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map(item => (
            <Card key={item.id} className="border-2">
              <CardHeader className="bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {item.subordinate?.name || item.subordinate?.email || '名前なし'}
                    </CardTitle>
                    {item.subordinate?.jobTitle && (
                      <p className="text-sm text-gray-600 mt-1">{item.subordinate.jobTitle}</p>
                    )}
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Bucket Review Cards */}
                <div className="grid gap-4 md:grid-cols-2">
                  {bucketUpdates[item.id]?.map((bucket) => (
                    <BucketReviewCard
                      key={bucket.bucket}
                      bucket={bucket}
                      bucketLabel={BUCKET_LABELS[bucket.bucket as keyof typeof BUCKET_LABELS] || bucket.bucket}
                      onUpdate={(updatedBucket) => handleBucketUpdate(item.id, updatedBucket)}
                    />
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => handleSaveDraft(item.id)}
                    disabled={savingStates[item.id]}
                  >
                    {savingStates[item.id] ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        保存中...
                      </>
                    ) : (
                      '下書き保存'
                    )}
                  </Button>
                  <Button
                    onClick={() => handleSubmit(item.id)}
                    disabled={savingStates[item.id]}
                  >
                    {savingStates[item.id] ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        提出中...
                      </>
                    ) : (
                      '承認を提出'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
