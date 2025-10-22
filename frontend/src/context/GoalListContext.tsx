'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getGoalsAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { checkUserExistsAction } from '@/api/server-actions/users';

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
  const { userId: clerkUserId } = useAuth();
  const [rejectedGoalsCount, setRejectedGoalsCountState] = useState<number>(0);

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
   * Fetches goals in draft status with previousGoalId (rejected goals awaiting re-submission)
   * Only counts goals for the current evaluation period and current user
   */
  const refreshRejectedGoalsCount = useCallback(async () => {
    try {
      // Check if user is authenticated
      if (!clerkUserId) {
        setRejectedGoalsCountState(0);
        return;
      }

      // Get internal user ID from Clerk ID
      const userExistsResult = await checkUserExistsAction(clerkUserId);
      if (!userExistsResult.success || !userExistsResult.data?.exists || !userExistsResult.data.user_id) {
        // User not found, reset counter
        setRejectedGoalsCountState(0);
        return;
      }

      const internalUserId = userExistsResult.data.user_id;

      // Get current evaluation period
      const periodResult = await getCategorizedEvaluationPeriodsAction();
      if (!periodResult.success || !periodResult.data?.current) {
        // No current period, reset counter
        setRejectedGoalsCountState(0);
        return;
      }

      const currentPeriodId = periodResult.data.current.id;

      // Fetch goals for current period and current user only
      const goalsResult = await getGoalsAction({
        periodId: currentPeriodId,
        userId: internalUserId, // Filter by current user's goals only
        limit: 100 // Reasonable limit for notification purposes
      });

      if (goalsResult.success && goalsResult.data?.items) {
        // Count goals that are:
        // 1. In draft status (editable)
        // 2. Have previousGoalId (were rejected and copied for re-submission)
        const rejectedDrafts = goalsResult.data.items.filter(
          goal => goal.status === 'draft' && goal.previousGoalId
        );

        setRejectedGoalsCountState(rejectedDrafts.length);
      } else {
        // Failed to fetch goals, keep previous count
        console.warn('Failed to fetch goals for rejected count');
      }
    } catch (error) {
      console.error('Error refreshing rejected goals count:', error);
      // Don't reset count on error, keep previous value
    }
  }, [clerkUserId]);

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
