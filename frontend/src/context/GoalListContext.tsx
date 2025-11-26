'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { getRejectedDraftsAction } from '@/api/server-actions/goals';

/**
 * Goal List Context State
 * Tracks rejected goals (draft status with previousGoalId) awaiting employee action
 */
export interface GoalListState {
  rejectedGoalsCount: number;
}

/**
 * Goal List Context Type
 * Provides counter for rejected goals awaiting re-submission
 */
interface GoalListContextType {
  /** Number of goals in draft status that were previously rejected (have previousGoalId) */
  rejectedGoalsCount: number;
  /** Set the rejected goals count */
  setRejectedGoalsCount: (count: number) => void;
  /** Reset counter to 0 */
  resetRejectedGoalsCount: () => void;
  /** Refresh counter by fetching latest data from API */
  refreshRejectedGoalsCount: () => Promise<void>;
}

const GoalListContext = createContext<GoalListContextType | undefined>(undefined);

export interface GoalListProviderProps {
  children: ReactNode;
}

/**
 * Goal List Provider
 *
 * Manages state for goal list notifications, specifically tracking rejected goals
 * that need employee attention (goals in draft status with previousGoalId).
 *
 * This follows the same pattern as GoalReviewProvider for supervisor pending approvals.
 *
 * @param props - Provider props
 */
export function GoalListProvider({ children }: GoalListProviderProps) {
  const [rejectedGoalsCount, setRejectedGoalsCountState] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const setRejectedGoalsCount = useCallback((count: number) => {
    if (count < 0) return; // Prevent negative values
    setRejectedGoalsCountState(count);
  }, []);

  const resetRejectedGoalsCount = useCallback(() => {
    setRejectedGoalsCountState(0);
  }, []);

  /**
   * Refresh rejected goals count
   *
   * Fetches rejected draft goals using the dedicated backend endpoint.
   * Backend automatically filters by current user and applies all necessary checks.
   */
  const refreshRejectedGoalsCount = useCallback(async () => {
    try {
      // Call dedicated endpoint - backend handles authentication and filtering
      const result = await getRejectedDraftsAction({
        limit: 100 // Reasonable limit for notification purposes
      });

      if (result.success && result.data?.items) {
        setRejectedGoalsCountState(result.data.items.length);
        setIsInitialized(true);
      } else {
        // Failed to fetch, keep previous count
        console.warn('Failed to fetch rejected drafts for count');
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error refreshing rejected goals count:', error);
      setIsInitialized(true);
      // Don't reset count on error, keep previous value
    }
  }, []); // No dependencies - backend handles everything

  // Load rejected goals count on provider initialization
  useEffect(() => {
    refreshRejectedGoalsCount();
  }, [refreshRejectedGoalsCount]);

  const value: GoalListContextType = useMemo(() => ({
    rejectedGoalsCount,
    setRejectedGoalsCount,
    resetRejectedGoalsCount,
    refreshRejectedGoalsCount,
  }), [rejectedGoalsCount, setRejectedGoalsCount, resetRejectedGoalsCount, refreshRejectedGoalsCount]);

  return (
    <GoalListContext.Provider value={value}>
      {children}
    </GoalListContext.Provider>
  );
}

/**
 * Hook to access Goal List Context
 *
 * Must be used within a GoalListProvider
 *
 * @returns Goal List context value
 * @throws Error if used outside of GoalListProvider
 *
 * @example
 * ```tsx
 * const { rejectedGoalsCount, refreshRejectedGoalsCount } = useGoalListContext();
 * ```
 */
export function useGoalListContext(): GoalListContextType {
  const context = useContext(GoalListContext);
  if (context === undefined) {
    throw new Error('useGoalListContext must be used within a GoalListProvider');
  }
  return context;
}
