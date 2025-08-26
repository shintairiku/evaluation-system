'use client';

import { useState, useCallback } from 'react';
import { getGoalsAction } from '@/api/server-actions/goals';
import type { EvaluationPeriod } from '@/api/types/evaluation';
import type { GoalResponse } from '@/api/types/goal';
import type { PerformanceGoal, CompetencyGoal } from './useGoalData';

export interface UsePeriodSelectionReturn {
  selectedPeriod: EvaluationPeriod | null;
  isLoadingExistingGoals: boolean;
  isAutoSaveReady: boolean;
  isGoalFetching: boolean;
  goalLoadingError: string | null; 
  loadedGoals: {
    performanceGoals: PerformanceGoal[];
    competencyGoals: CompetencyGoal[];
  } | null;
  handlePeriodSelected: (period: EvaluationPeriod, resetGoalData: () => void) => Promise<void>;
  activateAutoSave: () => void;
  clearPeriodSelection: () => void;
}

export function usePeriodSelection(): UsePeriodSelectionReturn {
  const [selectedPeriod, setSelectedPeriod] = useState<EvaluationPeriod | null>(null);
  const [isLoadingExistingGoals, setIsLoadingExistingGoals] = useState(false);
  const [isAutoSaveReady, setIsAutoSaveReady] = useState(false);
  const [isGoalFetching, setIsGoalFetching] = useState(false);
  const [goalLoadingError, setGoalLoadingError] = useState<string | null>(null); 
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
          selectedCompetencyId: serverGoal.competencyId || '',
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

    try {
      // Debug-only logging
      if (process.env.NODE_ENV !== 'production') console.debug(`🔍 Loading existing goals for period: ${period.name}`);
      
      // Reset goal data first
      resetGoalData();
      
      // Fetch existing goals for this period with status 'incomplete' (auto-saved goals)
      const result = await getGoalsAction({ 
        periodId: period.id,
        status: 'incomplete' // Only get auto-saved goals first
      });

      if (result.success && result.data?.items) {
        const goals = result.data.items;
        if (process.env.NODE_ENV !== 'production') console.debug(`📊 Found ${goals.length} existing goals for period`);
        
        if (goals.length === 0) {
          if (process.env.NODE_ENV !== 'production') console.debug('📝 No existing goals found, starting fresh');
          setLoadedGoals(null);
          setIsLoadingExistingGoals(false);
          setIsAutoSaveReady(true); // Enable immediately when no existing goals
          return;
        }
        
        // Separate performance and competency goals
        const performanceGoals: PerformanceGoal[] = [];
        const competencyGoals: CompetencyGoal[] = [];
        
        goals.forEach(serverGoal => {
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
  }, [convertServerGoalToFrontend]);

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
  }, []);

  return {
    selectedPeriod,
    isLoadingExistingGoals,
    isAutoSaveReady,
    isGoalFetching,
    goalLoadingError,
    loadedGoals,
    handlePeriodSelected,
    activateAutoSave,
    clearPeriodSelection,
  };
}