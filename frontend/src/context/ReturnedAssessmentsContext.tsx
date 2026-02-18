'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { getSupervisorFeedbacksAction } from '@/api/server-actions/supervisor-feedbacks';
import { useOptionalCurrentUserContext } from '@/context/CurrentUserContext';

/**
 * Returned Assessments Context Type
 * Provides counter for assessments returned by supervisor for correction (差し戻し)
 */
interface ReturnedAssessmentsContextType {
  /** Number of supervisor feedbacks with return_comment (returned for correction) */
  returnedCount: number;
  /** Set the returned count */
  setReturnedCount: (count: number) => void;
  /** Reset counter to 0 */
  resetReturnedCount: () => void;
  /** Refresh counter by fetching latest data from API */
  refreshReturnedCount: () => Promise<void>;
}

const ReturnedAssessmentsContext = createContext<ReturnedAssessmentsContextType | undefined>(undefined);

export interface ReturnedAssessmentsProviderProps {
  children: ReactNode;
  initialReturnedCount?: number;
}

/**
 * Returned Assessments Provider
 *
 * Manages state for returned assessment notifications, tracking supervisor feedbacks
 * that have return_comment (assessments returned for correction by supervisor).
 *
 * This follows the same pattern as GoalListProvider for rejected goals.
 */
export function ReturnedAssessmentsProvider({ children, initialReturnedCount }: ReturnedAssessmentsProviderProps) {
  const currentUserContext = useOptionalCurrentUserContext();
  const [returnedCount, setReturnedCountState] = useState<number>(() => (
    typeof initialReturnedCount === 'number' ? initialReturnedCount : 0
  ));

  const setReturnedCount = useCallback((count: number) => {
    if (count < 0) return; // Prevent negative values
    setReturnedCountState(count);
  }, []);

  const resetReturnedCount = useCallback(() => {
    setReturnedCountState(0);
  }, []);

  /**
   * Refresh returned count
   *
   * Fetches supervisor feedbacks with return_comment for the current user and period
   */
  const refreshReturnedCount = useCallback(async () => {
    try {
      const currentUserId = currentUserContext?.user?.id;
      const currentPeriodId = currentUserContext?.currentPeriod?.id;

      if (!currentUserId || !currentPeriodId) {
        setReturnedCountState(0);
        return;
      }

      // Fetch only the count: one row + total, filtered to feedbacks with return_comment
      const feedbacksResult = await getSupervisorFeedbacksAction({
        periodId: currentPeriodId,
        subordinateId: currentUserId,
        hasReturnComment: true,
        pagination: { limit: 1 }
      });

      if (feedbacksResult.success && feedbacksResult.data) {
        setReturnedCountState(feedbacksResult.data.total);
      } else {
        // Failed to fetch, keep previous count
        console.warn('Failed to fetch returned assessments count');
      }
    } catch (error) {
      console.error('Error refreshing returned assessments count:', error);
      // Don't reset count on error, keep previous value
    }
  }, [currentUserContext?.currentPeriod?.id, currentUserContext?.user?.id]);

  // Keep state in sync when the server provides an initial value
  useEffect(() => {
    if (typeof initialReturnedCount !== 'number') return;
    setReturnedCountState(initialReturnedCount);
  }, [initialReturnedCount]);

  // Load returned count on provider initialization only when we don't already have a server-provided value
  useEffect(() => {
    if (typeof initialReturnedCount === 'number') return;
    refreshReturnedCount();
  }, [initialReturnedCount, refreshReturnedCount]);

  const value: ReturnedAssessmentsContextType = useMemo(() => ({
    returnedCount,
    setReturnedCount,
    resetReturnedCount,
    refreshReturnedCount,
  }), [returnedCount, setReturnedCount, resetReturnedCount, refreshReturnedCount]);

  return (
    <ReturnedAssessmentsContext.Provider value={value}>
      {children}
    </ReturnedAssessmentsContext.Provider>
  );
}

/**
 * Hook to access Returned Assessments Context
 *
 * Must be used within a ReturnedAssessmentsProvider
 *
 * @returns Returned Assessments context value
 * @throws Error if used outside of ReturnedAssessmentsProvider
 *
 * @example
 * ```tsx
 * const { returnedCount, refreshReturnedCount } = useReturnedAssessmentsContext();
 * ```
 */
export function useReturnedAssessmentsContext(): ReturnedAssessmentsContextType {
  const context = useContext(ReturnedAssessmentsContext);
  if (context === undefined) {
    throw new Error('useReturnedAssessmentsContext must be used within a ReturnedAssessmentsProvider');
  }
  return context;
}
