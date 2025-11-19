'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { GoalApprovalCardSkeleton, DelayedSkeleton } from '@/components/ui/loading-skeleton';
import { EmployeeTabNavigation } from '../components/EmployeeTabNavigation';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { GoalApprovalCard } from '../components/GoalApprovalCard';
import { GuidelinesAlert } from '../components/GuidelinesAlert';
import { ApprovalGuidelinesPanel } from '../components/ApprovalGuidelinesPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useGoalReviewData } from '../hooks/useGoalReviewData';
import { useResponsiveBreakpoint } from '@/hooks/useResponsiveBreakpoint';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { createSkipLink, generateAccessibilityId } from '@/utils/accessibility';
import type { EvaluationPeriod } from '@/api/types';

/**
 * Main goal review page for supervisors to approve/reject employee goals
 * Displays submitted goals organized by employee with approval functionality
 *
 * @returns JSX element containing the complete goal review interface
 */
export default function GoalReviewPage() {
  // State for selected period
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const {
    loading,
    error,
    groupedGoals,
    totalPendingCount,
    selectedEmployeeId,
    currentPeriod,
    allPeriods,
    setSelectedEmployeeId,
    reloadData
  } = useGoalReviewData({ selectedPeriodId: selectedPeriodId || undefined });

  // Responsive and accessibility hooks
  const { isMobile, isTablet, isDesktop } = useResponsiveBreakpoint();
  const { containerRef } = useKeyboardNavigation({
    enableArrowKeys: false,
    enableTabNavigation: true,
    enableEscapeKey: false
  });

  // Generate unique IDs for accessibility
  const mainContentId = React.useMemo(() => generateAccessibilityId('main-content'), []);

  // Create skip link when component mounts
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const skipLink = createSkipLink(mainContentId, 'メインコンテンツへスキップ');
      document.body.insertBefore(skipLink, document.body.firstChild);

      return () => {
        if (document.body.contains(skipLink)) {
          document.body.removeChild(skipLink);
        }
      };
    }
  }, [mainContentId]);

  // Initialize selected period to current period when data loads
  React.useEffect(() => {
    if (!selectedPeriodId && currentPeriod) {
      setSelectedPeriodId(currentPeriod.id);
    }
  }, [currentPeriod, selectedPeriodId]);

  // Handle period change
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
  };


  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Page Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-9 w-80 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* Guidelines Skeleton */}
          <div className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
          <div className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>

          {/* Employee Tabs Skeleton */}
          <div className="flex space-x-2">
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-28 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* Employee Info Skeleton */}
          <div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>

          {/* Goal Cards Skeleton */}
          <DelayedSkeleton delay={300}>
            <GoalApprovalCardSkeleton count={3} />
          </DelayedSkeleton>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="text-center space-y-4 py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl sm:text-2xl font-bold text-red-600">エラーが発生しました</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{error}</p>
          <button
            onClick={reloadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (groupedGoals.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">目標承認</h1>
              <Badge variant="secondary" className="text-sm">
                {totalPendingCount}
              </Badge>
            </div>
            <EvaluationPeriodSelector
              periods={allPeriods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriod?.id || null}
              onPeriodChange={handlePeriodChange}
              isLoading={loading}
            />
          </div>

          {/* Empty State */}
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">承認待ちの目標はありません</h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              現在、承認が必要な目標はありません。
            </p>
            <button
              onClick={reloadData}
              className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 underline"
            >
              データを再読み込み
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedGroup = groupedGoals.find(group => group.employee.id === selectedEmployeeId);

  return (
    <ErrorBoundary>
      <div ref={containerRef as React.Ref<HTMLDivElement>}
           className={`container mx-auto ${isMobile ? 'p-3' : isTablet ? 'p-4' : 'p-4 md:p-6'}`}
           role="main"
           aria-label="目標承認ページ"
           id={mainContentId}>
        <div className={`space-y-4 ${isDesktop ? 'md:space-y-6' : isMobile ? 'space-y-3' : 'space-y-4'}`}>
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">目標承認</h1>
              <Badge variant="secondary" className="text-sm">
                {totalPendingCount}
              </Badge>
            </div>
            <div className="shrink-0">
              <EvaluationPeriodSelector
                periods={allPeriods}
                selectedPeriodId={selectedPeriodId}
                currentPeriodId={currentPeriod?.id || null}
                onPeriodChange={handlePeriodChange}
                isLoading={loading}
              />
            </div>
          </div>

          {/* Guidelines */}
          <GuidelinesAlert />
          <ApprovalGuidelinesPanel />

          {/* Employee Navigation Tabs */}
          <Tabs value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <EmployeeTabNavigation
              groupedGoals={groupedGoals}
            />

            {/* Selected Employee Content */}
            {selectedGroup && (
              <TabsContent value={selectedEmployeeId} className="mt-4 md:mt-6">
                <div className="space-y-4 md:space-y-6">
                  {/* Employee Info Header */}
                  <EmployeeInfoCard employee={selectedGroup.employee} />

                  {/* Goals List */}
                  <div className="space-y-4">
                    {selectedGroup.goals.map((goal) => (
                      <GoalApprovalCard
                        key={goal.id}
                        goal={goal}
                        employeeName={selectedGroup.employee.name}
                        onGoalUpdate={reloadData}
                        reviewId={selectedGroup.goalToReviewMap.get(goal.id)}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
}
