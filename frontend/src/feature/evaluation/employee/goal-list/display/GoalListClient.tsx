'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { useGoalListContext } from '@/context/GoalListContext';
import { GoalCard } from '../components/GoalCard';
import { GoalListFilters } from '../components/GoalListFilters';
import type { EmployeeGoalListPageData } from '@/api/types/page-loaders';
import type { GoalStatus } from '@/api/types';

interface GoalListClientProps {
  pageData: EmployeeGoalListPageData;
}

export default function GoalListClient({ pageData }: GoalListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Light-weight "near realtime" refresh so employees see updates (e.g., approvals/rejections) quickly.
  // True realtime would require a push channel (SSE/WebSocket/Supabase Realtime).
  const AUTO_REFRESH_INTERVAL_MS = 15_000;

  const currentUser = pageData.currentUserContext.user;
  const periods = pageData.periods?.all ?? [];
  const selectedPeriodId = pageData.selectedPeriod?.id ?? '';
  const currentPeriodId = pageData.currentUserContext.currentPeriod?.id ?? null;

  const [selectedStatuses, setSelectedStatuses] = useState<GoalStatus[]>([]);
  const [showResubmissionsOnly, setShowResubmissionsOnly] = useState(false);

  const resubmissionCount = pageData.rejectedGoalsCount;

  const filteredGoals = useMemo(() => {
    let result = pageData.goals;

    if (selectedStatuses.length > 0) {
      result = result.filter(goal => selectedStatuses.includes(goal.status));
    }

    if (showResubmissionsOnly) {
      result = result.filter(goal => goal.status === 'draft' && Boolean(goal.previousGoalId));
    }

    return result;
  }, [pageData.goals, selectedStatuses, showResubmissionsOnly]);

  const { rejectedGoalsCount, setRejectedGoalsCount } = useGoalListContext();

  React.useEffect(() => {
    if (rejectedGoalsCount === pageData.rejectedGoalsCount) return;
    setRejectedGoalsCount(pageData.rejectedGoalsCount);
  }, [pageData.rejectedGoalsCount, rejectedGoalsCount, setRejectedGoalsCount]);

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

  if (!pageData.selectedPeriod) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>エラーが発生しました</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>評価期間が設定されていません</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
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

  if (filteredGoals.length === 0) {
    const isFiltered = selectedStatuses.length > 0 || showResubmissionsOnly;

    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold">目標一覧</h1>
            <EvaluationPeriodSelector
              periods={periods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriodId}
              onPeriodChange={handlePeriodChange}
              isLoading={false}
            />
          </div>

          {currentUser && <EmployeeInfoCard employee={currentUser} />}

          <div className="bg-card border rounded-lg p-4">
            <GoalListFilters
              selectedStatuses={selectedStatuses}
              onStatusChange={setSelectedStatuses}
              showResubmissionsOnly={showResubmissionsOnly}
              onResubmissionsOnlyChange={setShowResubmissionsOnly}
              resubmissionCount={resubmissionCount}
            />
          </div>

          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {isFiltered ? '該当する目標がありません' : 'まだ目標が設定されていません'}
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

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">目標一覧</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredGoals.length}件の目標を表示中
            </p>
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

        {currentUser && <EmployeeInfoCard employee={currentUser} />}

        <div className="bg-card border rounded-lg p-4">
          <GoalListFilters
            selectedStatuses={selectedStatuses}
            onStatusChange={setSelectedStatuses}
            showResubmissionsOnly={showResubmissionsOnly}
            onResubmissionsOnlyChange={setShowResubmissionsOnly}
            resubmissionCount={resubmissionCount}
          />
        </div>

        <div className="space-y-4">
          {filteredGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} currentUserId={currentUser?.id} />
          ))}
        </div>
      </div>
    </div>
  );
}
