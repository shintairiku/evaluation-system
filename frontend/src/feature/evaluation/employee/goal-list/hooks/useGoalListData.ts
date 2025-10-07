import { useState, useEffect, useCallback, useMemo } from 'react';
import { getGoalsAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import type { GoalResponse, GoalStatus, EvaluationPeriod } from '@/api/types';

/**
 * Extended GoalResponse with optional supervisorReview
 * TODO: Update this when backend includes supervisorReview in GoalResponse
 */
type GoalWithReview = GoalResponse & {
  supervisorReview?: {
    action: 'approved' | 'rejected' | 'pending';
    comment: string;
    reviewed_at?: string;
  } | null;
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
 * - Provides status filtering
 * - Handles loading and error states
 * - Auto-loads on mount
 * - Provides refetch function for manual reload
 *
 * Data Flow:
 * 1. Load current evaluation period
 * 2. Load all goals for current period (all statuses)
 * 3. Apply client-side filtering based on selected statuses
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
   */
  const loadGoalData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load current evaluation period
      const periodResult = await getCategorizedEvaluationPeriodsAction();
      if (periodResult.success && periodResult.data?.current) {
        setCurrentPeriod(periodResult.data.current);

        // Load all goals for current period (all statuses)
        const goalsResult = await getGoalsAction({
          periodId: periodResult.data.current.id,
          limit: 100, // TODO: Implement pagination if needed
        });

        if (goalsResult.success && goalsResult.data?.items) {
          setGoals(goalsResult.data.items as GoalWithReview[]);
        } else {
          setError(goalsResult.error || '目標の読み込みに失敗しました');
        }
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
