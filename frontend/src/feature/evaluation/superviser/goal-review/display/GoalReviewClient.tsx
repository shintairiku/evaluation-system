'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { getGoalsAction } from '@/api/server-actions/goals';
import { EmployeeTabNavigation } from '../components/EmployeeTabNavigation';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { GoalApprovalCard } from '../components/GoalApprovalCard';
import { GuidelinesAlert } from '../components/GuidelinesAlert';
import { ApprovalGuidelinesPanel } from '../components/ApprovalGuidelinesPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useResponsiveBreakpoint } from '@/hooks/useResponsiveBreakpoint';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { createSkipLink, generateAccessibilityId } from '@/utils/accessibility';
import type { SupervisorGoalReviewPageData } from '@/api/types/page-loaders';
import type { GoalResponse } from '@/api/types';

interface GoalReviewClientProps {
  pageData: SupervisorGoalReviewPageData;
}

type ApprovedGoalsState = {
  items: GoalResponse[];
  isLoading: boolean;
  error: string | null;
};

export default function GoalReviewClient({ pageData }: GoalReviewClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Light-weight "near realtime" refresh so supervisors see subordinates' withdraw/delete quickly.
  // True realtime would require a push channel (SSE/WebSocket/Supabase Realtime).
  const AUTO_REFRESH_INTERVAL_MS = 15_000;

  const periods = pageData.periods?.all ?? [];
  const selectedPeriodId = pageData.selectedPeriod?.id ?? '';
  const currentPeriodId = pageData.currentUserContext.currentPeriod?.id ?? null;

  const groupedGoals = pageData.grouped;
  const totalPendingCount = pageData.totalPendingCount;

  const [approvedGoalsByEmployeeId, setApprovedGoalsByEmployeeId] = React.useState<Record<string, ApprovedGoalsState>>({});
  const [approvedGoalsVersion, setApprovedGoalsVersion] = React.useState(0);

  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>(() => (
    groupedGoals[0]?.employee.id ?? ''
  ));

  React.useEffect(() => {
    if (groupedGoals.length === 0) {
      if (selectedEmployeeId !== '') setSelectedEmployeeId('');
      return;
    }

    const stillExists = groupedGoals.some(g => g.employee.id === selectedEmployeeId);
    if (!stillExists) {
      setSelectedEmployeeId(groupedGoals[0].employee.id);
    }
  }, [groupedGoals, selectedEmployeeId]);

  const { isMobile, isTablet, isDesktop } = useResponsiveBreakpoint();
  const { containerRef } = useKeyboardNavigation({
    enableArrowKeys: false,
    enableTabNavigation: true,
    enableEscapeKey: false
  });

  const mainContentId = React.useMemo(() => generateAccessibilityId('main-content'), []);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const skipLink = createSkipLink(mainContentId, 'メインコンテンツへスキップ');
    document.body.insertBefore(skipLink, document.body.firstChild);

    return () => {
      if (document.body.contains(skipLink)) {
        document.body.removeChild(skipLink);
      }
    };
  }, [mainContentId]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const isSafeToRefresh = () => {
      if (document.visibilityState !== 'visible') return false;

      const activeElement = document.activeElement as HTMLElement | null;
      if (!activeElement) return true;

      const tagName = activeElement.tagName;
      if (tagName === 'TEXTAREA' || tagName === 'INPUT' || activeElement.isContentEditable) {
        return false;
      }

      return true;
    };

    const tick = () => {
      if (isSafeToRefresh()) {
        router.refresh();
      }
    };

    const intervalId = window.setInterval(tick, AUTO_REFRESH_INTERVAL_MS);

    // When the tab becomes visible again, refresh once immediately.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  React.useEffect(() => {
    setApprovedGoalsByEmployeeId({});
  }, [selectedPeriodId]);

  React.useEffect(() => {
    if (!selectedPeriodId || !selectedEmployeeId) return;

    let cancelled = false;

    setApprovedGoalsByEmployeeId(prev => ({
      ...prev,
      [selectedEmployeeId]: {
        items: prev[selectedEmployeeId]?.items ?? [],
        isLoading: true,
        error: null,
      },
    }));

    getGoalsAction({
      periodId: selectedPeriodId,
      userId: selectedEmployeeId,
      status: ['approved'],
      includeReviews: true,
      limit: 100,
    }).then((result) => {
      if (cancelled) return;

      if (!result.success || !result.data?.items) {
        setApprovedGoalsByEmployeeId(prev => ({
          ...prev,
          [selectedEmployeeId]: {
            items: [],
            isLoading: false,
            error: result.error || '承認済み目標の読み込みに失敗しました',
          },
        }));
        return;
      }

      setApprovedGoalsByEmployeeId(prev => ({
        ...prev,
        [selectedEmployeeId]: {
          items: result.data?.items ?? [],
          isLoading: false,
          error: null,
        },
      }));
    }).catch((error) => {
      if (cancelled) return;

      if (process.env.NODE_ENV !== 'production') console.error('Failed to load approved goals:', error);
      setApprovedGoalsByEmployeeId(prev => ({
        ...prev,
        [selectedEmployeeId]: {
          items: [],
          isLoading: false,
          error: '承認済み目標の読み込み中に予期しないエラーが発生しました',
        },
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [approvedGoalsVersion, selectedEmployeeId, selectedPeriodId]);

  const handlePeriodChange = (periodId: string) => {
    const next = new URLSearchParams(searchParams.toString());

    if (currentPeriodId && periodId === currentPeriodId) {
      next.delete('periodId');
    } else {
      next.set('periodId', periodId);
    }

    const qs = next.toString();
    router.push(qs.length > 0 ? `${pathname}?${qs}` : pathname);
  };

  const handleGoalUpdate = React.useCallback(() => {
    setApprovedGoalsVersion(prev => prev + 1);
    router.refresh();
  }, [router]);

  if (!pageData.selectedPeriod) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="text-center space-y-4 py-12">
          <h1 className="text-xl sm:text-2xl font-bold text-red-600">エラーが発生しました</h1>
          <p className="text-muted-foreground text-sm sm:text-base">評価期間が設定されていません</p>
          <button
            onClick={() => router.refresh()}
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">目標承認</h1>
              <Badge variant="secondary" className="text-sm">
                {totalPendingCount}
              </Badge>
            </div>
            <EvaluationPeriodSelector
              periods={periods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriodId}
              onPeriodChange={handlePeriodChange}
              isLoading={false}
            />
          </div>

          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">承認待ちの目標はありません</h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              現在、承認が必要な目標はありません。
            </p>
            <button
              onClick={() => router.refresh()}
              className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 underline"
            >
              データを再読み込み
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedGroup = groupedGoals.find(group => group.employee.id === selectedEmployeeId) ?? null;
  const approvedGoalsState = selectedEmployeeId ? approvedGoalsByEmployeeId[selectedEmployeeId] : undefined;
  const approvedGoals = approvedGoalsState?.items ?? [];
  const isLoadingApprovedGoals = approvedGoalsState?.isLoading ?? false;
  const approvedGoalsError = approvedGoalsState?.error ?? null;

  return (
    <ErrorBoundary>
      <div
        ref={containerRef as React.Ref<HTMLDivElement>}
        className={`container mx-auto ${isMobile ? 'p-3' : isTablet ? 'p-4' : 'p-4 md:p-6'}`}
        role="main"
        aria-label="目標承認ページ"
        id={mainContentId}
      >
        <div className={`space-y-4 ${isDesktop ? 'md:space-y-6' : isMobile ? 'space-y-3' : 'space-y-4'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">目標承認</h1>
              <Badge variant="secondary" className="text-sm">
                {totalPendingCount}
              </Badge>
            </div>
            <div className="shrink-0">
              <EvaluationPeriodSelector
                periods={periods}
                selectedPeriodId={selectedPeriodId}
                currentPeriodId={currentPeriodId}
                onPeriodChange={handlePeriodChange}
                isLoading={false}
              />
            </div>
          </div>

          <GuidelinesAlert />
          <ApprovalGuidelinesPanel />

          <Tabs value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <EmployeeTabNavigation groupedGoals={groupedGoals} />

            {selectedGroup && (
              <TabsContent value={selectedEmployeeId} className="mt-4 md:mt-6">
                <div className="space-y-4 md:space-y-6">
                  <EmployeeInfoCard employee={selectedGroup.employee} />

                  <div className="space-y-4">
                    {selectedGroup.goals.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        承認待ちの目標はありません
                      </div>
                    )}

                    {selectedGroup.goals.map((goal) => (
                      <GoalApprovalCard
                        key={goal.id}
                        goal={goal}
                        employeeName={selectedGroup.employee.name}
                        onGoalUpdate={handleGoalUpdate}
                        review={selectedGroup.reviewsByGoalId[goal.id]}
                      />
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">承認済みの目標</h2>
                      <Badge variant="secondary" className="text-sm">
                        {approvedGoals.length}
                      </Badge>
                    </div>

                    {isLoadingApprovedGoals && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        読み込み中...
                      </div>
                    )}

                    {!isLoadingApprovedGoals && approvedGoalsError && (
                      <div className="text-center py-8 text-sm text-red-600">
                        {approvedGoalsError}
                      </div>
                    )}

                    {!isLoadingApprovedGoals && !approvedGoalsError && approvedGoals.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        承認済みの目標はありません
                      </div>
                    )}

                    {!isLoadingApprovedGoals && !approvedGoalsError && approvedGoals.map((goal) => (
                      <GoalApprovalCard
                        key={goal.id}
                        goal={goal}
                        employeeName={selectedGroup.employee.name}
                        onGoalUpdate={handleGoalUpdate}
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
