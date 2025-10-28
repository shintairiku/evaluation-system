import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAdminGoalsAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getUsersAction } from '@/api/server-actions/users';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import type {
  GoalResponse,
  GoalStatus,
  EvaluationPeriod,
  SupervisorReview,
  UserDetailResponse,
  DepartmentResponse,
} from '@/api/types';

/**
 * Extended GoalResponse with optional supervisorReview and rejectionHistory
 */
type GoalWithReview = GoalResponse & {
  supervisorReview?: SupervisorReview | null;
  rejectionHistory?: SupervisorReview[];
};

/**
 * Return type for the useAdminGoalListData hook
 */
export interface UseAdminGoalListDataReturn {
  /** All goals loaded from server */
  goals: GoalWithReview[];
  /** Goals after applying client-side filters */
  filteredGoals: GoalWithReview[];
  /** Goals after pagination (current page only) */
  paginatedGoals: GoalWithReview[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Search query */
  searchQuery: string;
  /** Currently selected status filters */
  selectedStatuses: GoalStatus[];
  /** Currently selected goal category */
  selectedGoalCategory: string;
  /** Currently selected department ID */
  selectedDepartmentId: string;
  /** Currently selected user ID */
  selectedUserId: string;
  /** Selected user data (for EmployeeInfoCard) */
  selectedUserData: UserDetailResponse | null;
  /** Current evaluation period */
  currentPeriod: EvaluationPeriod | null;
  /** All available evaluation periods */
  allPeriods: EvaluationPeriod[];
  /** All users in organization */
  users: UserDetailResponse[];
  /** All departments in organization */
  departments: DepartmentResponse[];
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Items per page */
  itemsPerPage: number;
  /** Total pages */
  totalPages: number;
  /** Function to update search query */
  setSearchQuery: (query: string) => void;
  /** Function to update status filters */
  setSelectedStatuses: (statuses: GoalStatus[]) => void;
  /** Function to update goal category filter */
  setSelectedGoalCategory: (category: string) => void;
  /** Function to update department filter */
  setSelectedDepartmentId: (id: string) => void;
  /** Function to update user filter */
  setSelectedUserId: (id: string) => void;
  /** Function to change page */
  setCurrentPage: (page: number) => void;
  /** Function to change items per page */
  setItemsPerPage: (count: number) => void;
  /** Function to reload data */
  refetch: () => Promise<void>;
}

/**
 * Input parameters for the useAdminGoalListData hook
 */
export interface UseAdminGoalListDataParams {
  /** Optional: Specific period ID to load. If not provided, uses current period */
  selectedPeriodId?: string;
}

/**
 * Custom hook to manage admin goal list data loading, filtering, and pagination.
 *
 * Features:
 * - Fetches ALL users' goals in organization WITH embedded reviews (admin-only)
 * - Provides multiple filters: status, category, department, user
 * - Client-side filtering and pagination for smooth UX
 * - Handles loading and error states
 * - Auto-loads on mount
 *
 * Performance Optimization:
 * - Uses includeReviews=true by default (batch optimization)
 * - Loads all data once, then filters client-side
 * - Eliminates N+1 query problems
 *
 * Data Flow:
 * 1. Load evaluation periods, users, and departments in parallel
 * 2. Determine which period to use (selected or current)
 * 3. Load ALL goals WITH embedded reviews in a single optimized request
 * 4. Apply client-side filtering based on selected filters
 * 5. Apply client-side pagination
 *
 * @param params - Optional parameters including selectedPeriodId
 * @returns Object containing goals data, filters, pagination, and control functions
 *
 * @example
 * ```tsx
 * const {
 *   paginatedGoals,
 *   filteredGoals,
 *   isLoading,
 *   setSelectedStatuses,
 *   setCurrentPage,
 * } = useAdminGoalListData({ selectedPeriodId: 'period-123' });
 * ```
 */
export function useAdminGoalListData(params?: UseAdminGoalListDataParams): UseAdminGoalListDataReturn {
  // Data state
  const [goals, setGoals] = useState<GoalWithReview[]>([]);
  const [users, setUsers] = useState<UserDetailResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatuses, setSelectedStatuses] = useState<GoalStatus[]>([]);
  const [selectedGoalCategory, setSelectedGoalCategory] = useState<string>('all'); // 'all' means "all"
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all'); // 'all' means "all"
  const [selectedUserId, setSelectedUserId] = useState<string>('all'); // 'all' means "all"

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  /**
   * Get selected user data for EmployeeInfoCard
   */
  const selectedUserData = useMemo(() => {
    if (!selectedUserId || selectedUserId === 'all') return null;
    return users.find(user => user.id === selectedUserId) || null;
  }, [selectedUserId, users]);

