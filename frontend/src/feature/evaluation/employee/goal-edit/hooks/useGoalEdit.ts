'use client';

import { useState, useEffect, useCallback } from 'react';
import { getGoalByIdAction, updateGoalAction, submitGoalAction } from '@/api/server-actions/goals';
import { getSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import type { GoalResponse, SupervisorReview, UUID } from '@/api/types';

export interface UseGoalEditReturn {
  /** The goal being edited */
  goal: GoalResponse | null;
  /** Supervisor review with comment (if rejected) */
  supervisorReview: SupervisorReview | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Save goal as draft */
  saveDraft: (goalData: Partial<GoalResponse>) => Promise<boolean>;
  /** Submit goal for review */
  submitGoal: (goalData: Partial<GoalResponse>) => Promise<boolean>;
  /** Saving state */
  isSaving: boolean;
}

/**
 * Hook to manage goal editing workflow
 *
 * Features:
 * - Loads goal by ID
 * - Loads supervisor review if goal is rejected
 * - Handles save (keep as draft) and submit (for review)
 *
 * @param goalId - UUID of the goal to edit
 */
export function useGoalEdit(goalId: UUID): UseGoalEditReturn {
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  const [supervisorReview, setSupervisorReview] = useState<SupervisorReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load goal and supervisor review
  useEffect(() => {
    const loadGoalData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Load goal
        const goalResult = await getGoalByIdAction(goalId);
        if (!goalResult.success || !goalResult.data) {
          setError(goalResult.error || '目標の読み込みに失敗しました');
          setIsLoading(false);
          return;
        }

        setGoal(goalResult.data);

        // If goal is rejected or approved, load supervisor review
        if (goalResult.data.status === 'rejected' || goalResult.data.status === 'approved') {
          const reviewResult = await getSupervisorReviewsAction({
            goalId: goalId,
            pagination: { limit: 10 }
          });

          if (reviewResult.success && reviewResult.data?.items && reviewResult.data.items.length > 0) {
            // Get the most recent review
            const reviews = reviewResult.data.items;
            const mostRecentReview = reviews.reduce((latest, current) => {
              const latestDate = latest.reviewed_at || latest.updated_at || latest.created_at;
              const currentDate = current.reviewed_at || current.updated_at || current.created_at;
              return new Date(currentDate) > new Date(latestDate) ? current : latest;
            });

            setSupervisorReview(mostRecentReview);
          }
        }
      } catch (err) {
        console.error('Error loading goal data:', err);
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    if (goalId) {
      loadGoalData();
    }
  }, [goalId]);

  // Save goal as draft
  const saveDraft = useCallback(async (goalData: Partial<GoalResponse>): Promise<boolean> => {
    if (!goal) return false;

    setIsSaving(true);
    setError(null);

    try {
      const result = await updateGoalAction(goal.id, goalData);

      if (result.success && result.data) {
        setGoal(result.data);
        return true;
      } else {
        setError(result.error || '保存に失敗しました');
        return false;
      }
    } catch (err) {
      console.error('Error saving goal:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [goal]);

  // Submit goal for review
  const submitGoal = useCallback(async (goalData: Partial<GoalResponse>): Promise<boolean> => {
    if (!goal) return false;

    setIsSaving(true);
    setError(null);

    try {
      // First update the goal data
      const updateResult = await updateGoalAction(goal.id, goalData);

      if (!updateResult.success) {
        setError(updateResult.error || '更新に失敗しました');
        return false;
      }

      // Then submit for review
      const submitResult = await submitGoalAction(goal.id, 'submitted');

      if (submitResult.success && submitResult.data) {
        setGoal(submitResult.data);
        return true;
      } else {
        setError(submitResult.error || '提出に失敗しました');
        return false;
      }
    } catch (err) {
      console.error('Error submitting goal:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [goal]);

  return {
    goal,
    supervisorReview,
    isLoading,
    error,
    saveDraft,
    submitGoal,
    isSaving,
  };
}
