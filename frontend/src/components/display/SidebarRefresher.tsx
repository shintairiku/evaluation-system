'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AUTO_REFRESH_INTERVAL_MS = 30_000;

/**
 * SidebarRefresher
 *
 * Invisible client component that keeps sidebar counters up-to-date by calling
 * router.refresh() every 30 seconds. This re-executes the layout server-side,
 * re-fetching all 4 counter values and passing fresh initialXxxCount props to
 * the context providers.
 *
 * Smart refresh: skips when the tab is not visible or the user is actively typing,
 * and triggers an immediate refresh when the user returns to the tab.
 *
 * This mirrors the 15s polling in GoalReviewClient/GoalListClient but runs
 * globally across all pages at a lower frequency (30s).
 */
export default function SidebarRefresher() {
  const router = useRouter();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const isSafeToRefresh = () => {
      if (document.visibilityState !== 'visible') return false;
      const el = document.activeElement;
      if (!el) return true;
      const tag = el.tagName;
      return tag !== 'TEXTAREA' && tag !== 'INPUT' && !(el as HTMLElement).isContentEditable;
    };

    const tick = () => { if (isSafeToRefresh()) router.refresh(); };
    const intervalId = window.setInterval(tick, AUTO_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  return null;
}
