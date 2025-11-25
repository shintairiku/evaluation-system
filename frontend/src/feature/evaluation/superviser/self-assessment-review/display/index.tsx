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
import { toast } from 'sonner';
import { BUCKET_LABELS, SUPERVISOR_REVIEW_MESSAGES } from '@/feature/evaluation/employee/self-assessment/constants';

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

  // Initialize selected period to current period when data loads
  React.useEffect(() => {
    if (!selectedPeriodId && currentPeriod) {
      setSelectedPeriodId(currentPeriod.id);
    }
  }, [currentPeriod, selectedPeriodId]);

  // Initialize bucket updates when data loads
  React.useEffect(() => {
    const initialUpdates: Record<string, BucketDecision[]> = {};
    groupedReviews.forEach(group => {
      initialUpdates[group.reviewId] = group.bucketDecisions.map(bucket => ({
        ...bucket,
        status: bucket.status || 'pending'
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

  // Auto-save for individual bucket
  const handleAutoSaveBucket = async (reviewId: string, updatedBucket: BucketDecision): Promise<boolean> => {
    try {
      // Update local state first
      const updatedBuckets = bucketUpdates[reviewId]?.map(b =>
        b.bucket === updatedBucket.bucket ? updatedBucket : b
      ) || [];

      const result = await updateBucketDecisionsAction(reviewId, {
        bucketDecisions: updatedBuckets,
        status: 'draft'
      });

      if (!result.success) {
        console.error('Auto-save failed:', result.error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Auto-save error:', err);
      return false;
    }
  };

  const handleDecision = async (reviewId: string, status: 'approved' | 'rejected') => {
    // Validate that at least one bucket has a comment when rejecting
    if (status === 'rejected') {
      const hasComment = bucketUpdates[reviewId]?.some(bucket =>
        bucket.comment && bucket.comment.trim().length > 0
      );

      if (!hasComment) {
        toast.error(SUPERVISOR_REVIEW_MESSAGES.ERROR.COMMENT_REQUIRED, {
          description: '差し戻しの際は、少なくとも1つのバケットにコメントを入力してください。'
        });
        return;
      }
    }

    setSavingStates(prev => ({ ...prev, [reviewId]: true }));
    try {
      const result = await updateBucketDecisionsAction(reviewId, {
        bucketDecisions: bucketUpdates[reviewId] || [],
        status
      });

      if (result.success) {
        // Show success toast
        if (status === 'approved') {
          toast.success(SUPERVISOR_REVIEW_MESSAGES.SUCCESS.APPROVE, {
            description: '承認が完了し、従業員に通知されました。'
          });
        } else {
          toast.success(SUPERVISOR_REVIEW_MESSAGES.SUCCESS.REJECT, {
            description: '従業員に修正依頼が送信されました。'
          });
        }

        // Refresh data
        await reloadData();
        await refreshPendingCount();
      } else {
        const errorMessage = result.error || '更新に失敗しました';
        setError(errorMessage);
        toast.error('操作に失敗しました', {
          description: errorMessage
        });
      }
    } catch (err) {
      const errorMessage = '更新に失敗しました';
      setError(errorMessage);
      toast.error('操作に失敗しました', {
        description: errorMessage
      });
    } finally {
      setSavingStates(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Employee Card Skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bucket Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((idx) => (
            <Card key={idx}>
              <CardContent className="p-4 space-y-4">
                <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
                  <div className="h-24 w-full bg-gray-100 rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
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
                      onAutoSave={(updatedBucket) => handleAutoSaveBucket(selectedGroup.reviewId, updatedBucket)}
                    />
                  ))}
                </div>

                {/* Total Contribution Summary */}
                {bucketUpdates[selectedGroup.reviewId] && (
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">総合貢献度</h3>
                        <div className="flex items-center gap-6">
                          {bucketUpdates[selectedGroup.reviewId].map((bucket) => (
                            <div key={bucket.bucket} className="text-sm">
                              <span className="text-gray-600">
                                {bucket.bucket === 'performance' ? '目標達成' : 'コンピテンシー'}:
                              </span>
                              <span className="ml-2 font-semibold text-blue-700">
                                {bucket.employeeContribution.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          <div className="border-l pl-4 border-blue-300">
                            <span className="text-gray-600">合計:</span>
                            <span className="ml-2 text-lg font-bold text-blue-800">
                              {bucketUpdates[selectedGroup.reviewId]
                                .reduce((sum, b) => sum + b.employeeContribution, 0)
                                .toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-3">
                      <Button
                        variant="destructive"
                        onClick={() => handleDecision(selectedGroup.reviewId, 'rejected')}
                        disabled={savingStates[selectedGroup.reviewId]}
                        className="flex-1"
                      >
                        {savingStates[selectedGroup.reviewId] ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            処理中...
                          </>
                        ) : (
                          '差し戻し'
                        )}
                      </Button>
                      <Button
                        onClick={() => handleDecision(selectedGroup.reviewId, 'approved')}
                        disabled={savingStates[selectedGroup.reviewId]}
                        className="flex-1"
                      >
                        {savingStates[selectedGroup.reviewId] ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            処理中...
                          </>
                        ) : (
                          '承認'
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
