'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createGoalAction, updateGoalAction } from '@/api/server-actions/goals';
import type { GoalCreateRequest, GoalUpdateRequest } from '@/api/types/goal';
import type { EvaluationPeriod } from '@/api/types';
import type { GoalData } from './useGoalData';
import type { StageWeightBudget } from '@/feature/goal-input/types';
import type { UseGoalTrackingReturn } from './useGoalTracking';

interface UseGoalAutoSaveOptions {
  goalData: GoalData;
  selectedPeriod: EvaluationPeriod | null;
  isLoadingExistingGoals: boolean;
  isAutoSaveReady: boolean;
  goalTracking: UseGoalTrackingReturn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onGoalReplaceWithServerData: (tempId: string, serverGoal: any, goalType: 'performance' | 'competency') => void;
  stageBudgets: StageWeightBudget;
}

export function useGoalAutoSave({
  goalData,
  selectedPeriod,
  isLoadingExistingGoals,
  isAutoSaveReady,
  goalTracking,
  onGoalReplaceWithServerData,
  stageBudgets,
}: UseGoalAutoSaveOptions) {
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const isUnmountedRef = useRef(false);
  const isProcessingQueueRef = useRef(false);
  const goalDataRef = useRef(goalData);
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastSeenGoalDataRef = useRef<Map<string, string>>(new Map());
  const saveQueueRef = useRef<Array<{ goalId: string; goalType: 'performance' | 'competency' }>>([]);
  const saveQueueKeySetRef = useRef<Set<string>>(new Set());

  const {
    trackGoalLoad,
    clearChanges,
    isGoalDirty,
    getChangedGoals,
  } = goalTracking;

  useEffect(() => {
    goalDataRef.current = goalData;
  }, [goalData]);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      for (const timer of debounceTimersRef.current.values()) {
        clearTimeout(timer);
      }
      debounceTimersRef.current.clear();
      lastSeenGoalDataRef.current.clear();
      saveQueueRef.current = [];
      saveQueueKeySetRef.current.clear();
    };
  }, []);

  const getTrackingKey = useCallback((goalType: 'performance' | 'competency', goalId: string) => {
    return `${goalType}:${goalId}`;
  }, []);

  
  // Validation function to check if a goal has all required fields for saving
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isGoalReadyForSave = useCallback((goalType: 'performance' | 'competency', goalData: any): boolean => {
    if (goalType === 'performance') {
      // Performance goal requires: title, performanceGoalType, specificGoalText, achievementCriteriaText, meansMethodsText
      const hasAllFields = !!(
        goalData.title?.trim() &&
        goalData.type && // performanceGoalType
        goalData.specificGoal?.trim() && // specificGoalText
        goalData.achievementCriteria?.trim() && // achievementCriteriaText
        goalData.method?.trim() && // meansMethodsText
        typeof goalData.weight === 'number' && goalData.weight >= 0 && goalData.weight <= 100
      );
      
      if (process.env.NODE_ENV !== 'production') console.debug(`🔍 Performance goal validation for ID ${goalData.id}:`, {
        title: !!goalData.title?.trim(),
        type: !!goalData.type,
        specificGoal: !!goalData.specificGoal?.trim(),
        achievementCriteria: !!goalData.achievementCriteria?.trim(),
        method: !!goalData.method?.trim(),
        weight: typeof goalData.weight === 'number' && goalData.weight >= 0 && goalData.weight <= 100,
        isReady: hasAllFields
      });
      
      return hasAllFields;
    } else if (goalType === 'competency') {
      // Competency goal requires: actionPlan (competencyIds and selectedIdealActions are optional)
      const hasAllFields = !!goalData.actionPlan?.trim();
      
      if (process.env.NODE_ENV !== 'production') console.debug(`🔍 Competency goal validation for ID ${goalData.id}:`, {
        actionPlan: !!goalData.actionPlan?.trim(),
        competencyIds: goalData.competencyIds?.length || 0,
        selectedIdealActions: Object.keys(goalData.selectedIdealActions || {}).length,
        isReady: hasAllFields
      });
      
      return hasAllFields;
    }
    return false;
  }, []);

  const getCurrentGoalData = useCallback((goalId: string, goalType: 'performance' | 'competency') => {
    if (goalType === 'performance') {
      return goalDataRef.current.performanceGoals.find(goal => goal.id === goalId);
    }
    return goalDataRef.current.competencyGoals.find(goal => goal.id === goalId);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePerformanceGoalAutoSave = useCallback(async (goalId: string, currentData: any, periodId: string): Promise<boolean> => {
    const getBucketContext = (goalType: string, weight: number) => {
      const bucket: 'quantitative' | 'qualitative' = goalType === 'qualitative' ? 'qualitative' : 'quantitative';
      const bucketBudget = stageBudgets?.[bucket] ?? 0;
      const bucketTotal = goalData.performanceGoals
        .filter(goal => goal.type === bucket)
        .reduce((sum, goal) => sum + goal.weight, 0);
      return { bucket, bucketBudget, bucketTotal, attemptedWeight: weight };
    };

    // Check if this is a new performance goal (temporary ID starts with timestamp)
    const isNewGoal = goalId.match(/^\d+$/); // Temporary IDs are numeric timestamps
    
    if (isNewGoal) {
      // Create new performance goal
      const createData: GoalCreateRequest = {
        periodId,
        goalCategory: '業績目標',
        status: 'draft',
        title: currentData.title,
        performanceGoalType: currentData.type,
        specificGoalText: currentData.specificGoal,
        achievementCriteriaText: currentData.achievementCriteria,
        meansMethodsText: currentData.method,
        weight: currentData.weight,
      };
      
      if (process.env.NODE_ENV !== 'production') console.debug(`🚀 Auto-save: Creating performance goal with data:`, createData);
      const result = await createGoalAction(createData);
      
      if (result && result.success && result.data) {
        if (process.env.NODE_ENV !== 'production') console.debug(`✅ Auto-save: Performance goal created successfully with ID ${result.data.id}`);

        // Show success toast for new goal creation
        toast.success('業績目標を保存しました', {
          description: result.data.title ? `「${result.data.title}」を自動保存しました` : '新しい目標を自動保存しました',
          duration: 2000,
        });

        // Replace the temporary goal with server data (preserving ID immutability)
        onGoalReplaceWithServerData(goalId, result.data, 'performance');

        // Track the new goal with server ID
        trackGoalLoad(result.data.id, 'performance', result.data);
        clearChanges(goalId); // Clear the temporary ID changes
        return true;
      } else {
        const context = getBucketContext(currentData.type, currentData.weight);
        if (process.env.NODE_ENV !== 'production') console.error(`❌ Auto-save: Failed to create performance goal:`, {
          error: result?.error,
          sentData: createData,
          goalId,
          ...context,
        });

        // Show error toast for goal creation failure
        toast.error('業績目標の保存に失敗しました', {
          description: result?.error || '目標の作成中にエラーが発生しました',
          duration: 4000,
        });

        return false;
      }
    } else {
      // Update existing performance goal
      const updateData: GoalUpdateRequest = {
        title: currentData.title,
        performanceGoalType: currentData.type,
        specificGoalText: currentData.specificGoal,
        achievementCriteriaText: currentData.achievementCriteria,
        meansMethodsText: currentData.method,
        weight: currentData.weight,
      };
      const result = await updateGoalAction(goalId, updateData);
      
      if (result && result.success) {
        if (process.env.NODE_ENV !== 'production') console.debug(`✅ Auto-save: Performance goal ${goalId} updated successfully`);

        // Show success toast for goal update
        toast.success('業績目標を更新しました', {
          description: currentData.title ? `「${currentData.title}」を自動保存しました` : '目標を自動保存しました',
          duration: 2000,
        });

        // Update the baseline with the current data after successful save
        // This ensures that future changes are compared against the newly saved state
        trackGoalLoad(goalId, 'performance', currentData);

        return true;
      } else {
        const context = getBucketContext(currentData.type, currentData.weight);
        if (process.env.NODE_ENV !== 'production') console.error(`❌ Auto-save: Failed to update performance goal ${goalId}:`, {
          error: result?.error,
          goalId,
          ...context,
        });

        // Show error toast for goal update failure
        toast.error('業績目標の更新に失敗しました', {
          description: result?.error || '目標の更新中にエラーが発生しました',
          duration: 4000,
        });

        return false;
      }
    }
  }, [trackGoalLoad, clearChanges, onGoalReplaceWithServerData, stageBudgets, goalData.performanceGoals]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCompetencyGoalAutoSave = useCallback(async (goalId: string, currentData: any, periodId: string): Promise<boolean> => {
    console.log('🔧 handleCompetencyGoalAutoSave called with currentData:', currentData);
    // Check if this is a new competency goal (temporary ID starts with timestamp)
    const isNewGoal = goalId.match(/^\d+$/); // Temporary IDs are numeric timestamps
    
    if (isNewGoal) {
      const competencyWeight = Number.isFinite(stageBudgets?.competency) ? stageBudgets.competency : 0;
      // Create new competency goal with proper typing
      const createData: GoalCreateRequest = {
        periodId,
        goalCategory: 'コンピテンシー',
        status: 'draft',
        weight: competencyWeight,
        actionPlan: currentData.actionPlan,
        competencyIds: currentData.competencyIds && currentData.competencyIds.length > 0 ? currentData.competencyIds : null,
        selectedIdealActions: currentData.selectedIdealActions && Object.keys(currentData.selectedIdealActions).length > 0 ? currentData.selectedIdealActions : null,
      };
      
      console.log(`🚀 Auto-save: Creating competency goal with data:`, JSON.stringify(createData, null, 2));
      const result = await createGoalAction(createData);
      
      if (result && result.success && result.data) {
        if (process.env.NODE_ENV !== 'production') console.debug(`✅ Auto-save: Competency goal created successfully with ID ${result.data.id}`);

        // Show success toast for new competency goal creation
        toast.success('コンピテンシー目標を保存しました', {
          description: '新しいコンピテンシー目標を自動保存しました',
          duration: 2000,
        });

        // Replace the temporary goal with server data (preserving ID immutability)
        onGoalReplaceWithServerData(goalId, result.data, 'competency');

        // Track the new goal with server ID
        trackGoalLoad(result.data.id, 'competency', result.data);
        clearChanges(goalId); // Clear the temporary ID changes
        return true;
      } else {
        if (process.env.NODE_ENV !== 'production') console.error(`❌ Auto-save: Failed to create competency goal:`, {
          error: result?.error,
          sentData: createData,
          goalId: goalId
        });

        // Show error toast for competency goal creation failure
        toast.error('コンピテンシー目標の保存に失敗しました', {
          description: result?.error || 'コンピテンシー目標の作成中にエラーが発生しました',
          duration: 4000,
        });

        return false;
      }
    } else {
      // Update existing competency goal
      const updateData: GoalUpdateRequest = {
        actionPlan: currentData.actionPlan,
        competencyIds: currentData.competencyIds && currentData.competencyIds.length > 0 ? currentData.competencyIds : null,
        selectedIdealActions: currentData.selectedIdealActions && Object.keys(currentData.selectedIdealActions).length > 0 ? currentData.selectedIdealActions : null,
      };
      const result = await updateGoalAction(goalId, updateData);
      
      if (result && result.success) {
        if (process.env.NODE_ENV !== 'production') console.debug(`✅ Auto-save: Competency goal ${goalId} updated successfully`);

        // Show success toast for competency goal update
        toast.success('コンピテンシー目標を更新しました', {
          description: 'コンピテンシー目標を自動保存しました',
          duration: 2000,
        });

        // Update the baseline with the current data after successful save
        // This ensures that future changes are compared against the newly saved state
        trackGoalLoad(goalId, 'competency', currentData);

        return true;
      } else {
        if (process.env.NODE_ENV !== 'production') console.error(`❌ Auto-save: Failed to update competency goal ${goalId}:`, result?.error);

        // Show error toast for competency goal update failure
        toast.error('コンピテンシー目標の更新に失敗しました', {
          description: result?.error || 'コンピテンシー目標の更新中にエラーが発生しました',
          duration: 4000,
        });

        return false;
      }
    }
  }, [trackGoalLoad, clearChanges, onGoalReplaceWithServerData, stageBudgets]);

  const processSaveQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    if (!selectedPeriod?.id) return;
    if (isLoadingExistingGoals) return;

    isProcessingQueueRef.current = true;
    if (!isUnmountedRef.current) setIsAutoSaving(true);

    try {
      while (saveQueueRef.current.length > 0) {
        const next = saveQueueRef.current.shift();
        if (!next) continue;

        const key = getTrackingKey(next.goalType, next.goalId);
        saveQueueKeySetRef.current.delete(key);

        const currentData = getCurrentGoalData(next.goalId, next.goalType);
        if (!currentData) continue;

        // Only save if still dirty and complete at execution time.
        if (!isGoalDirty(next.goalId)) continue;
        if (!isGoalReadyForSave(next.goalType, currentData)) continue;

        if (next.goalType === 'performance') {
          await handlePerformanceGoalAutoSave(next.goalId, currentData, selectedPeriod.id);
        } else {
          await handleCompetencyGoalAutoSave(next.goalId, currentData, selectedPeriod.id);
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      if (!isUnmountedRef.current) setIsAutoSaving(false);

      // If items were enqueued while we were finishing, process them.
      if (saveQueueRef.current.length > 0) {
        setTimeout(() => {
          void processSaveQueue();
        }, 0);
      }
    }
  }, [
    getCurrentGoalData,
    getTrackingKey,
    handleCompetencyGoalAutoSave,
    handlePerformanceGoalAutoSave,
    isGoalDirty,
    isGoalReadyForSave,
    isLoadingExistingGoals,
    selectedPeriod?.id,
  ]);

  const enqueueGoalSave = useCallback((goalId: string, goalType: 'performance' | 'competency') => {
    const key = getTrackingKey(goalType, goalId);
    if (saveQueueKeySetRef.current.has(key)) return;

    saveQueueKeySetRef.current.add(key);
    saveQueueRef.current.push({ goalId, goalType });
    void processSaveQueue();
  }, [getTrackingKey, processSaveQueue]);

  useEffect(() => {
    if (!selectedPeriod?.id) return;
    if (isLoadingExistingGoals) return;
    if (!isAutoSaveReady) return;

    const changedGoals = getChangedGoals();
    const activeKeys = new Set<string>();

    for (const changeInfo of changedGoals) {
      const { goalId, goalType, currentData } = changeInfo;
      const key = getTrackingKey(goalType, goalId);
      activeKeys.add(key);

      if (!isGoalReadyForSave(goalType, currentData)) {
        const existingTimer = debounceTimersRef.current.get(key);
        if (existingTimer) {
          clearTimeout(existingTimer);
          debounceTimersRef.current.delete(key);
        }
        continue;
      }

      const serialized = JSON.stringify(currentData);
      const lastSeen = lastSeenGoalDataRef.current.get(key);
      if (lastSeen === serialized) {
        continue;
      }
      lastSeenGoalDataRef.current.set(key, serialized);

      const existingTimer = debounceTimersRef.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      debounceTimersRef.current.set(key, setTimeout(() => {
        enqueueGoalSave(goalId, goalType);
      }, 1000));
    }

    // Clean up timers for goals that are no longer dirty.
    for (const [key, timer] of debounceTimersRef.current.entries()) {
      if (!activeKeys.has(key)) {
        clearTimeout(timer);
        debounceTimersRef.current.delete(key);
        lastSeenGoalDataRef.current.delete(key);
      }
    }
  }, [
    enqueueGoalSave,
    getChangedGoals,
    getTrackingKey,
    isAutoSaveReady,
    isGoalReadyForSave,
    isLoadingExistingGoals,
    selectedPeriod?.id,
    goalData,
  ]);

  return { isAutoSaving };
}
