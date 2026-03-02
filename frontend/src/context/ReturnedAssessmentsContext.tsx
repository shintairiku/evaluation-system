'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { getSelfAssessmentsAction } from '@/api/server-actions/self-assessments';
import { getMyEvaluationAction } from '@/api/server-actions/core-values';
import { useOptionalCurrentUserContext } from '@/context/CurrentUserContext';

/**
 * Draft Assessments Context Type
 * Provides counter for self-assessments in draft status (needs to be filled/submitted)
 * This includes both new drafts (after goal approval) and returned drafts (差し戻し)
 */
interface DraftAssessmentsContextType {
  /** Number of self-assessments with status=draft for current user */
  draftCount: number;
  /** Set the draft count */
  setDraftCount: (count: number) => void;
  /** Reset counter to 0 */
  resetDraftCount: () => void;
  /** Refresh counter by fetching latest data from API */
  refreshDraftCount: () => Promise<void>;
}

const DraftAssessmentsContext = createContext<DraftAssessmentsContextType | undefined>(undefined);

export interface DraftAssessmentsProviderProps {
  children: ReactNode;
  initialDraftCount?: number;
}

/**
 * Draft Assessments Provider
 *
 * Manages state for draft assessment notifications, tracking self-assessments
 * with status=draft for the current user in the active period.
 * This covers both new assessments (created after goal approval) and
 * returned assessments (差し戻し reverted to draft by supervisor).
 *
 * This follows the same pattern as GoalListProvider for rejected goals.
 */
export function DraftAssessmentsProvider({ children, initialDraftCount }: DraftAssessmentsProviderProps) {
  const currentUserContext = useOptionalCurrentUserContext();
  const [draftCount, setDraftCountState] = useState<number>(() => (
    typeof initialDraftCount === 'number' ? initialDraftCount : 0
  ));

  const setDraftCount = useCallback((count: number) => {
    if (count < 0) return; // Prevent negative values
    setDraftCountState(count);
  }, []);

  const resetDraftCount = useCallback(() => {
    setDraftCountState(0);
  }, []);

  /**
   * Refresh draft count
   *
   * Fetches self-assessments with status=draft for the current user and period
   */
  const refreshDraftCount = useCallback(async () => {
    try {
      const currentUserId = currentUserContext?.user?.id;
      const currentPeriodId = currentUserContext?.currentPeriod?.id;

      if (!currentUserId || !currentPeriodId) {
        setDraftCountState(0);
        return;
      }

      // Fetch self-assessment draft count + core value evaluation in parallel
      const [assessmentsResult, coreValueResult] = await Promise.all([
        getSelfAssessmentsAction({
          periodId: currentPeriodId,
          status: 'draft',
          selfOnly: true,
          pagination: { limit: 1 }
        }),
        getMyEvaluationAction(currentPeriodId),
      ]);

      const selfAssessmentTotal = assessmentsResult.success && assessmentsResult.data
        ? assessmentsResult.data.total
        : 0;

      const coreValueIsDraft = coreValueResult.success && coreValueResult.data
        && coreValueResult.data.status === 'draft'
        ? 1
        : 0;

      setDraftCountState(selfAssessmentTotal + coreValueIsDraft);
    } catch (error) {
      console.error('Error refreshing draft assessments count:', error);
      // Don't reset count on error, keep previous value
    }
  }, [currentUserContext?.currentPeriod?.id, currentUserContext?.user?.id]);

  // Keep state in sync when the server provides an initial value
  useEffect(() => {
    if (typeof initialDraftCount !== 'number') return;
    setDraftCountState(initialDraftCount);
  }, [initialDraftCount]);

  // Load draft count on provider initialization only when we don't already have a server-provided value
  useEffect(() => {
    if (typeof initialDraftCount === 'number') return;
    refreshDraftCount();
  }, [initialDraftCount, refreshDraftCount]);

  const value: DraftAssessmentsContextType = useMemo(() => ({
    draftCount,
    setDraftCount,
    resetDraftCount,
    refreshDraftCount,
  }), [draftCount, setDraftCount, resetDraftCount, refreshDraftCount]);

  return (
    <DraftAssessmentsContext.Provider value={value}>
      {children}
    </DraftAssessmentsContext.Provider>
  );
}

/**
 * Hook to access Draft Assessments Context
 *
 * Must be used within a DraftAssessmentsProvider
 *
 * @returns Draft Assessments context value
 * @throws Error if used outside of DraftAssessmentsProvider
 *
 * @example
 * ```tsx
 * const { draftCount, refreshDraftCount } = useDraftAssessmentsContext();
 * ```
 */
export function useDraftAssessmentsContext(): DraftAssessmentsContextType {
  const context = useContext(DraftAssessmentsContext);
  if (context === undefined) {
    throw new Error('useDraftAssessmentsContext must be used within a DraftAssessmentsProvider');
  }
  return context;
}
