import { useState, useEffect, useCallback, useMemo } from 'react';
import { getGoalsAction, getGoalByIdAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import { getUsersAction } from '@/api/server-actions/users';
import type { GoalResponse, GoalStatus, EvaluationPeriod, SupervisorReview, UserDetailResponse } from '@/api/types';

/**
 * Extended GoalResponse with optional supervisorReview and previousGoalReview
 * We fetch reviews separately and map them to goals using goal_id
 * This follows the same pattern as supervisor goal-review
 */
type GoalWithReview = GoalResponse & {
  supervisorReview?: SupervisorReview | null;
  previousGoalReview?: SupervisorReview | null;
  rejectionHistory?: SupervisorReview[]; // Array of all rejection reviews in chronological order
};

/**
 * Interface for goals grouped by employee (for supervisor view)
 */
export interface GroupedGoals {
  /** Employee information */
  employee: UserDetailResponse;
  /** Array of goals belonging to this employee */
  goals: GoalWithReview[];
  /** Total count of goals for this employee */
  goalCount: number;
}

/**
 * Return type for the useGoalListData hook
 */
export interface UseGoalListDataReturn {
  /** All goals loaded from server */
  goals: GoalWithReview[];
  /** Goals after applying filters */
  filteredGoals: GoalWithReview[];
  /** Goals grouped by employee (for supervisor view) */
  groupedGoals: GroupedGoals[];
  /** Currently selected employee ID (for supervisor filtering) */
  selectedEmployeeId: string;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Currently selected status filters */
  selectedStatuses: GoalStatus[];
  /** Current evaluation period */
  currentPeriod: EvaluationPeriod | null;
  /** All available evaluation periods */
  allPeriods: EvaluationPeriod[];
  /** Show only resubmissions flag */
  showResubmissionsOnly: boolean;
  /** Count of goals with previousGoalId */
  resubmissionCount: number;
  /** Function to update status filters */
  setSelectedStatuses: (statuses: GoalStatus[]) => void;
  /** Function to update resubmissions filter */
  setShowResubmissionsOnly: (value: boolean) => void;
  /** Function to set selected employee */
  setSelectedEmployeeId: (id: string) => void;
  /** Function to reload data */
  refetch: () => Promise<void>;
}

/**
 * Input parameters for the useGoalListData hook
 */
export interface UseGoalListDataParams {
  /** Optional: Specific period ID to load. If not provided, uses current period */
  selectedPeriodId?: string;
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
 * - Supports period selection (defaults to current period)
 *
 * Architecture:
 * This follows the same pattern as supervisor goal-review (useGoalReviewData):
 * 1. Fetch goals and reviews in parallel (Promise.all)
 * 2. Map reviews to goals using goal_id
 * 3. This approach reuses existing APIs without backend changes
 *
 * Data Flow:
 * 1. Load all evaluation periods
 * 2. Determine which period to use (selected or current)
 * 3. Load goals AND supervisor reviews in parallel for that period
 * 4. Map reviews to goals by goal_id
 * 5. Apply client-side filtering based on selected statuses
 *
 * @param params - Optional parameters including selectedPeriodId
 * @returns Object containing goals data, filters, and control functions
 *
 * @example
 * ```tsx
 * // Use current period (default)
 * const { filteredGoals, isLoading } = useGoalListData();
 *
 * // Use specific period
 * const { filteredGoals, isLoading } = useGoalListData({ selectedPeriodId: 'period-123' });
 * ```
 */
export function useGoalListData(params?: UseGoalListDataParams): UseGoalListDataReturn {
  const [goals, setGoals] = useState<GoalWithReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<GoalStatus[]>([]);
  const [showResubmissionsOnly, setShowResubmissionsOnly] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(''); // '' means "all"
  const [users, setUsers] = useState<UserDetailResponse[]>([]);

  /**
   * Recursively fetch rejection history for a goal
   * Follows the previousGoalId chain backwards to collect all rejection reviews
   */
  const fetchRejectionHistory = useCallback(async (goalId: string): Promise<SupervisorReview[]> => {
    const history: SupervisorReview[] = [];
    let currentGoalId: string | null = goalId;
    const visited = new Set<string>(); // Prevent infinite loops

    while (currentGoalId && !visited.has(currentGoalId)) {
      visited.add(currentGoalId);

      // Fetch the goal to get its previousGoalId
      const goalResult = await getGoalByIdAction(currentGoalId);
      if (!goalResult.success || !goalResult.data) break;

      const goal = goalResult.data;

      // Only fetch review if this goal was rejected
      if (goal.status === 'rejected') {
        const reviewResult = await getSupervisorReviewsAction({
          goalId: currentGoalId,
          pagination: { limit: 1 }
        });

        if (reviewResult.success && reviewResult.data?.items?.[0]) {
          history.unshift(reviewResult.data.items[0]); // Add at beginning (chronological order)
        }
      }

      // Move to previous goal in chain
      currentGoalId = goal.previousGoalId || null;
    }

    return history;
  }, []);

  /**
   * Load goals data from server
   *
   * This follows the same pattern as supervisor goal-review:
   * 1. Fetch goals and reviews in parallel
   * 2. Map reviews to goals using goal_id
   * 3. Fetch rejection history for goals with previousGoalId
   */
  const loadGoalData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all evaluation periods and users in parallel
      const [periodResult, usersResult] = await Promise.all([
        getCategorizedEvaluationPeriodsAction(),
        getUsersAction()
      ]);

      // Set users data
      if (usersResult.success && usersResult.data?.items) {
        setUsers(usersResult.data.items);
      }

      // Set current period and all periods
      if (periodResult.success && periodResult.data) {
        setCurrentPeriod(periodResult.data.current || null);

        // Combine all periods (past, current, future) into one array
        const allPeriodsArray = [
          ...(periodResult.data.past || []),
          ...(periodResult.data.current ? [periodResult.data.current] : []),
          ...(periodResult.data.future || [])
        ];
        setAllPeriods(allPeriodsArray);

        // Determine which period to use: selected period or current period
        const periodToUse = params?.selectedPeriodId
          ? allPeriodsArray.find(p => p.id === params.selectedPeriodId)
          : periodResult.data.current;

        if (!periodToUse) {
          setError(params?.selectedPeriodId ? '選択された評価期間が見つかりません' : '評価期間が設定されていません');
          setGoals([]);
          return;
        }

        const targetPeriodId = periodToUse.id;

        // Load goals first to get user's goals
        // Exclude 'rejected' status - rejected goals are replaced by new draft copies
        const goalsResult = await getGoalsAction({
          periodId: targetPeriodId,
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

        // Map reviews to goals and fetch rejection history for goals with previousGoalId
        const goalsWithReviews: GoalWithReview[] = await Promise.all(
          activeGoals.map(async (goal) => {
            // Fetch full rejection history if this goal has previousGoalId
            let rejectionHistory: SupervisorReview[] = [];
            if (goal.previousGoalId) {
              rejectionHistory = await fetchRejectionHistory(goal.previousGoalId);
            }

            return {
              ...goal,
              supervisorReview: reviewsMap.get(goal.id) || null,
              previousGoalReview: goal.previousGoalId ? reviewsMap.get(goal.previousGoalId) || null : null,
              rejectionHistory: rejectionHistory.length > 0 ? rejectionHistory : undefined
            };
          })
        );

        setGoals(goalsWithReviews);
      } else {
        setCurrentPeriod(null);
        setAllPeriods([]);
        setError('評価期間が設定されていません');
        setGoals([]);
      }
    } catch (err) {
      console.error('Error loading goal data:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [fetchRejectionHistory, params?.selectedPeriodId]);

  /**
   * Count goals with previousGoalId in draft status (rejected goals awaiting re-submission)
   * Only draft goals with previousGoalId need action from employee
   */
  const resubmissionCount = useMemo(() => {
    return goals.filter(goal =>
      goal.status === 'draft' &&
      goal.previousGoalId !== null &&
      goal.previousGoalId !== undefined
    ).length;
  }, [goals]);

  /**
   * Group goals by employee (user_id) - sorted alphabetically by employee name
   */
  const groupedGoals = useMemo(() => {
    const userGoalsMap = new Map<string, GoalWithReview[]>();

    // Group goals by user_id
    goals.forEach(goal => {
      if (!userGoalsMap.has(goal.userId)) {
        userGoalsMap.set(goal.userId, []);
      }
      userGoalsMap.get(goal.userId)!.push(goal);
    });

    // Convert to GroupedGoals array
    const grouped: GroupedGoals[] = [];
    userGoalsMap.forEach((userGoals, userId) => {
      const employee = users.find(user => user.id === userId);
      if (employee) {
        grouped.push({
          employee,
          goals: userGoals,
          goalCount: userGoals.length
        });
      }
    });

    // Sort by employee name
    return grouped.sort((a, b) => a.employee.name.localeCompare(b.employee.name, 'ja'));
  }, [goals, users]);

  /**
   * Filter goals based on selected statuses, resubmissions flag, and selected employee
   */
  const filteredGoals = useMemo(() => {
    let result = goals;

    // Step 1: Filter by selected employee (if any)
    if (selectedEmployeeId) {
      result = result.filter(goal => goal.userId === selectedEmployeeId);
    }

    // Step 2: Filter by status
    if (selectedStatuses.length > 0) {
      result = result.filter(goal => selectedStatuses.includes(goal.status));
    }

    // Step 3: Filter by resubmissions only (if checked)
    // Only show draft goals with previousGoalId (rejected goals awaiting re-submission)
    if (showResubmissionsOnly) {
      result = result.filter(goal =>
        goal.status === 'draft' &&
        goal.previousGoalId !== null &&
        goal.previousGoalId !== undefined
      );
    }

    return result;
  }, [goals, selectedEmployeeId, selectedStatuses, showResubmissionsOnly]);

  /**
   * Load data on mount
   */
  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  return {
    goals,
    filteredGoals,
    groupedGoals,
    selectedEmployeeId,
    isLoading,
    error,
    selectedStatuses,
    currentPeriod,
    allPeriods,
    showResubmissionsOnly,
    resubmissionCount,
    setSelectedStatuses,
    setShowResubmissionsOnly,
    setSelectedEmployeeId,
    refetch: loadGoalData,
  };
}
