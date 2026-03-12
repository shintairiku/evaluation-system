'use client';

import { useEffect } from 'react';
import { useGoalReviewContext } from '@/context/GoalReviewContext';
import { useGoalListContext } from '@/context/GoalListContext';
import { useDraftAssessmentsContext } from '@/context/ReturnedAssessmentsContext';
import { usePendingEvaluationsContext } from '@/context/PendingEvaluationsContext';

const AUTO_REFRESH_INTERVAL_MS = 30_000;

/**
 * SidebarRefresher
 *
 * Invisible client component that keeps sidebar counters up-to-date by
 * periodically calling the refresh methods of all 4 counter contexts.
 * Each refresh performs a lightweight COUNT query (limit:1) via server actions.
 *
 * Unlike router.refresh(), this approach does NOT re-execute server components,
 * so modals, forms, and other UI state remain unaffected.
 *
 * Smart refresh: skips when the tab is not visible or the user is actively typing,
 * and triggers an immediate refresh when the user returns to the tab.
 */
export default function SidebarRefresher() {
  const { refreshPendingCount } = useGoalReviewContext();
  const { refreshRejectedGoalsCount } = useGoalListContext();
  const { refreshDraftCount } = useDraftAssessmentsContext();
  const { refreshPendingEvaluationsCount } = usePendingEvaluationsContext();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const refreshAll = () => {
      refreshPendingCount();
      refreshRejectedGoalsCount();
      refreshDraftCount();
      refreshPendingEvaluationsCount();
    };

    const isSafeToRefresh = () => {
      if (document.visibilityState !== 'visible') return false;
      const el = document.activeElement;
      if (!el) return true;
      const tag = el.tagName;
      return tag !== 'TEXTAREA' && tag !== 'INPUT' && !(el as HTMLElement).isContentEditable;
    };

    const tick = () => { if (isSafeToRefresh()) refreshAll(); };
    const intervalId = window.setInterval(tick, AUTO_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshPendingCount, refreshRejectedGoalsCount, refreshDraftCount, refreshPendingEvaluationsCount]);

  return null;
}
