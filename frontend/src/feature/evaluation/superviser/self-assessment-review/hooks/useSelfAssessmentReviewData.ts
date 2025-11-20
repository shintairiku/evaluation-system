import { useState, useEffect, useCallback } from 'react';
import { getPendingSelfAssessmentReviewsAction } from '@/api/server-actions/self-assessment-reviews';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import type { SelfAssessmentReview, EvaluationPeriod, BucketDecision } from '@/api/types';
import type { GroupedReviews } from '../components/EmployeeTabNavigation';

export interface UseSelfAssessmentReviewDataParams {
  selectedPeriodId?: string;
}

export interface UseSelfAssessmentReviewDataReturn {
  loading: boolean;
  error: string | null;
  groupedReviews: GroupedReviews[];
  totalPendingCount: number;
  selectedEmployeeId: string;
  currentPeriod: EvaluationPeriod | null;
  allPeriods: EvaluationPeriod[];
  setSelectedEmployeeId: (id: string) => void;
  reloadData: () => Promise<void>;
}

/**
 * Hook to fetch and group self-assessment reviews by subordinate
 * Similar to useGoalReviewData but for self-assessment reviews
 */
export function useSelfAssessmentReviewData(
  params?: UseSelfAssessmentReviewDataParams
): UseSelfAssessmentReviewDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedReviews, setGroupedReviews] = useState<GroupedReviews[]>([]);
  const [totalPendingCount, setTotalPendingCount] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);

  const loadReviewData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Load evaluation periods
      const periodResult = await getCategorizedEvaluationPeriodsAction();

      if (!periodResult.success || !periodResult.data) {
        setError('評価期間の取得に失敗しました');
        return;
      }

      setCurrentPeriod(periodResult.data.current || null);
      const allPeriodsArray = periodResult.data.all || [];
      setAllPeriods(allPeriodsArray);

      // Determine period: use selected or current
      const periodToUse = params?.selectedPeriodId
        ? allPeriodsArray.find(p => p.id === params.selectedPeriodId)
        : periodResult.data.current;

      if (!periodToUse) {
        setError('評価期間が見つかりません');
        setGroupedReviews([]);
        setTotalPendingCount(0);
        return;
      }

      // 2. Load pending self-assessment reviews
      const reviewsResult = await getPendingSelfAssessmentReviewsAction({
        pagination: { limit: 100 },
        periodId: periodToUse.id,
      });

      if (!reviewsResult.success || !reviewsResult.data) {
        setError(reviewsResult.error || '自己評価レビューの取得に失敗しました');
        setGroupedReviews([]);
        setTotalPendingCount(0);
        return;
      }

      const reviews = reviewsResult.data.items || [];

      // 3. Group reviews by subordinate (employee)
      const grouped: GroupedReviews[] = reviews
        .filter(review => review.subordinate) // Only include reviews with employee data
        .map(review => {
          // Count pending buckets for this review
          const pendingBuckets = review.bucketDecisions.filter(
            bucket => bucket.status === 'pending'
          );

          return {
            employee: review.subordinate!,
            reviewId: review.id,
            bucketDecisions: review.bucketDecisions,
            pendingCount: pendingBuckets.length,
          };
        });

      // Calculate total pending count
      const totalPending = grouped.reduce((sum, group) => sum + group.pendingCount, 0);

      setGroupedReviews(grouped);
      setTotalPendingCount(totalPending);

      // Select first employee by default
      if (grouped.length > 0) {
        setSelectedEmployeeId(grouped[0].employee.id);
      } else {
        setSelectedEmployeeId('');
      }
    } catch (err) {
      console.error('Error loading self-assessment review data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setGroupedReviews([]);
      setTotalPendingCount(0);
    } finally {
      setLoading(false);
    }
  }, [params?.selectedPeriodId]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  return {
    loading,
    error,
    groupedReviews,
    totalPendingCount,
    selectedEmployeeId,
    currentPeriod,
    allPeriods,
    setSelectedEmployeeId,
    reloadData: loadReviewData,
  };
}