  /**
   * Load goals data from server (admin endpoint)
   *
   * Performance optimization:
   * - Loads all data in parallel
   * - Uses includeReviews=true by default for batch optimization
   * - Client-side filtering for smooth UX
   */
  const loadGoalData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load evaluation periods, users, and departments in parallel
      const [periodResult, usersResult, departmentsResult] = await Promise.all([
        getCategorizedEvaluationPeriodsAction(),
        getUsersAction(),
        getDepartmentsAction(),
      ]);

      // Set users data
      if (usersResult.success && usersResult.data?.items) {
        setUsers(usersResult.data.items);
      }

      // Set departments data
      if (departmentsResult.success && departmentsResult.data) {
        // Check if data is an array directly or has items property
        const departmentsArray = Array.isArray(departmentsResult.data)
          ? departmentsResult.data
          : departmentsResult.data.items;

        if (departmentsArray && departmentsArray.length > 0) {
          setDepartments(departmentsArray);
        }
      }

      // Set current period and all periods
      if (periodResult.success && periodResult.data) {
        setCurrentPeriod(periodResult.data.current || null);

        const allPeriodsArray = periodResult.data.all || [];
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

        // Performance optimization: Load ALL goals WITH embedded reviews in a single request
        // Admin endpoint: shows ALL users' goals (no user filtering)
        const goalsResult = await getAdminGoalsAction({
          periodId: targetPeriodId,
          limit: 100, // Backend max limit
          includeReviews: true, // Default: true (batch optimization)
        });

        if (!goalsResult.success || !goalsResult.data?.items) {
          setError(goalsResult.error || '目標の読み込みに失敗しました');
          return;
        }

        const goals = goalsResult.data.items;

        // Reviews are already embedded in the goal objects (performance optimization)
        const goalsWithReviews: GoalWithReview[] = goals.map(goal => ({
          ...goal,
          supervisorReview: goal.supervisorReview || null,
          rejectionHistory: goal.rejectionHistory,
        }));

        setGoals(goalsWithReviews);
      } else {
        setCurrentPeriod(null);
        setAllPeriods([]);
        setError('評価期間が設定されていません');
        setGoals([]);
      }
    } catch (err) {
      console.error('Error loading admin goal data:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [params?.selectedPeriodId]);

  /**
   * Filter goals based on selected filters (client-side)
   */
  const filteredGoals = useMemo(() => {
    let result = goals;

    // Filter by search query (title or user name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(goal => {
        const titleMatch = goal.title?.toLowerCase().includes(query);
        const user = users.find(u => u.id === goal.userId);
        const userNameMatch = user?.name?.toLowerCase().includes(query);
        return titleMatch || userNameMatch;
      });
    }

    // Filter by user (skip if 'all')
    if (selectedUserId && selectedUserId !== 'all') {
      result = result.filter(goal => goal.userId === selectedUserId);
    }

    // Filter by department (skip if 'all')
    if (selectedDepartmentId && selectedDepartmentId !== 'all') {
      result = result.filter(goal => {
        const user = users.find(u => u.id === goal.userId);
        return user?.department?.id === selectedDepartmentId;
      });
    }

    // Filter by status
    if (selectedStatuses.length > 0) {
      result = result.filter(goal => selectedStatuses.includes(goal.status));
    }

    // Filter by goal category (skip if 'all')
    if (selectedGoalCategory && selectedGoalCategory !== 'all') {
      result = result.filter(goal => goal.goalCategory === selectedGoalCategory);
    }

    return result;
  }, [goals, searchQuery, selectedUserId, selectedDepartmentId, selectedStatuses, selectedGoalCategory, users]);

  /**
   * Calculate total pages based on filtered results
   */
  const totalPages = useMemo(() => {
    return Math.ceil(filteredGoals.length / itemsPerPage);
  }, [filteredGoals.length, itemsPerPage]);

  /**
   * Paginate filtered goals (client-side)
   */
  const paginatedGoals = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredGoals.slice(startIndex, endIndex);
  }, [filteredGoals, currentPage, itemsPerPage]);

  /**
   * Load data on mount or when period changes
   */
  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  /**
   * Reset to page 1 when filters change
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedUserId, selectedDepartmentId, selectedStatuses, selectedGoalCategory]);

  return {
    goals,
    filteredGoals,
    paginatedGoals,
    isLoading,
    error,
    searchQuery,
    selectedStatuses,
    selectedGoalCategory,
    selectedDepartmentId,
    selectedUserId,
    selectedUserData,
    currentPeriod,
    allPeriods,
    users,
    departments,
    currentPage,
    itemsPerPage,
    totalPages,
    setSearchQuery,
    setSelectedStatuses,
    setSelectedGoalCategory,
    setSelectedDepartmentId,
    setSelectedUserId,
    setCurrentPage,
    setItemsPerPage,
    refetch: loadGoalData,
  };
}
