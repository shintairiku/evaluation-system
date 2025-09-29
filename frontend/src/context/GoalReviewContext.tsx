'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

export interface GoalReviewState {
  pendingCount: number;
}

interface GoalReviewContextType {
  pendingCount: number;
  setPendingCount: (count: number) => void;
  resetPendingCount: () => void;
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

  const value: GoalReviewContextType = useMemo(() => ({
    pendingCount,
    setPendingCount,
    resetPendingCount,
  }), [pendingCount, setPendingCount, resetPendingCount]);

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