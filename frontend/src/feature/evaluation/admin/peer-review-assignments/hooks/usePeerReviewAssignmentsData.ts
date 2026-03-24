import { useState, useEffect, useMemo, useCallback } from 'react';
import { getAssignmentsAction, bulkAssignReviewersAction } from '@/api/server-actions/peer-reviews';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getAllUsersAction } from '@/api/server-actions/users';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import { useOptionalCurrentUserContext } from '@/context/CurrentUserContext';
import type {
  EvaluationPeriod,
  UserDetailResponse,
  Department,
  PeerReviewAssignmentsByReviewee,
  BulkAssignReviewersResponse,
} from '@/api/types';

/**
 * Local state for reviewer assignments per reviewee (for bulk save).
 */
export interface LocalReviewerAssignment {
  reviewer1Id: string | null;
  reviewer2Id: string | null;
}

/**
 * Row data combining user info with assignment state.
 */
export interface AssignmentRow {
  user: UserDetailResponse;
  serverAssignment: PeerReviewAssignmentsByReviewee | null;
  local: LocalReviewerAssignment;
  isDirty: boolean;
}

export interface UsePeerReviewAssignmentsDataParams {
  selectedPeriodId?: string;
  initialPeriods?: EvaluationPeriod[];
  initialActivePeriod?: EvaluationPeriod | null;
  initialUsers?: UserDetailResponse[];
  initialDepartments?: Department[];
}

