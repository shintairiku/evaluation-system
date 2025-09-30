import { useState, useEffect, useCallback } from 'react';
import { getPendingSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import { getUsersAction } from '@/api/server-actions/users';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
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
 * instead of Goals table. This provides better performance (1 API call vs 2) and
 * aligns with the intended system architecture where supervisor_review contains
 * the subordinate_id field for direct filtering.
 *
 * Maintains backward compatibility with existing UI components by converting
 * supervisor review data to the expected GroupedGoals format.
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

      // Load supervisor reviews and users data in parallel for better performance
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

      // Group reviews by subordinate (employee) and create mock goals for compatibility
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

      // Convert supervisor reviews to grouped goals format for UI compatibility
      subordinateReviewsMap.forEach((subordinateReviews, subordinateId) => {
        const employee = users.find(user => user.id === subordinateId);
        if (employee) {
          // Create mock goals from supervisor reviews for UI compatibility
          const mockGoals: GoalResponse[] = subordinateReviews.map(review => ({
            id: review.goal_id,
            userId: review.subordinate_id,
            periodId: review.period_id,
            goalCategory: '業績目標', // Default category - will be populated from actual goal data if needed
            weight: 1, // Default weight - will be populated from actual goal data if needed
            status: 'submitted' as const,
            createdAt: review.created_at,
            updatedAt: review.updated_at,
            // Note: Other goal fields would need to be fetched separately if needed
            // For now, we'll use minimal data required for the approval interface
          }));

          grouped.push({
            employee,
            goals: mockGoals,
            pendingCount: mockGoals.length
          });

          totalGoals += mockGoals.length;
        }
      });

      setTotalPendingCount(totalGoals);

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