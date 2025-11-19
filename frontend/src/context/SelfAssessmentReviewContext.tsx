'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { getPendingSelfAssessmentReviewsAction } from '@/api/server-actions/self-assessment-reviews';

interface SelfAssessmentReviewContextType {
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
  setPendingCount: (count: number) => void;
}

const SelfAssessmentReviewContext = createContext<SelfAssessmentReviewContextType | undefined>(undefined);

export function SelfAssessmentReviewProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCountState] = useState<number>(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const result = await getPendingSelfAssessmentReviewsAction({ pagination: { limit: 100 } });
      if (result.success && result.data?.items) {
        setPendingCountState(result.data.items.length);
      }
    } catch (error) {
      console.error('Error refreshing self-assessment pending count:', error);
    }
  }, []);

  const setPendingCount = useCallback((count: number) => {
    if (count < 0) return;
    setPendingCountState(count);
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  const value = useMemo(() => ({
    pendingCount,
    refreshPendingCount,
    setPendingCount,
  }), [pendingCount, refreshPendingCount, setPendingCount]);

  return (
    <SelfAssessmentReviewContext.Provider value={value}>
      {children}
    </SelfAssessmentReviewContext.Provider>
  );
}

export function useSelfAssessmentReviewContext(): SelfAssessmentReviewContextType {
  const ctx = useContext(SelfAssessmentReviewContext);
  if (!ctx) {
    throw new Error('useSelfAssessmentReviewContext must be used within SelfAssessmentReviewProvider');
  }
  return ctx;
}