export interface UsePeerReviewAssignmentsDataReturn {
  rows: AssignmentRow[];
  filteredRows: AssignmentRow[];
  paginatedRows: AssignmentRow[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveError: string | null;
  searchQuery: string;
  selectedDepartmentId: string;
  currentPeriod: EvaluationPeriod | null;
  allPeriods: EvaluationPeriod[];
  resolvedPeriodId: string | null;
  users: UserDetailResponse[];
  departments: Department[];
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  dirtyCount: number;
  stats: { total: number; assigned: number; partial: number; unassigned: number };
  setSearchQuery: (query: string) => void;
  setSelectedDepartmentId: (id: string) => void;
  setCurrentPage: (page: number) => void;
  setReviewerForRow: (revieweeId: string, slot: 1 | 2, reviewerId: string | null) => void;
  saveAllChanges: () => Promise<BulkAssignReviewersResponse | null>;
  isRandomAssigned: boolean;
  toggleRandomAssign: () => number;
  refetch: () => Promise<void>;
}

export function usePeerReviewAssignmentsData(
  params?: UsePeerReviewAssignmentsDataParams
): UsePeerReviewAssignmentsDataReturn {
  const currentUserContext = useOptionalCurrentUserContext();

  // Determine if SSR data was provided
  const hasInitialData = !!(
    params?.initialPeriods?.length &&
    params?.initialUsers?.length
  );

  // Data state — initialize from SSR props when available
  const [users, setUsers] = useState<UserDetailResponse[]>(params?.initialUsers ?? []);
  const [departments, setDepartments] = useState<Department[]>(params?.initialDepartments ?? []);
  const [serverAssignments, setServerAssignments] = useState<PeerReviewAssignmentsByReviewee[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(
    params?.initialActivePeriod ?? null
  );
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>(params?.initialPeriods ?? []);
  const [resolvedPeriodId, setResolvedPeriodId] = useState<string | null>(
    params?.selectedPeriodId ?? params?.initialActivePeriod?.id ?? null
  );

  // Local assignment edits (revieweeId → local state)
  const [localAssignments, setLocalAssignments] = useState<Map<string, LocalReviewerAssignment>>(
    new Map()
  );

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  /**
   * Initialize local assignments from server data.
   */
  const initLocalAssignments = useCallback(
    (assignments: PeerReviewAssignmentsByReviewee[], allUsers: UserDetailResponse[]) => {
      const map = new Map<string, LocalReviewerAssignment>();
      // Initialize all users with null/null
      for (const user of allUsers) {
        map.set(user.id, { reviewer1Id: null, reviewer2Id: null });
      }
      // Populate from server assignments
      for (const group of assignments) {
        const sorted = [...group.assignments].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        map.set(group.revieweeId, {
          reviewer1Id: sorted[0]?.reviewerId ?? null,
          reviewer2Id: sorted[1]?.reviewerId ?? null,
        });
      }
      setLocalAssignments(map);
    },
    []
  );

  /**
   * Load all data.
   * When SSR initial data is available (hasInitialData), skips fetching
   * periods/users/departments and only fetches assignments.
   * On refetch (after save, period change), fetches everything fresh.
   */
  const loadData = useCallback(async (skipStaticData = false) => {
    try {
      setIsLoading(true);
      setError(null);
      setSaveError(null);

      let loadedUsers = users;
      let loadedAllPeriods = allPeriods;
      let resolvedCurrentPeriod = currentPeriod;

      if (!skipStaticData) {
        // Full reload: fetch periods, users, departments from server
        const [periodsResult, usersResult, departmentsResult] = await Promise.all([
          getCategorizedEvaluationPeriodsAction(),
          getAllUsersAction({ include: 'department,stage,supervisor' }),
          getDepartmentsAction(),
        ]);

        if (!periodsResult.success || !periodsResult.data) {
          setAllPeriods([]);
          setCurrentPeriod(null);
          setResolvedPeriodId(null);
          setError('評価期間が設定されていません');
          return;
        }

        loadedAllPeriods = periodsResult.data.all || [];
        resolvedCurrentPeriod =
          currentUserContext?.currentPeriod ?? periodsResult.data.current ?? null;
        setAllPeriods(loadedAllPeriods);
        setCurrentPeriod(resolvedCurrentPeriod);

        loadedUsers =
          usersResult.success && usersResult.data ? usersResult.data : [];
        setUsers(loadedUsers);

        if (departmentsResult.success && Array.isArray(departmentsResult.data)) {
          setDepartments(departmentsResult.data);
        }
      }

      // Resolve which period to use
      let periodToUse: EvaluationPeriod | undefined;
      if (params?.selectedPeriodId) {
        periodToUse = loadedAllPeriods.find(p => p.id === params.selectedPeriodId);
      }
      if (!periodToUse) {
        periodToUse = resolvedCurrentPeriod ?? loadedAllPeriods[0];
      }

      if (!periodToUse) {
        setResolvedPeriodId(null);
        setError('評価期間が設定されていません');
        return;
      }

      const targetPeriodId = periodToUse.id;
      setResolvedPeriodId(targetPeriodId);

      // Fetch assignments for the period
      const assignmentsResult = await getAssignmentsAction(targetPeriodId);

      const loadedAssignments =
        assignmentsResult.success && assignmentsResult.data ? assignmentsResult.data : [];
      setServerAssignments(loadedAssignments);

      // Initialize local state from server
      initLocalAssignments(loadedAssignments, loadedUsers);
    } catch (err) {
      console.error('Error loading peer review assignments data:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.selectedPeriodId, initLocalAssignments]);

  /**
   * Build rows combining user + assignment data.
   */
  const rows = useMemo<AssignmentRow[]>(() => {
    return users.map(user => {
      const serverAssignment = serverAssignments.find(a => a.revieweeId === user.id) ?? null;
      const local = localAssignments.get(user.id) ?? { reviewer1Id: null, reviewer2Id: null };

      // Determine if this row has been modified from server state
      const serverLocal = {
        reviewer1Id: null as string | null,
        reviewer2Id: null as string | null,
      };
      if (serverAssignment) {
        const sorted = [...serverAssignment.assignments].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        serverLocal.reviewer1Id = sorted[0]?.reviewerId ?? null;
        serverLocal.reviewer2Id = sorted[1]?.reviewerId ?? null;
      }

      const isDirty =
        local.reviewer1Id !== serverLocal.reviewer1Id ||
        local.reviewer2Id !== serverLocal.reviewer2Id;

      return { user, serverAssignment, local, isDirty };
    });
  }, [users, serverAssignments, localAssignments]);

  /**
   * Filter rows.
   */
  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        r =>
          r.user.name.toLowerCase().includes(query) ||
          r.user.department?.name?.toLowerCase().includes(query)
      );
    }

    if (selectedDepartmentId !== 'all') {
      result = result.filter(r => r.user.department?.id === selectedDepartmentId);
    }

    return result;
  }, [rows, searchQuery, selectedDepartmentId]);

  /**
   * Stats.
   */
  const stats = useMemo(() => {
    const total = rows.length;
    let assigned = 0;
    let partial = 0;
    let unassigned = 0;

    for (const r of rows) {
      const has1 = !!r.local.reviewer1Id;
      const has2 = !!r.local.reviewer2Id;
      if (has1 && has2) assigned++;
      else if (has1 || has2) partial++;
      else unassigned++;
    }

    return { total, assigned, partial, unassigned };
  }, [rows]);

  const dirtyCount = useMemo(() => rows.filter(r => r.isDirty).length, [rows]);

  /**
   * Pagination.
   */
  const totalPages = useMemo(
    () => Math.ceil(filteredRows.length / itemsPerPage),
    [filteredRows.length, itemsPerPage]
  );

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage, itemsPerPage]);

  /**
   * Set reviewer for a specific row/slot.
   */
  const setReviewerForRow = useCallback(
    (revieweeId: string, slot: 1 | 2, reviewerId: string | null) => {
      setLocalAssignments(prev => {
        const next = new Map(prev);
        const current = next.get(revieweeId) ?? { reviewer1Id: null, reviewer2Id: null };
        next.set(revieweeId, {
          ...current,
          [slot === 1 ? 'reviewer1Id' : 'reviewer2Id']: reviewerId,
        });
        return next;
      });
    },
    []
  );

