'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { getGoalsAction } from '@/api/server-actions/goals';

export interface GoalReviewState {
  pendingCount: number;
}

interface GoalReviewContextType {
  pendingCount: number;
  setPendingCount: (count: number) => void;
  resetPendingCount: () => void;
  refreshPendingCount: () => Promise<void>;
}

const GoalReviewContext = createContext<GoalReviewContextType | undefined>(undefined);

export interface GoalReviewProviderProps {
  children: ReactNode;
}

export function GoalReviewProvider({ children }: GoalReviewProviderProps) {
  const [pendingCount, setPendingCountState] = useState<number>(0);

  const setPendingCount = useCallback((count: number) => {
    if (count < 0) return; // Prevent negative values
    setPendingCountState(count);
  }, []);

  const resetPendingCount = useCallback(() => {
    setPendingCountState(0);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const result = await getGoalsAction({ status: 'submitted' });
      if (result.success && result.data?.items) {
        setPendingCountState(result.data.items.length);
      }
    } catch (error) {
      console.error('Error refreshing pending count:', error);
      // Don't reset count on error, keep previous value
    }
  }, []);

  // Load pending count on provider initialization
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  const value: GoalReviewContextType = useMemo(() => ({
    pendingCount,
    setPendingCount,
    resetPendingCount,
    refreshPendingCount,
  }), [pendingCount, setPendingCount, resetPendingCount, refreshPendingCount]);

  return (
    <GoalReviewContext.Provider value={value}>
      {children}
    </GoalReviewContext.Provider>
  );
}

export function useGoalReviewContext(): GoalReviewContextType {
  const context = useContext(GoalReviewContext);
  if (context === undefined) {
    throw new Error('useGoalReviewContext must be used within a GoalReviewProvider');
  }
  return context;
}

// Legacy export for backward compatibility during migration
export const useGoalReview = useGoalReviewContext;