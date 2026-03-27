'use client';

import { useState, useCallback } from 'react';
import { getGoalsAction } from '@/api/server-actions/goals';
import type { EvaluationPeriod } from '@/api/types';
import type { GoalResponse } from '@/api/types/goal';
import type { PerformanceGoal, CompetencyGoal } from './useGoalData';
import type { ReadOnlyGoals, ReadOnlyPerformanceGoal, ReadOnlyCompetencyGoal } from '@/feature/goal-input/types';

export interface UsePeriodSelectionReturn {
  selectedPeriod: EvaluationPeriod | null;
  isLoadingExistingGoals: boolean;
  isAutoSaveReady: boolean;
  isGoalFetching: boolean;
  goalLoadingError: string | null;
  hasBlockingGoals: boolean;
  blockingMessage: string;
  readOnlyGoals: ReadOnlyGoals | null;
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
  const [readOnlyGoals, setReadOnlyGoals] = useState<ReadOnlyGoals | null>(null);
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
    setGoalLoadingError(null);
    setHasBlockingGoals(false);
    setBlockingMessage('');
    setReadOnlyGoals(null);

    try {
      if (process.env.NODE_ENV !== 'production') console.debug(`🔍 Loading existing goals for period: ${period.name}`);

      resetGoalData();

      const result = await getGoalsAction({
        periodId: period.id,
        userId: currentUserId,
        status: ['draft', 'submitted', 'approved', 'rejected']
      });

      if (result.success && result.data?.items) {
        const goals = result.data.items;
        if (process.env.NODE_ENV !== 'production') console.debug(`📊 Found ${goals.length} existing goals for period`);

        // Separate goals by status
        const blockingGoals = goals.filter(g => g.status === 'submitted' || g.status === 'approved');
        const editableGoals = goals.filter(g => g.status === 'draft' || g.status === 'rejected');

        if (blockingGoals.length > 0) {
          // Convert blocking goals to read-only format (inline, not reusing convertServerGoalToFrontend since ReadOnly types need status)
          const roPerformance: ReadOnlyPerformanceGoal[] = [];
          const roCompetency: ReadOnlyCompetencyGoal[] = [];

          blockingGoals.forEach(serverGoal => {
            if (serverGoal.goalCategory === '業績目標') {
              roPerformance.push({
                id: serverGoal.id,
                status: serverGoal.status as 'submitted' | 'approved',
                type: (serverGoal.performanceGoalType || 'quantitative') as 'quantitative' | 'qualitative',
                title: serverGoal.title || '',
                specificGoal: serverGoal.specificGoalText || '',
                achievementCriteria: serverGoal.achievementCriteriaText || '',
                method: serverGoal.meansMethodsText || '',
                weight: serverGoal.weight,
              });
            } else if (serverGoal.goalCategory === 'コンピテンシー') {
              roCompetency.push({
                id: serverGoal.id,
                status: serverGoal.status as 'submitted' | 'approved',
                competencyIds: serverGoal.competencyIds || null,
                selectedIdealActions: serverGoal.selectedIdealActions || null,
                actionPlan: serverGoal.actionPlan || '',
              });
            }
          });

          // Check if everything is complete (full block) or partial (allow new goals)
          const roPerfWeight = roPerformance.reduce((sum, g) => sum + g.weight, 0);
          const hasCompetency = roCompetency.length > 0;

          if (roPerfWeight >= 100 && hasCompetency) {
            // FULL BLOCK: All weight accounted for + competency exists
            if (process.env.NODE_ENV !== 'production') console.debug('🚫 Full block - all goals complete');
            const hasApproved = blockingGoals.some(g => g.status === 'approved');
            setHasBlockingGoals(true);
            setBlockingMessage(
              hasApproved
                ? "目標は既に承認されています。承認済みの目標がある場合、新しい目標を作成することはできません。"
                : "目標は既に提出されています。提出済みの目標がある場合、新しい目標を作成することはできません。"
            );
            setLoadedGoals(null);
            setReadOnlyGoals(null);
            setIsLoadingExistingGoals(false);
            setIsAutoSaveReady(false);
            return;
          }

          // PARTIAL: Some goals are read-only, but there's room for new ones
          if (process.env.NODE_ENV !== 'production') console.debug(`📋 Partial block - ${roPerformance.length} perf read-only (${roPerfWeight}%), ${roCompetency.length} comp read-only`);
          setReadOnlyGoals({ performanceGoals: roPerformance, competencyGoals: roCompetency });
        }

        // Process editable goals (draft/rejected) for the form
        if (editableGoals.length === 0) {
          if (process.env.NODE_ENV !== 'production') console.debug('📝 No editable goals found, starting fresh');
          setLoadedGoals(null);
          setIsLoadingExistingGoals(false);
          setIsAutoSaveReady(true);
          return;
        }

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

        if (process.env.NODE_ENV !== 'production') console.debug(`✅ Converted goals: ${performanceGoals.length} performance, ${competencyGoals.length} competency`);

        setLoadedGoals({
          performanceGoals,
          competencyGoals
        });
        setIsLoadingExistingGoals(false);

        if (process.env.NODE_ENV !== 'production') console.debug('⏳ Waiting for main component to load goals into forms before activating auto-save');

      } else {
        if (process.env.NODE_ENV !== 'production') console.debug('📝 API call failed or no data returned, starting fresh');
        setLoadedGoals(null);
        setIsLoadingExistingGoals(false);
        setIsAutoSaveReady(true);
        setGoalLoadingError(result.error || '目標の読み込みに失敗しました。');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('❌ Error loading existing goals:', error);
      setLoadedGoals(null);
      setIsLoadingExistingGoals(false);
      setIsAutoSaveReady(true);
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
    setReadOnlyGoals(null);
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
    readOnlyGoals,
    loadedGoals,
    handlePeriodSelected,
    activateAutoSave,
    clearPeriodSelection,
  };
}
