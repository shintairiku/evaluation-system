'use client';

import React, { useMemo, useState } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { GoalCard } from '../components/GoalCard';
import { GoalListFilters } from '../components/GoalListFilters';
import { EmployeeSelector } from '../components/EmployeeSelector';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { useGoalListData } from '../hooks/useGoalListData';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useGoalListContext } from '@/context/GoalListContext';

/**
 * Main goal list page for employees to view and manage their goals.
 *
 * Features:
 * - Displays all goals for current evaluation period
 * - Filter by status (draft, submitted, approved, rejected)
 * - Shows rejection comments for rejected goals
 * - Provides actions based on goal status:
 *   - draft: Edit/Submit
 *   - submitted: View (read-only)
 *   - approved: View (read-only)
 *   - rejected: Edit & Resubmit
 *
 * Architecture:
 * - Uses useGoalListData hook for data management
 * - Uses GoalCard for individual goal display
 * - Uses GoalListFilters for filtering UI
 * - Uses GoalStatusBadge (existing) for status display
 * - Uses RejectionCommentBanner for rejection comments
 *
 * @returns JSX element containing the complete goal list interface
 */
export default function GoalListPage() {
  // State for selected period
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [dataSelectedPeriodId, setDataSelectedPeriodId] = useState<string | undefined>(undefined);

  const {
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
    refetch,
  } = useGoalListData({ selectedPeriodId: dataSelectedPeriodId });

  const { currentUser } = useUserRoles();

  // Get goal list context for rejected goals counter
  const { setRejectedGoalsCount } = useGoalListContext();

  // Keep sidebar rejected-goals badge in sync without refetching.
  React.useEffect(() => {
    if (!currentUser?.id) return;

    const rejectedDraftCount = goals.filter(
      goal => goal.userId === currentUser.id && goal.status === 'draft' && Boolean(goal.previousGoalId)
    ).length;

    setRejectedGoalsCount(rejectedDraftCount);
  }, [currentUser?.id, goals, setRejectedGoalsCount]);

  // Initialize selected period to current period when data loads
  React.useEffect(() => {
    if (!selectedPeriodId && currentPeriod) {
      setSelectedPeriodId(currentPeriod.id);
    }
  }, [currentPeriod, selectedPeriodId]);

  // Get selected employee info for display
  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return groupedGoals.find(g => g.employee.id === selectedEmployeeId)?.employee || null;
  }, [selectedEmployeeId, groupedGoals]);

  // Handle period change
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    setDataSelectedPeriodId(currentPeriod && periodId === currentPeriod.id ? undefined : periodId);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Page Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-9 w-80 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* Filter Skeleton */}
          <div className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>

          {/* Goals Skeleton */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>エラーが発生しました</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              再読み込み
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (filteredGoals.length === 0) {
    const isFiltered = selectedStatuses.length > 0 || showResubmissionsOnly;

    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold">目標一覧</h1>
            <EvaluationPeriodSelector
              periods={allPeriods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriod?.id || null}
              onPeriodChange={handlePeriodChange}
              isLoading={isLoading}
            />
          </div>

          {/* Filters */}
          <div className="bg-card border rounded-lg p-4">
            <GoalListFilters
              selectedStatuses={selectedStatuses}
              onStatusChange={setSelectedStatuses}
              showResubmissionsOnly={showResubmissionsOnly}
              onResubmissionsOnlyChange={setShowResubmissionsOnly}
              resubmissionCount={resubmissionCount}
            />
          </div>

          {/* Empty State */}
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {isFiltered
                ? '該当する目標がありません'
                : 'まだ目標が設定されていません'}
            </p>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedStatuses([]);
                  setShowResubmissionsOnly(false);
                }}
                className="mt-4"
              >
                フィルターをリセット
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main content with goals
  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">目標一覧</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredGoals.length}件の目標を表示中
            </p>
          </div>
          <div className="shrink-0">
            <EvaluationPeriodSelector
              periods={allPeriods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriod?.id || null}
              onPeriodChange={handlePeriodChange}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Employee Selector - only show if user has access to multiple employees' goals */}
        {groupedGoals.length > 1 && (
          <div className="bg-card border rounded-lg p-4">
            <EmployeeSelector
              groupedGoals={groupedGoals}
              selectedEmployeeId={selectedEmployeeId}
              onSelectEmployee={setSelectedEmployeeId}
            />
          </div>
        )}

        {/* Employee Info Card - show when employee is selected OR when there's only one employee */}
        {(selectedEmployee || (groupedGoals.length === 1 && groupedGoals[0])) && (
          <EmployeeInfoCard employee={selectedEmployee || groupedGoals[0].employee} />
        )}

        {/* Filters */}
        <div className="bg-card border rounded-lg p-4">
          <GoalListFilters
            selectedStatuses={selectedStatuses}
            onStatusChange={setSelectedStatuses}
            showResubmissionsOnly={showResubmissionsOnly}
            onResubmissionsOnlyChange={setShowResubmissionsOnly}
            resubmissionCount={resubmissionCount}
          />
        </div>

        {/* Goals List */}
        <div className="space-y-4">
          {filteredGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} currentUserId={currentUser?.id} />
          ))}
        </div>
      </div>
    </div>
  );
}
