'use client';

import { useState, useCallback } from 'react';
import { getGoalsAction } from '@/api/server-actions/goals';
import type { EvaluationPeriod } from '@/api/types';
import type { GoalResponse } from '@/api/types/goal';
import type { PerformanceGoal, CompetencyGoal } from './useGoalData';

export interface UsePeriodSelectionReturn {
  selectedPeriod: EvaluationPeriod | null;
  isLoadingExistingGoals: boolean;
  isAutoSaveReady: boolean;
  isGoalFetching: boolean;
  goalLoadingError: string | null;
  hasBlockingGoals: boolean;
  blockingMessage: string;
  loadedGoals: {
    performanceGoals: PerformanceGoal[];
    competencyGoals: CompetencyGoal[];
  } | null;
  handlePeriodSelected: (period: EvaluationPeriod, resetGoalData: () => void) => Promise<void>;
  activateAutoSave: () => void;
  clearPeriodSelection: () => void;
}

export function usePeriodSelection(currentUserId?: string): UsePeriodSelectionReturn {
  const [selectedPeriod, setSelectedPeriod] = useState<EvaluationPeriod | null>(null);
  const [isLoadingExistingGoals, setIsLoadingExistingGoals] = useState(false);
  const [isAutoSaveReady, setIsAutoSaveReady] = useState(false);
  const [isGoalFetching, setIsGoalFetching] = useState(false);
  const [goalLoadingError, setGoalLoadingError] = useState<string | null>(null);
  const [hasBlockingGoals, setHasBlockingGoals] = useState(false);
  const [blockingMessage, setBlockingMessage] = useState('');
  const [loadedGoals, setLoadedGoals] = useState<{
    performanceGoals: PerformanceGoal[];
    competencyGoals: CompetencyGoal[];
  } | null>(null);

  // Convert server goal data to frontend format
  const convertServerGoalToFrontend = useCallback((serverGoal: GoalResponse) => {
    if (serverGoal.goalCategory === '業績目標') {
      return {
        type: 'performance' as const,
        data: {
          id: serverGoal.id,
          type: serverGoal.performanceGoalType || 'quantitative',
          title: serverGoal.title || '',
          specificGoal: serverGoal.specificGoalText || '',
          achievementCriteria: serverGoal.achievementCriteriaText || '',
          method: serverGoal.meansMethodsText || '',
          weight: serverGoal.weight,
        } as PerformanceGoal
      };
    } else if (serverGoal.goalCategory === 'コンピテンシー') {
      return {
        type: 'competency' as const,
        data: {
          id: serverGoal.id,
          competencyIds: serverGoal.competencyIds || null,
          selectedIdealActions: serverGoal.selectedIdealActions || null,
          actionPlan: serverGoal.actionPlan || '',
        } as CompetencyGoal
      };
    }
    return null;
  }, []);

  const handlePeriodSelected = useCallback(async (
    period: EvaluationPeriod,
    resetGoalData: () => void
  ) => {
    setSelectedPeriod(period);
    setIsLoadingExistingGoals(true);
    setIsAutoSaveReady(false);
    setIsGoalFetching(true);
    setGoalLoadingError(null); // Reset error on new selection
    setHasBlockingGoals(false); // Reset blocking state
    setBlockingMessage(''); // Reset blocking message

    try {
      // Debug-only logging
      if (process.env.NODE_ENV !== 'production') console.debug(`🔍 Loading existing goals for period: ${period.name}`);

      // Reset goal data first
      resetGoalData();

      // Fetch ALL goals for this period to check for blocking statuses
      const result = await getGoalsAction({
        periodId: period.id,
        userId: currentUserId,
        status: ['draft', 'submitted', 'approved', 'rejected'] // Fetch ALL to check for blocking
      });

      if (result.success && result.data?.items) {
        const goals = result.data.items;
        if (process.env.NODE_ENV !== 'production') console.debug(`📊 Found ${goals.length} existing goals for period`);

        // TASK-04: Check for blocking goals (submitted or approved)
        const hasSubmittedGoals = goals.some(g => g.status === 'submitted');
        const hasApprovedGoals = goals.some(g => g.status === 'approved');

        if (hasSubmittedGoals || hasApprovedGoals) {
          // BLOCK: Goals with submitted/approved status exist
          if (process.env.NODE_ENV !== 'production') console.debug('🚫 Blocking goal creation - submitted/approved goals exist');
          setHasBlockingGoals(true);
          setBlockingMessage(
            hasApprovedGoals
              ? "目標は既に承認されています。承認済みの目標がある場合、新しい目標を作成することはできません。"
              : "目標は既に提出されています。提出済みの目標がある場合、新しい目標を作成することはできません。"
          );
          setLoadedGoals(null); // Don't load goals into form
          setIsLoadingExistingGoals(false);
          setIsAutoSaveReady(false); // Disable auto-save when blocked
          return; // Stop processing
        }

        // ALLOW: Filter only editable goals (draft/rejected) for form
        const editableGoals = goals.filter(g => g.status === 'draft' || g.status === 'rejected');

        if (editableGoals.length === 0) {
          if (process.env.NODE_ENV !== 'production') console.debug('📝 No editable goals found, starting fresh');
          setLoadedGoals(null);
          setIsLoadingExistingGoals(false);
          setIsAutoSaveReady(true); // Enable immediately when no editable goals
          return;
        }

        // Separate performance and competency goals from editable goals
        const performanceGoals: PerformanceGoal[] = [];
        const competencyGoals: CompetencyGoal[] = [];

        editableGoals.forEach(serverGoal => {
          const converted = convertServerGoalToFrontend(serverGoal);
          if (converted?.type === 'performance') {
            performanceGoals.push(converted.data);
          } else if (converted?.type === 'competency') {
            competencyGoals.push(converted.data);
          }
        });

        // Store the loaded goals for the parent component to use
        if (process.env.NODE_ENV !== 'production') console.debug(`✅ Converted goals: ${performanceGoals.length} performance, ${competencyGoals.length} competency`);
        
        if (process.env.NODE_ENV !== 'production') console.debug('🎯 Setting loadedGoals state and stopping loading flag');
        setLoadedGoals({
          performanceGoals,
          competencyGoals
        });
        
        // Set a flag that goals have been loaded
        setIsLoadingExistingGoals(false);
        
        if (process.env.NODE_ENV !== 'production') console.debug('⏳ Waiting for main component to load goals into forms before activating auto-save');
        
      } else {
        if (process.env.NODE_ENV !== 'production') console.debug('📝 API call failed or no data returned, starting fresh');
        setLoadedGoals(null);
        setIsLoadingExistingGoals(false);
        setIsAutoSaveReady(true); // Enable immediately when API fails
        setGoalLoadingError(result.error || '目標の読み込みに失敗しました。');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('❌ Error loading existing goals:', error);
      setLoadedGoals(null);
      setIsLoadingExistingGoals(false);
      setIsAutoSaveReady(true); // Enable auto-save even on error
      setGoalLoadingError('目標の読み込み中に予期せぬエラーが発生しました。');
    } finally {
      setIsGoalFetching(false);
    }
  }, [convertServerGoalToFrontend, currentUserId]);

  const activateAutoSave = useCallback(() => {
    if (process.env.NODE_ENV !== 'production') console.debug('🚀 Auto-save activated after goals loaded into forms');
    setIsAutoSaveReady(true);
  }, []);

  const clearPeriodSelection = useCallback(() => {
    setSelectedPeriod(null);
    setLoadedGoals(null);
    setIsLoadingExistingGoals(false);
    setIsAutoSaveReady(false);
    setIsGoalFetching(false);
    setHasBlockingGoals(false);
    setBlockingMessage('');
  }, []);

  return {
    selectedPeriod,
    isLoadingExistingGoals,
    isAutoSaveReady,
    isGoalFetching,
    goalLoadingError,
    hasBlockingGoals,
    blockingMessage,
    loadedGoals,
    handlePeriodSelected,
    activateAutoSave,
    clearPeriodSelection,
  };
}
