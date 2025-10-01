'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAutoSave } from './useAutoSave';
import { createGoalAction, updateGoalAction } from '@/api/server-actions/goals';
import type { GoalCreateRequest, GoalUpdateRequest } from '@/api/types/goal';
import type { EvaluationPeriod } from '@/api/types';
import type { GoalData } from './useGoalData';
import type { UseGoalTrackingReturn, GoalChangeInfo } from './useGoalTracking';

interface UseGoalAutoSaveOptions {
  goalData: GoalData;
  selectedPeriod: EvaluationPeriod | null;
  isLoadingExistingGoals: boolean;
  isAutoSaveReady: boolean;
  goalTracking: UseGoalTrackingReturn;
  onGoalReplaceWithServerData: (tempId: string, serverGoal: any, goalType: 'performance' | 'competency') => void;
}

export function useGoalAutoSave({
  goalData,
  selectedPeriod,
  isLoadingExistingGoals,
  isAutoSaveReady,
  goalTracking,
  onGoalReplaceWithServerData,
}: UseGoalAutoSaveOptions) {
  const isSavingRef = useRef(false);
  const {
    trackGoalLoad,
    clearChanges,
    isGoalDirty,
    getChangedGoals,
  } = goalTracking;

  
  // Validation function to check if a goal has all required fields for saving
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

  const handlePerformanceGoalAutoSave = useCallback(async (goalId: string, currentData: any, periodId: string): Promise<boolean> => {
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
        if (process.env.NODE_ENV !== 'production') console.error(`❌ Auto-save: Failed to create performance goal:`, {
          error: result?.error,
          sentData: createData,
          goalId: goalId
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
        if (process.env.NODE_ENV !== 'production') console.error(`❌ Auto-save: Failed to update performance goal ${goalId}:`, result?.error);

        // Show error toast for goal update failure
        toast.error('業績目標の更新に失敗しました', {
          description: result?.error || '目標の更新中にエラーが発生しました',
          duration: 4000,
        });

        return false;
      }
    }
  }, [trackGoalLoad, clearChanges, onGoalReplaceWithServerData]);

  const handleCompetencyGoalAutoSave = useCallback(async (goalId: string, currentData: any, periodId: string): Promise<boolean> => {
    console.log('🔧 handleCompetencyGoalAutoSave called with currentData:', currentData);
    // Check if this is a new competency goal (temporary ID starts with timestamp)
    const isNewGoal = goalId.match(/^\d+$/); // Temporary IDs are numeric timestamps
    
    if (isNewGoal) {
      // Create new competency goal with proper typing
      const createData: GoalCreateRequest = {
        periodId,
        goalCategory: 'コンピテンシー',
        status: 'draft',
        weight: 100,
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
  }, [trackGoalLoad, clearChanges, onGoalReplaceWithServerData]);
  
  const handleAutoSave = useCallback(async (changedGoals: GoalChangeInfo[]) => {
    if (process.env.NODE_ENV !== 'production') console.debug('🔄 Auto-save: handleAutoSave called with changed goals:', changedGoals);

    if (!selectedPeriod?.id) {
      if (process.env.NODE_ENV !== 'production') console.debug('🚫 Auto-save: No period selected');
      return false;
    }

    // Prevent concurrent save operations
    if (isSavingRef.current) {
      if (process.env.NODE_ENV !== 'production') console.debug('🚫 Auto-save: already in progress, skipping');
      return false;
    }

    // Skip auto-save when we're loading existing goals
    if (isLoadingExistingGoals) {
      if (process.env.NODE_ENV !== 'production') console.debug('🚫 Auto-save: skipping during goal loading');
      return false;
    }

    if (process.env.NODE_ENV !== 'production') console.debug(`📊 Auto-save: Found ${changedGoals.length} changed goals to process`);
    
    // EVENT-BASED CHECK 1: Filter out goals that aren't ready for saving (all fields filled)
    const completeGoals = changedGoals.filter(changeInfo => {
      const isComplete = isGoalReadyForSave(changeInfo.goalType, changeInfo.currentData);
      if (!isComplete) {
        if (process.env.NODE_ENV !== 'production') console.debug(`⏭️ Auto-save: Skipping ${changeInfo.goalType} goal ${changeInfo.goalId} - missing required fields`);
      }
      return isComplete;
    });

    // EVENT-BASED CHECK 2: Filter out goals that haven't actually changed from baseline
    const actuallyChangedGoals = completeGoals.filter(changeInfo => {
      const hasChanges = isGoalDirty(changeInfo.goalId);
      if (!hasChanges) {
        if (process.env.NODE_ENV !== 'production') console.debug(`⏭️ Auto-save: Skipping ${changeInfo.goalType} goal ${changeInfo.goalId} - no actual changes detected`);
      }
      return hasChanges;
    });

    if (actuallyChangedGoals.length === 0) {
      if (process.env.NODE_ENV !== 'production') console.debug('⏭️ Auto-save: No changed complete goals to save');
      return true; // Return true to avoid error state - this is normal for incomplete/unchanged goals
    }
    
    if (process.env.NODE_ENV !== 'production') console.debug(`🎯 Auto-save: Saving ${actuallyChangedGoals.length} changed complete goals`);
    
    // Set saving flag to prevent concurrent operations
    isSavingRef.current = true;
    
    try {
      let allSuccessful = true;

      // Process each changed complete goal individually  
      for (const changeInfo of actuallyChangedGoals) {
        const { goalId, goalType, currentData } = changeInfo;
        
        if (process.env.NODE_ENV !== 'production') console.debug(`🎯 Auto-save: Processing ${goalType} goal ${goalId}`, {
        goalId,
        goalType,
        currentData,
        isComplete: isGoalReadyForSave(goalType, currentData)
      });

        if (goalType === 'performance') {
          const success = await handlePerformanceGoalAutoSave(goalId, currentData, selectedPeriod.id);
          if (!success) allSuccessful = false;
        } else if (goalType === 'competency') {
          const success = await handleCompetencyGoalAutoSave(goalId, currentData, selectedPeriod.id);
          if (!success) allSuccessful = false;
        }
      }

      return allSuccessful;
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      return false;
    } finally {
      // Always clear the saving flag
      isSavingRef.current = false;
    }
  }, [selectedPeriod?.id, isLoadingExistingGoals, isGoalDirty, isGoalReadyForSave, handlePerformanceGoalAutoSave, handleCompetencyGoalAutoSave]);

  // Stable change detector to avoid re-renders due to new function identity
  const detectChanges = useCallback(() => getChangedGoals(), [getChangedGoals]);

  // Set up auto-save with change detection - ONLY when period is selected
  useAutoSave<GoalData>({
    data: goalData,
    onSave: handleAutoSave,
    delay: 2000, // 2 seconds delay for responsive feedback while preventing excessive calls
    enabled: !!selectedPeriod?.id, // Enable when period is selected
    autoSaveReady: isAutoSaveReady && !!selectedPeriod?.id, // Only activate when explicitly ready AND period selected
    changeDetector: detectChanges, // Only get changed goals
    // Use content-aware keys to detect changes in goal fields (maintain original order)
    dataKey: {
      perfCount: goalData.performanceGoals.length,
      // Keep original order to match tracking system
      perfContent: goalData.performanceGoals
        .map(g => `${g.id}:${g.title}:${g.specificGoal}:${g.achievementCriteria}:${g.method}:${g.weight}:${g.type}`)
        .join('|'),
      compCount: goalData.competencyGoals.length,
      // Keep original order to match tracking system
      compContent: goalData.competencyGoals
        .map(g => `${g.id}:${g.actionPlan}:${JSON.stringify(g.competencyIds)}:${JSON.stringify(g.selectedIdealActions)}`)
        .join('|'),
      ready: isAutoSaveReady,
    }
  });
}