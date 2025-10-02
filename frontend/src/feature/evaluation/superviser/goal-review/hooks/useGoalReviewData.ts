import { useState, useEffect, useCallback } from 'react';
import { getPendingSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import { getUsersAction } from '@/api/server-actions/users';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getGoalsAction } from '@/api/server-actions/goals';
import type { GoalResponse, UserDetailResponse, EvaluationPeriod, SupervisorReview } from '@/api/types';

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
  /** Map of goal_id to supervisor_review_id for approval actions */
  goalToReviewMap: Map<string, string>;
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
 *
 * ARCHITECTURAL MIGRATION: Now uses supervisor_review table as primary data source
 * for identifying which goals need review, then fetches complete goal data separately.
 * This aligns with the intended system architecture where supervisor_review contains
 * the subordinate_id field for direct filtering.
 *
 * Data Flow:
 * 1. Load supervisor reviews (identifies goals needing review)
 * 2. Load all submitted goals for the period (gets complete goal data)
 * 3. Map reviews to real goals using goal_id
 * 4. Group by employee for UI display
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

      // Load current evaluation period using categorized periods action
      const periodResult = await getCategorizedEvaluationPeriodsAction();
      if (periodResult.success && periodResult.data?.current) {
        setCurrentPeriod(periodResult.data.current);
      } else {
        setCurrentPeriod(null);
      }

      // Load supervisor reviews and users first
      const [reviewsResult, usersResult] = await Promise.all([
        getPendingSupervisorReviewsAction({
          pagination: { limit: 100 }
        }),
        getUsersAction()
      ]);

      let reviews: SupervisorReview[] = [];
      let users: UserDetailResponse[] = [];

      if (reviewsResult.success && reviewsResult.data?.items) {
        reviews = reviewsResult.data.items;
      }

      if (usersResult.success && usersResult.data?.items) {
        users = usersResult.data.items;
      }

      // Extract unique subordinate IDs from reviews to fetch their goals
      const subordinateIds = [...new Set(reviews.map(r => r.subordinate_id))];

      // Fetch goals for each subordinate separately (since bulk fetch may not work without GOAL_READ_SUBORDINATES permission)
      let goals: GoalResponse[] = [];
      if (periodResult.success && periodResult.data?.current && subordinateIds.length > 0) {
        const goalsPromises = subordinateIds.map(subordinateId =>
          getGoalsAction({
            periodId: periodResult.data!.current!.id,
            status: 'submitted',
            userId: subordinateId,
            limit: 100
          })
        );

        const goalsResults = await Promise.all(goalsPromises);

        goalsResults.forEach((result) => {
          if (result.success && result.data?.items) {
            goals.push(...result.data.items);
          }
        });
      }

      // Create a map of goals by ID for quick lookup
      const goalsMap = new Map<string, GoalResponse>();
      goals.forEach(goal => {
        goalsMap.set(goal.id, goal);
      });

      // Group reviews by subordinate (employee) and map to real goals
      const subordinateReviewsMap = new Map<string, SupervisorReview[]>();
      reviews.forEach(review => {
        const subordinateId = review.subordinate_id;
        if (!subordinateReviewsMap.has(subordinateId)) {
          subordinateReviewsMap.set(subordinateId, []);
        }
        subordinateReviewsMap.get(subordinateId)!.push(review);
      });

      const grouped: GroupedGoals[] = [];
      let totalGoals = 0;

      // Convert supervisor reviews to grouped goals format using real goal data
      subordinateReviewsMap.forEach((subordinateReviews, subordinateId) => {
        const employee = users.find(user => user.id === subordinateId);
        if (employee) {
          // Create map of goal_id to supervisor_review_id for this employee
          const goalToReviewMap = new Map<string, string>();

          // Map reviews to real goals using the goals map
          const employeeGoals: GoalResponse[] = subordinateReviews
            .map(review => {
              const goal = goalsMap.get(review.goal_id);
              if (goal) {
                // Store the mapping goal_id → review_id
                goalToReviewMap.set(review.goal_id, review.id);
              }
              return goal;
            })
            .filter((goal): goal is GoalResponse => goal !== undefined);

          // Only add employee if they have goals
          if (employeeGoals.length > 0) {
            grouped.push({
              employee,
              goals: employeeGoals,
              pendingCount: employeeGoals.length,
              goalToReviewMap  // Add the mapping for approval actions
            });

            totalGoals += employeeGoals.length;
          }
        }
      });

      setTotalPendingCount(totalGoals);

      setGroupedGoals(grouped);

      // Set first employee as selected by default (only if not already set)
      if (grouped.length > 0) {
        setSelectedEmployeeId(prev => prev || grouped[0].employee.id);
      }

    } catch (err) {
      console.error('Error loading goal data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

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