import { useState, useEffect, useCallback } from 'react';
import { getGoalsAction } from '@/api/server-actions/goals';
import { getUsersAction } from '@/api/server-actions/users';
import { getCurrentEvaluationPeriodAction } from '@/api/server-actions/evaluation-periods';
import type { GoalResponse, UserDetailResponse, EvaluationPeriod } from '@/api/types';

/**
 * Interface for goals grouped by employee
 */
export interface GroupedGoals {
  /** Employee information */
  employee: UserDetailResponse;
  /** Array of goals belonging to this employee */
  goals: GoalResponse[];
  /** Number of pending goals for this employee */
  pendingCount: number;
}

/**
 * Return type for the useGoalReviewData hook
 */
export interface UseGoalReviewDataReturn {
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Goals grouped by employee */
  groupedGoals: GroupedGoals[];
  /** Total count of pending goals */
  totalPendingCount: number;
  /** Currently selected employee ID */
  selectedEmployeeId: string;
  /** Current evaluation period */
  currentPeriod: EvaluationPeriod | null;
  /** Function to set selected employee */
  setSelectedEmployeeId: (id: string) => void;
  /** Function to reload data */
  reloadData: () => Promise<void>;
}

/**
 * Custom hook to manage goal review data loading and state
 * Centralizes data fetching logic and provides optimized performance
 *
 * @returns Object containing all goal review data and controls
 */
export function useGoalReviewData(): UseGoalReviewDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedGoals, setGroupedGoals] = useState<GroupedGoals[]>([]);
  const [totalPendingCount, setTotalPendingCount] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);

  const loadGoalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load current evaluation period
      const periodResult = await getCurrentEvaluationPeriodAction();
      if (periodResult.success && periodResult.data) {
        setCurrentPeriod(periodResult.data);
      } else {
        setCurrentPeriod(null);
      }

      // Load goals and users data in parallel for better performance
      const [goalsResult, usersResult] = await Promise.all([
        getGoalsAction(),
        getUsersAction()
      ]);

      let goals: GoalResponse[] = [];
      let users: UserDetailResponse[] = [];

      if (goalsResult.success && goalsResult.data?.items) {
        goals = goalsResult.data.items.filter(goal => goal.status === 'submitted');
      }

      if (usersResult.success && usersResult.data?.items) {
        users = usersResult.data.items;
      }

      setTotalPendingCount(goals.length);

      // Group goals by employee
      const grouped: GroupedGoals[] = users
        .map(user => {
          const userGoals = goals.filter(goal => goal.userId === user.id);
          return {
            employee: user,
            goals: userGoals,
            pendingCount: userGoals.length
          };
        })
        .filter(group => group.goals.length > 0);

      setGroupedGoals(grouped);

      // Set first employee as selected by default
      if (grouped.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(grouped[0].employee.id);
      }

    } catch (err) {
      console.error('Error loading goal data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);  // Remove selectedEmployeeId dependency to prevent infinite loops

  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  return {
    loading,
    error,
    groupedGoals,
    totalPendingCount,
    selectedEmployeeId,
    currentPeriod,
    setSelectedEmployeeId,
    reloadData: loadGoalData,
  };
}