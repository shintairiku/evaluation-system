'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { getSupervisorFeedbacksAction } from '@/api/server-actions/supervisor-feedbacks';
import { useOptionalCurrentUserContext } from '@/context/CurrentUserContext';

/**
 * Pending Evaluations Context Type
 * Provides counter for self-assessments pending supervisor review
 */
interface PendingEvaluationsContextType {
  /** Number of supervisor feedbacks with action=PENDING and no return_comment (awaiting review) */
  pendingEvaluationsCount: number;
  /** Set the pending evaluations count */
  setPendingEvaluationsCount: (count: number) => void;
  /** Reset counter to 0 */
  resetPendingEvaluationsCount: () => void;
  /** Refresh counter by fetching latest data from API */
  refreshPendingEvaluationsCount: () => Promise<void>;
}

const PendingEvaluationsContext = createContext<PendingEvaluationsContextType | undefined>(undefined);

export interface PendingEvaluationsProviderProps {
  children: ReactNode;
  initialPendingEvaluationsCount?: number;
}

/**
 * Pending Evaluations Provider
 *
 * Manages state for pending evaluation notifications, tracking supervisor feedbacks
 * with action=PENDING and no return_comment (self-assessments awaiting supervisor review).
 *
 * This follows the same pattern as DraftAssessmentsProvider.
 */
export function PendingEvaluationsProvider({ children, initialPendingEvaluationsCount }: PendingEvaluationsProviderProps) {
  const currentUserContext = useOptionalCurrentUserContext();
  const [pendingEvaluationsCount, setPendingEvaluationsCountState] = useState<number>(() => (
    typeof initialPendingEvaluationsCount === 'number' ? initialPendingEvaluationsCount : 0
  ));

  const setPendingEvaluationsCount = useCallback((count: number) => {
    if (count < 0) return; // Prevent negative values
    setPendingEvaluationsCountState(count);
  }, []);

  const resetPendingEvaluationsCount = useCallback(() => {
    setPendingEvaluationsCountState(0);
  }, []);

  /**
   * Refresh pending evaluations count
   *
   * Fetches supervisor feedbacks with action=PENDING and no return_comment
   * for the current user (as supervisor) and period
   */
  const refreshPendingEvaluationsCount = useCallback(async () => {
    try {
      const currentUserId = currentUserContext?.user?.id;
      const currentPeriodId = currentUserContext?.currentPeriod?.id;

      if (!currentUserId || !currentPeriodId) {
        setPendingEvaluationsCountState(0);
        return;
      }

      // Fetch only the count: one row + total, filtered to pending feedbacks without return_comment
      const feedbacksResult = await getSupervisorFeedbacksAction({
        periodId: currentPeriodId,
        supervisorId: currentUserId,
        action: 'PENDING',
        hasReturnComment: false,
        pagination: { limit: 1 }
      });

      if (feedbacksResult.success && feedbacksResult.data) {
        setPendingEvaluationsCountState(feedbacksResult.data.total);
      } else {
        // Failed to fetch, keep previous count
        console.warn('Failed to fetch pending evaluations count');
      }
    } catch (error) {
      console.error('Error refreshing pending evaluations count:', error);
      // Don't reset count on error, keep previous value
    }
  }, [currentUserContext?.currentPeriod?.id, currentUserContext?.user?.id]);

  // Keep state in sync when the server provides an initial value
  useEffect(() => {
    if (typeof initialPendingEvaluationsCount !== 'number') return;
    setPendingEvaluationsCountState(initialPendingEvaluationsCount);
  }, [initialPendingEvaluationsCount]);

  // Load pending count on provider initialization only when we don't already have a server-provided value
  useEffect(() => {
    if (typeof initialPendingEvaluationsCount === 'number') return;
    refreshPendingEvaluationsCount();
  }, [initialPendingEvaluationsCount, refreshPendingEvaluationsCount]);

  const value: PendingEvaluationsContextType = useMemo(() => ({
    pendingEvaluationsCount,
    setPendingEvaluationsCount,
    resetPendingEvaluationsCount,
    refreshPendingEvaluationsCount,
  }), [pendingEvaluationsCount, setPendingEvaluationsCount, resetPendingEvaluationsCount, refreshPendingEvaluationsCount]);

  return (
    <PendingEvaluationsContext.Provider value={value}>
      {children}
    </PendingEvaluationsContext.Provider>
  );
}

/**
 * Hook to access Pending Evaluations Context
 *
 * Must be used within a PendingEvaluationsProvider
 *
 * @returns Pending Evaluations context value
 * @throws Error if used outside of PendingEvaluationsProvider
 *
 * @example
 * ```tsx
 * const { pendingEvaluationsCount, refreshPendingEvaluationsCount } = usePendingEvaluationsContext();
 * ```
 */
export function usePendingEvaluationsContext(): PendingEvaluationsContextType {
  const context = useContext(PendingEvaluationsContext);
  if (context === undefined) {
    throw new Error('usePendingEvaluationsContext must be used within a PendingEvaluationsProvider');
  }
  return context;
}
