'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import { EmployeeTabNavigation } from '../components/EmployeeTabNavigation';
import { updateBucketDecisionsAction } from '@/api/server-actions/self-assessment-reviews';
import { useSelfAssessmentReviewContext } from '@/context/SelfAssessmentReviewContext';
import { useSelfAssessmentReviewData } from '../hooks/useSelfAssessmentReviewData';
import { BucketReviewCard } from '../components/BucketReviewCard';
import { Loader2 } from 'lucide-react';
import type { BucketDecision } from '@/api/types';

const BUCKET_LABELS = {
  performance: 'パフォーマンス (Performance)',
  competency: 'コンピテンシー (Competency)',
};

export default function SelfAssessmentReviewPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [bucketUpdates, setBucketUpdates] = useState<Record<string, BucketDecision[]>>({});
  const { refreshPendingCount } = useSelfAssessmentReviewContext();

  const {
    loading,
    error: loadError,
    groupedReviews,
    totalPendingCount,
    selectedEmployeeId,
    currentPeriod,
    allPeriods,
    setSelectedEmployeeId,
    reloadData
  } = useSelfAssessmentReviewData({ selectedPeriodId: selectedPeriodId || undefined });

  const [error, setError] = React.useState<string | null>(loadError);

  // Update error when loadError changes
  React.useEffect(() => {
    setError(loadError);
  }, [loadError]);

  // Initialize bucket updates when data loads
  React.useEffect(() => {
    const initialUpdates: Record<string, BucketDecision[]> = {};
    groupedReviews.forEach(group => {
      initialUpdates[group.reviewId] = group.bucketDecisions.map(bucket => ({
        ...bucket,
        status: bucket.status || 'pending' as const
      }));
    });
    setBucketUpdates(initialUpdates);
  }, [groupedReviews]);

  // Refresh pending count when data changes
  React.useEffect(() => {
    refreshPendingCount();
  }, [groupedReviews.length, refreshPendingCount]);

  // Find selected review group
  const selectedGroup = useMemo(() => {
    return groupedReviews.find(group => group.employee.id === selectedEmployeeId);
  }, [groupedReviews, selectedEmployeeId]);

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
        // Refresh data
        await reloadData();
        await refreshPendingCount();
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
    <div className="container mx-auto p-4 md:p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">自己評価承認</h1>
            <Badge variant="secondary" className="text-sm">{totalPendingCount}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            部下の自己評価を確認し、承認または差し戻しを行ってください
          </p>
        </div>
        <div className="shrink-0">
          <EvaluationPeriodSelector
            periods={allPeriods}
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

      {groupedReviews.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2">承認待ちの自己評価はありません</h3>
          <p className="text-muted-foreground text-sm sm:text-base">
            現在、承認が必要な自己評価はありません。
          </p>
        </div>
      ) : (
        <Tabs value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
          {/* Subordinate Selector Tabs */}
          <EmployeeTabNavigation groupedReviews={groupedReviews} />

          {/* Content for Selected Subordinate */}
          {selectedGroup && (
            <TabsContent value={selectedEmployeeId} className="mt-4 md:mt-6">
              <div className="space-y-4">
                {/* Employee Info Card */}
                <EmployeeInfoCard employee={selectedGroup.employee} />

                {/* Bucket Review Cards */}
                <div className="grid gap-4 md:grid-cols-2">
                  {bucketUpdates[selectedGroup.reviewId]?.map((bucket) => (
                    <BucketReviewCard
                      key={bucket.bucket}
                      bucket={bucket}
                      bucketLabel={BUCKET_LABELS[bucket.bucket as keyof typeof BUCKET_LABELS] || bucket.bucket}
                      onUpdate={(updatedBucket) => handleBucketUpdate(selectedGroup.reviewId, updatedBucket)}
                    />
                  ))}
                </div>

                {/* Action Buttons */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handleSaveDraft(selectedGroup.reviewId)}
                        disabled={savingStates[selectedGroup.reviewId]}
                        className="flex-1"
                      >
                        {savingStates[selectedGroup.reviewId] ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            保存中...
                          </>
                        ) : (
                          '下書き保存'
                        )}
                      </Button>
                      <Button
                        onClick={() => handleSubmit(selectedGroup.reviewId)}
                        disabled={savingStates[selectedGroup.reviewId]}
                        className="flex-1"
                      >
                        {savingStates[selectedGroup.reviewId] ? (
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
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