  // Tracks which user IDs were randomly assigned (to undo on next toggle)
  const [randomAssignedIds, setRandomAssignedIds] = useState<Set<string>>(new Set());
  const isRandomAssigned = randomAssignedIds.size > 0;

  /**
   * Toggle random assignment:
   * - 1st click: randomly assign 2 reviewers to each fully unassigned user
   * - 2nd click: undo only those random assignments (restore to null/null)
   * Returns the number of users affected.
   */
  const toggleRandomAssign = useCallback((): number => {
    if (isRandomAssigned) {
      // Undo: restore randomly assigned rows to null/null
      const count = randomAssignedIds.size;
      setLocalAssignments(prev => {
        const next = new Map(prev);
        for (const userId of randomAssignedIds) {
          next.set(userId, { reviewer1Id: null, reviewer2Id: null });
        }
        return next;
      });
      setRandomAssignedIds(new Set());
      return count;
    }

    // Assign: randomly pick 2 reviewers for each unassigned user
    const userIds = users.map(u => u.id);
    if (userIds.length < 3) return 0;

    let assignedCount = 0;
    const newRandomIds = new Set<string>();

    setLocalAssignments(prev => {
      const next = new Map(prev);

      for (const userId of userIds) {
        const current = next.get(userId) ?? { reviewer1Id: null, reviewer2Id: null };
        if (current.reviewer1Id || current.reviewer2Id) continue;

        const candidates = userIds.filter(id => id !== userId);

        // Fisher-Yates shuffle
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        if (candidates.length >= 2) {
          next.set(userId, {
            reviewer1Id: candidates[0],
            reviewer2Id: candidates[1],
          });
          newRandomIds.add(userId);
          assignedCount++;
        }
      }

      return next;
    });

    setRandomAssignedIds(newRandomIds);
    return assignedCount;
  }, [users, isRandomAssigned, randomAssignedIds]);

  /**
   * Save all dirty rows via a single bulk API call.
   */
  const saveAllChanges = useCallback(async (): Promise<BulkAssignReviewersResponse | null> => {
    if (!resolvedPeriodId) return null;

    const dirtyRows = rows.filter(r => r.isDirty);
    if (dirtyRows.length === 0) return null;

    // Pre-validate: ensure all dirty rows have both reviewers
    const validationErrors: string[] = [];
    const items = dirtyRows
      .filter(row => {
        const { reviewer1Id, reviewer2Id } = row.local;
        if (!reviewer1Id && !reviewer2Id) return false; // skip removal rows
        if (!reviewer1Id || !reviewer2Id) {
          validationErrors.push(`${row.user.name}: 2名の評価者を選択してください`);
          return false;
        }
        return true;
      })
      .map(row => ({
        revieweeId: row.user.id,
        reviewerIds: [row.local.reviewer1Id!, row.local.reviewer2Id!],
      }));

    if (validationErrors.length > 0) {
      setSaveError(validationErrors.join('\n'));
      return null;
    }

    if (items.length === 0) return null;

    setIsSaving(true);
    setSaveError(null);

    const result = await bulkAssignReviewersAction(resolvedPeriodId, items);

    if (!result.success || !result.data) {
      setSaveError(result.error || '保存に失敗しました');
      await loadData(false);
      setIsSaving(false);
      return null;
    }

    const response = result.data;

    if (response.failureCount > 0) {
      const errorMessages = response.results
        .filter(r => !r.success && r.error)
        .map(r => {
          const user = users.find(u => u.id === r.revieweeId);
          return `${user?.name ?? r.revieweeId}: ${r.error}`;
        });
      setSaveError(errorMessages.join('\n'));
    }

    // Reload to sync with server state
    await loadData(false);
    setRandomAssignedIds(new Set());
    setIsSaving(false);
    return response;
  }, [resolvedPeriodId, rows, users, loadData]);

  // Load on mount — skip static data if SSR provided it
  useEffect(() => {
    loadData(hasInitialData);
  }, [loadData, hasInitialData]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDepartmentId]);

  return {
    rows,
    filteredRows,
    paginatedRows,
    isLoading,
    isSaving,
    error,
    saveError,
    searchQuery,
    selectedDepartmentId,
    currentPeriod,
    allPeriods,
    resolvedPeriodId,
    users,
    departments,
    currentPage,
    itemsPerPage,
    totalPages,
    dirtyCount,
    stats,
    setSearchQuery,
    setSelectedDepartmentId,
    setCurrentPage,
    setReviewerForRow,
    saveAllChanges,
    isRandomAssigned,
    toggleRandomAssign,
    refetch: () => loadData(false),
  };
}
