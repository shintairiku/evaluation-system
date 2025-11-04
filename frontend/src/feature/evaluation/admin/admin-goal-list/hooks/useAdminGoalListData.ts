import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getAdminGoalsAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getUsersAction } from '@/api/server-actions/users';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import type {
  GoalResponse,
  GoalStatus,
  EvaluationPeriod,
  UserDetailResponse,
  Department,
} from '@/api/types';

/**
 * Return type for the useAdminGoalListData hook
 */
export interface UseAdminGoalListDataReturn {
  /** All goals loaded from server */
  goals: GoalResponse[];
  /** Goals after applying client-side filters */
  filteredGoals: GoalResponse[];
  /** Goals after pagination (current page only) */
  paginatedGoals: GoalResponse[];
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
  /** Evaluation period id actually used to fetch goals */
  resolvedPeriodId: string | null;
  /** All users in organization */
  users: UserDetailResponse[];
  /** All departments in organization */
  departments: Department[];
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
  const [goals, setGoals] = useState<GoalResponse[]>([]);
  const [users, setUsers] = useState<UserDetailResponse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [resolvedPeriodId, setResolvedPeriodId] = useState<string | null>(
    params?.selectedPeriodId ?? null
  );
  const resolvedPeriodIdRef = useRef<string | null>(params?.selectedPeriodId ?? null);

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
      if (departmentsResult.success && Array.isArray(departmentsResult.data) && departmentsResult.data.length > 0) {
        setDepartments(departmentsResult.data);
      }

      // Set current period and all periods
      if (periodResult.success && periodResult.data) {
        const allPeriodsArray = periodResult.data.all || [];
        setAllPeriods(allPeriodsArray);

        // Always keep the true "current" (active) period for selector highlighting
        setCurrentPeriod(periodResult.data.current || null);

        // Determine which period to use: selected (if valid) > current active > first available
        let periodToUse: EvaluationPeriod | undefined;
        let requestedPeriodMissing = false;

        if (params?.selectedPeriodId) {
          periodToUse = allPeriodsArray.find(p => p.id === params.selectedPeriodId);
          if (!periodToUse) {
            requestedPeriodMissing = true;
          }
        }

        const fallbackPeriod = periodResult.data.current ?? allPeriodsArray[0];
        if (!periodToUse && fallbackPeriod) {
          periodToUse = fallbackPeriod;
        }

        if (!periodToUse) {
          resolvedPeriodIdRef.current = null;
          setResolvedPeriodId(null);
          setError('評価期間が設定されていません');
          setGoals([]);
          return;
        }

        const targetPeriodId = periodToUse.id;
        const previousResolvedId = resolvedPeriodIdRef.current;
        if (!previousResolvedId || previousResolvedId !== targetPeriodId) {
          setCurrentPage(1);
        }
        resolvedPeriodIdRef.current = targetPeriodId;
        setResolvedPeriodId(targetPeriodId);

        if (requestedPeriodMissing) {
          console.warn(
            `Requested evaluation period (${params?.selectedPeriodId}) not found. Falling back to ${targetPeriodId}.`
          );
        }

        // Performance optimization: Load ALL goals WITH embedded reviews in a single request
        // Admin endpoint: shows ALL users' goals (no user filtering)
        const PER_PAGE_LIMIT = 100; // Backend maximum per request
        const allGoals: GoalResponse[] = [];

        // Fetch first page
        const firstPageResult = await getAdminGoalsAction({
          periodId: targetPeriodId,
          page: 1,
          limit: PER_PAGE_LIMIT,
          includeReviews: true, // Default: true (batch optimization)
        });

        if (!firstPageResult.success || !firstPageResult.data?.items) {
          setError(firstPageResult.error || '目標の読み込みに失敗しました');
          return;
        }

        allGoals.push(...firstPageResult.data.items);

        const totalPages = firstPageResult.data.pages ?? 1;

        // Fetch remaining pages sequentially to avoid silent truncation
        for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
          const pageResult = await getAdminGoalsAction({
            periodId: targetPeriodId,
            page: nextPage,
            limit: PER_PAGE_LIMIT,
            includeReviews: true,
          });

          if (!pageResult.success || !pageResult.data?.items) {
            setError(pageResult.error || '追加の目標データ取得に失敗しました');
            return;
          }

          allGoals.push(...pageResult.data.items);
        }

        // Reviews are already embedded in the goal objects (performance optimization)
        setGoals(allGoals);
      } else {
        setCurrentPeriod(null);
        setAllPeriods([]);
        resolvedPeriodIdRef.current = null;
        setResolvedPeriodId(null);
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
    resolvedPeriodId,
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
