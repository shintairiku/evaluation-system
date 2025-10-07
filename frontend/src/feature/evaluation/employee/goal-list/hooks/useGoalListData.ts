import { useState, useEffect, useCallback, useMemo } from 'react';
import { getGoalsAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import type { GoalResponse, GoalStatus, EvaluationPeriod, SupervisorReview } from '@/api/types';

/**
 * Extended GoalResponse with optional supervisorReview
 * We fetch reviews separately and map them to goals using goal_id
 * This follows the same pattern as supervisor goal-review
 */
type GoalWithReview = GoalResponse & {
  supervisorReview?: SupervisorReview | null;
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
  /** Function to update status filters */
  setSelectedStatuses: (statuses: GoalStatus[]) => void;
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
        const goalsResult = await getGoalsAction({
          periodId: currentPeriodId,
          limit: 100, // TODO: Implement pagination if needed
        });

        if (!goalsResult.success || !goalsResult.data?.items) {
          setError(goalsResult.error || '目標の読み込みに失敗しました');
          return;
        }

        const goals = goalsResult.data.items;

        // If employee has goals, fetch reviews for those specific goals
        // This avoids permission issues - employees can only see reviews for their own goals
        let reviews: SupervisorReview[] = [];
        if (goals.length > 0) {
          // Fetch reviews for each goal (employees can access reviews for their own goals)
          const reviewPromises = goals.map(goal =>
            getSupervisorReviewsAction({
              goalId: goal.id,
              pagination: { limit: 10 }
            })
          );

          const reviewResults = await Promise.all(reviewPromises);
          reviewResults.forEach(result => {
            if (result.success && result.data?.items) {
              reviews.push(...result.data.items);
            }
          });
        }

        console.log('🔍 [useGoalListData] Total goals:', goals.length);
        console.log('🔍 [useGoalListData] Total reviews fetched:', reviews.length);
        if (reviews.length > 0) {
          console.log('🔍 [useGoalListData] Sample review:', reviews[0]);
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

        console.log('🔍 [useGoalListData] Reviews mapped:', reviewsMap.size);

        // Debug: Show which review was selected for each goal
        reviewsMap.forEach((review, goalId) => {
          console.log(`🔍 [useGoalListData] Goal ${goalId.substring(0, 8)} → Review:`, {
            action: review.action,
            comment: review.comment,
            reviewed_at: review.reviewed_at,
            updated_at: review.updated_at,
            created_at: review.created_at
          });
        });

        // Map reviews to goals
        const goalsWithReviews: GoalWithReview[] = goals.map(goal => ({
          ...goal,
          supervisorReview: reviewsMap.get(goal.id) || null
        }));

        console.log('🔍 [useGoalListData] Goals with reviews:',
          goalsWithReviews.filter(g => g.supervisorReview !== null).length
        );
        goalsWithReviews.forEach(goal => {
          if (goal.supervisorReview) {
            console.log(`🔍 Goal ${goal.id.substring(0, 8)} has review with action: ${goal.supervisorReview.action}`);
          }
        });

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
   * Filter goals based on selected statuses
   */
  const filteredGoals = useMemo(() => {
    if (selectedStatuses.length === 0) {
      return goals; // No filter, return all
    }
    return goals.filter(goal => selectedStatuses.includes(goal.status));
  }, [goals, selectedStatuses]);

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
    setSelectedStatuses,
    refetch: loadGoalData,
  };
}
