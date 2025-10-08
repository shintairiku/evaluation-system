import { useState, useEffect, useCallback, useMemo } from 'react';
import { getGoalsAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import type { GoalResponse, GoalStatus, EvaluationPeriod, SupervisorReview } from '@/api/types';

/**
 * Extended GoalResponse with optional supervisorReview and previousGoalReview
 * We fetch reviews separately and map them to goals using goal_id
 * This follows the same pattern as supervisor goal-review
 */
type GoalWithReview = GoalResponse & {
  supervisorReview?: SupervisorReview | null;
  previousGoalReview?: SupervisorReview | null;
};

/**
 * Return type for the useGoalListData hook
 */
export interface UseGoalListDataReturn {
  /** All goals loaded from server */
  goals: GoalWithReview[];
  /** Goals after applying filters */
  filteredGoals: GoalWithReview[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Currently selected status filters */
  selectedStatuses: GoalStatus[];
  /** Current evaluation period */
  currentPeriod: EvaluationPeriod | null;
  /** Show only resubmissions flag */
  showResubmissionsOnly: boolean;
  /** Count of goals with previousGoalId */
  resubmissionCount: number;
  /** Function to update status filters */
  setSelectedStatuses: (statuses: GoalStatus[]) => void;
  /** Function to update resubmissions filter */
  setShowResubmissionsOnly: (value: boolean) => void;
  /** Function to reload data */
  refetch: () => Promise<void>;
}

/**
 * Custom hook to manage goal list data loading, filtering, and state.
 *
 * Features:
 * - Fetches all goals for current user and period
 * - Fetches supervisor reviews separately and maps them to goals
 * - Provides status filtering
 * - Handles loading and error states
 * - Auto-loads on mount
 * - Provides refetch function for manual reload
 *
 * Architecture:
 * This follows the same pattern as supervisor goal-review (useGoalReviewData):
 * 1. Fetch goals and reviews in parallel (Promise.all)
 * 2. Map reviews to goals using goal_id
 * 3. This approach reuses existing APIs without backend changes
 *
 * Data Flow:
 * 1. Load current evaluation period
 * 2. Load goals AND supervisor reviews in parallel
 * 3. Map reviews to goals by goal_id
 * 4. Apply client-side filtering based on selected statuses
 *
 * @returns Object containing goals data, filters, and control functions
 *
 * @example
 * ```tsx
 * const { filteredGoals, isLoading, selectedStatuses, setSelectedStatuses } = useGoalListData();
 * ```
 */
export function useGoalListData(): UseGoalListDataReturn {
  const [goals, setGoals] = useState<GoalWithReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<GoalStatus[]>([]);
  const [showResubmissionsOnly, setShowResubmissionsOnly] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);

  /**
   * Load goals data from server
   *
   * This follows the same pattern as supervisor goal-review:
   * 1. Fetch goals and reviews in parallel
   * 2. Map reviews to goals using goal_id
   */
  const loadGoalData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load current evaluation period
      const periodResult = await getCategorizedEvaluationPeriodsAction();
      if (periodResult.success && periodResult.data?.current) {
        setCurrentPeriod(periodResult.data.current);
        const currentPeriodId = periodResult.data.current.id;

        // Load goals first to get user's goals
        // Exclude 'rejected' status - rejected goals are replaced by new draft copies
        const goalsResult = await getGoalsAction({
          periodId: currentPeriodId,
          limit: 100, // TODO: Implement pagination if needed
        });

        if (!goalsResult.success || !goalsResult.data?.items) {
          setError(goalsResult.error || '目標の読み込みに失敗しました');
          return;
        }

        const goals = goalsResult.data.items;

        // Filter out rejected goals from display (they're replaced by new draft copies)
        const activeGoals = goals.filter(goal => goal.status !== 'rejected');

        // If employee has goals, fetch reviews for those specific goals
        // This avoids permission issues - employees can only see reviews for their own goals
        let reviews: SupervisorReview[] = [];
        if (activeGoals.length > 0) {
          // Fetch reviews for each active goal
          const reviewPromises = activeGoals.map(goal =>
            getSupervisorReviewsAction({
              goalId: goal.id,
              pagination: { limit: 10 }
            })
          );

          // Also fetch reviews for previous goals (if goal has previousGoalId)
          const previousGoalReviewPromises = activeGoals
            .filter(goal => goal.previousGoalId)
            .map(goal =>
              getSupervisorReviewsAction({
                goalId: goal.previousGoalId!,
                pagination: { limit: 10 }
              })
            );

          const allReviewPromises = [...reviewPromises, ...previousGoalReviewPromises];
          const reviewResults = await Promise.all(allReviewPromises);

          reviewResults.forEach(result => {
            if (result.success && result.data?.items) {
              reviews.push(...result.data.items);
            }
          });
        }

        // Create a map of goal_id → review for quick lookup
        // Use the most recent review for each goal (based on reviewed_at or updated_at)
        const reviewsMap = new Map<string, SupervisorReview>();
        reviews.forEach(review => {
          const existing = reviewsMap.get(review.goal_id);
          if (!existing) {
            reviewsMap.set(review.goal_id, review);
          } else {
            // Compare by reviewed_at (if exists), otherwise updated_at, otherwise created_at
            const reviewDate = review.reviewed_at || review.updated_at || review.created_at;
            const existingDate = existing.reviewed_at || existing.updated_at || existing.created_at;
            if (new Date(reviewDate) > new Date(existingDate)) {
              reviewsMap.set(review.goal_id, review);
            }
          }
        });

        // Map reviews to goals (using activeGoals which excludes rejected)
        const goalsWithReviews: GoalWithReview[] = activeGoals.map(goal => ({
          ...goal,
          supervisorReview: reviewsMap.get(goal.id) || null,
          previousGoalReview: goal.previousGoalId ? reviewsMap.get(goal.previousGoalId) || null : null
        }));

        setGoals(goalsWithReviews);
      } else {
        setCurrentPeriod(null);
        setError('評価期間が設定されていません');
      }
    } catch (err) {
      console.error('Error loading goal data:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Count goals with previousGoalId (resubmissions)
   */
  const resubmissionCount = useMemo(() => {
    return goals.filter(goal => goal.previousGoalId !== null && goal.previousGoalId !== undefined).length;
  }, [goals]);

  /**
   * Filter goals based on selected statuses and resubmissions flag
   */
  const filteredGoals = useMemo(() => {
    let result = goals;

    // Step 1: Filter by status
    if (selectedStatuses.length > 0) {
      result = result.filter(goal => selectedStatuses.includes(goal.status));
    }

    // Step 2: Filter by resubmissions only (if checked)
    if (showResubmissionsOnly) {
      result = result.filter(goal => goal.previousGoalId !== null && goal.previousGoalId !== undefined);
    }

    return result;
  }, [goals, selectedStatuses, showResubmissionsOnly]);

  /**
   * Load data on mount
   */
  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  return {
    goals,
    filteredGoals,
    isLoading,
    error,
    selectedStatuses,
    currentPeriod,
    showResubmissionsOnly,
    resubmissionCount,
    setSelectedStatuses,
    setShowResubmissionsOnly,
    refetch: loadGoalData,
  };
}
