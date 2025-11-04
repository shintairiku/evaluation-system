'use client';

import React, { useState } from 'react';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import { AdminGoalListFilters } from '../components/AdminGoalListFilters';
import { AdminGoalListTable } from '../components/AdminGoalListTable';
import { useAdminGoalListData } from '../hooks/useAdminGoalListData';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Props for AdminGoalListPage component
 */
interface AdminGoalListPageProps {
  /** Optional: Specific period ID to load. If not provided, uses current period */
  selectedPeriodId?: string;
}

/**
 * Admin Goal List Page - System-wide goal visualization
 *
 * Features:
 * - Shows ALL users' goals in organization (admin-only)
 * - Multiple filters: status, category, department, user
 * - Client-side filtering and pagination for smooth UX
 * - Read-only view (no editing or approving)
 * - Employee info card when user filter selected
 *
 * Component Reuse Strategy:
 * - EvaluationPeriodSelector: Existing component (use as-is)
 * - EmployeeInfoCard: Existing component (show when user filter selected)
 * - GoalStatusBadge: Used in AdminGoalListTable
 *
 * Performance:
 * - Loads all data once with batch optimization (includeReviews=true)
 * - Client-side filtering for instant response
 * - Client-side pagination (50 items per page)
 *
 * @param props - Component props
 * @returns JSX element containing the admin goal list page
 *
 * @example
 * ```tsx
 * // Use current period
 * <AdminGoalListPage />
 *
 * // Use specific period
 * <AdminGoalListPage selectedPeriodId="period-123" />
 * ```
 */
export default function AdminGoalListPage({ selectedPeriodId }: AdminGoalListPageProps) {
  const [internalSelectedPeriodId, setInternalSelectedPeriodId] = useState<string>(
    selectedPeriodId || ''
  );

  const {
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
    refetch,
  } = useAdminGoalListData({ selectedPeriodId: internalSelectedPeriodId || undefined });

  /**
   * Build user map for quick lookup in table
   */
  const userMap = React.useMemo(() => {
    const map = new Map<string, { name: string; departmentName?: string; supervisorName?: string }>();
    users.forEach((user) => {
      map.set(user.id, {
        name: user.name,
        departmentName: user.department?.name,
        supervisorName: user.supervisor?.name,
      });
    });
    return map;
  }, [users]);

  /**
   * Handle period change
   */
  const handlePeriodChange = (periodId: string) => {
    setInternalSelectedPeriodId(periodId);
    setCurrentPage(1);
  };

  const activeSelectorPeriodId =
    internalSelectedPeriodId || resolvedPeriodId || allPeriods[0]?.id || '';

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top when page changes
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">管理者用目標一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            全ユーザーの目標を表示 ({filteredGoals.length}件)
          </p>
        </div>

        {/* Period Selector (REUSE) */}
        {allPeriods.length > 0 && (
          <EvaluationPeriodSelector
            periods={allPeriods}
            selectedPeriodId={activeSelectorPeriodId}
            currentPeriodId={currentPeriod?.id || null}
            onPeriodChange={handlePeriodChange}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Search and Filters Section */}
      <AdminGoalListFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedStatuses={selectedStatuses}
        onStatusChange={setSelectedStatuses}
        selectedGoalCategory={selectedGoalCategory}
        onGoalCategoryChange={setSelectedGoalCategory}
        selectedDepartmentId={selectedDepartmentId}
        onDepartmentChange={setSelectedDepartmentId}
        selectedUserId={selectedUserId}
        onUserChange={setSelectedUserId}
        users={users}
        departments={departments}
      />

      {/* Employee Info Card (REUSE - show when user filter selected) */}
      {selectedUserId && selectedUserData && (
        <EmployeeInfoCard employee={selectedUserData} />
      )}

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
            再読み込み
          </Button>
        </div>
      )}

      {/* Goals Table */}
      {!error && (
        <div className="bg-card border rounded-lg">
          <AdminGoalListTable
            goals={paginatedGoals}
            userMap={userMap}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            表示: {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, filteredGoals.length)} / {filteredGoals.length}件
          </p>

          <div className="flex items-center gap-2">
            {/* Previous button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              前へ
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Show pages around current page
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-9 h-9"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            {/* Next button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              次へ
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
