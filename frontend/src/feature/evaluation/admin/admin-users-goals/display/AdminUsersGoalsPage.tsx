'use client';

import { useState } from 'react';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { AdminUsersGoalsFilters } from '../components/AdminUsersGoalsFilters';
import { AdminUsersGoalsTable } from '../components/AdminUsersGoalsTable';
import { useAdminUsersGoalsData } from '../hooks/useAdminUsersGoalsData';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Props for AdminUsersGoalsPage component
 */
interface AdminUsersGoalsPageProps {
  /** Optional: Specific period ID to load. If not provided, uses current period */
  selectedPeriodId?: string;
}

/**
 * Admin Users Goals Page - User-Centric Goal View
 *
 * Features:
 * - Shows ALL users in organization with aggregated goal data
 * - One row per user (not per goal) for easy compliance tracking
 * - Concurrent data fetching for fast load times (5x faster)
 * - Multiple filters: department, stage, status
 * - Client-side filtering and pagination for smooth UX
 * - Click user row to see detailed goals
 *
 * Performance:
 * - Uses Promise.allSettled for concurrent page fetching
 * - Target: p95 load time ≤ 2 seconds for 5k-10k goals
 * - Client-side aggregation and filtering
 *
 * @param props - Component props
 * @returns JSX element containing the admin users goals page
 */
export default function AdminUsersGoalsPage({ selectedPeriodId }: AdminUsersGoalsPageProps) {
  const [internalSelectedPeriodId, setInternalSelectedPeriodId] = useState<string>(
    selectedPeriodId || ''
  );

  const {
    filteredUserSummaries,
    paginatedUserSummaries,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedDepartmentId,
    setSelectedDepartmentId,
    selectedStageId,
    setSelectedStageId,
    selectedStatusFilter,
    setSelectedStatusFilter,
    currentPeriod,
    allPeriods,
    resolvedPeriodId,
    departments,
    stages,
    users,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    refetch,
  } = useAdminUsersGoalsData({ selectedPeriodId: internalSelectedPeriodId || undefined });

  /**
   * Handle period change
   */
  const handlePeriodChange = (periodId: string) => {
    setInternalSelectedPeriodId(periodId);
    setCurrentPage(1);
  };

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

  const activeSelectorPeriodId =
    internalSelectedPeriodId || resolvedPeriodId || allPeriods[0]?.id || '';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ユーザー別目標一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            全ユーザーの目標設定状況 ({filteredUserSummaries.length}名)
          </p>
        </div>

        {/* Period Selector (REUSE existing component) */}
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

      {/* Filters Section */}
      <AdminUsersGoalsFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDepartmentId={selectedDepartmentId}
        onDepartmentChange={setSelectedDepartmentId}
        selectedStageId={selectedStageId}
        onStageChange={setSelectedStageId}
        selectedStatusFilter={selectedStatusFilter}
        onStatusFilterChange={setSelectedStatusFilter}
        departments={departments}
        stages={stages}
      />

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refetch}>
              再読み込み
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Users Table */}
      {!error && (
        <div className="bg-card border rounded-lg">
          <AdminUsersGoalsTable
            userSummaries={paginatedUserSummaries}
            isLoading={isLoading}
            users={users}
          />
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            表示: {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, filteredUserSummaries.length)} /{' '}
            {filteredUserSummaries.length}名
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
