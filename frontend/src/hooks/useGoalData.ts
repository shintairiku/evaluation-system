'use client';

import { useState, useCallback } from 'react';

// Debug logger (no-op in production)
const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') console.debug(...args);
};
import { useGoalTracking } from './useGoalTracking';
import type { GoalResponse, PerformanceGoalType } from '@/api/types/goal';
import type { UseGoalTrackingReturn } from './useGoalTracking';

// Frontend-specific goal interfaces that match the component structure
export interface PerformanceGoal {
  id: string; // Will be server ID or temporary timestamp ID
  type: PerformanceGoalType;
  title: string;
  specificGoal: string;
  achievementCriteria: string;
  method: string;
  weight: number;
}

export interface CompetencyGoal {
  id: string; // Will be server ID or temporary timestamp ID  
  selectedCompetencyId: string;
  actionPlan: string;
}

export interface GoalData {
  performanceGoals: PerformanceGoal[];
  competencyGoals: CompetencyGoal[];
}

export interface UseGoalDataReturn {
  goalData: GoalData;
  updatePerformanceGoals: (goals: PerformanceGoal[]) => void;
  updateCompetencyGoals: (goals: CompetencyGoal[]) => void;
  loadGoalsFromServer: (performanceGoals: PerformanceGoal[], competencyGoals: CompetencyGoal[]) => void;
  resetGoalData: () => void;
  replaceGoalWithServerData: (tempId: string, serverGoal: GoalResponse, goalType: 'performance' | 'competency') => void;
  goalTracking: UseGoalTrackingReturn;
}

const initialGoalData: GoalData = {
  performanceGoals: [],
  competencyGoals: [],
};

export function useGoalData(): UseGoalDataReturn {
  const [goalData, setGoalData] = useState<GoalData>(initialGoalData);
  
  // Initialize goal tracking hook
  const goalTracking = useGoalTracking();
  const { trackGoalChange, clearChanges } = goalTracking;

  const updatePerformanceGoals = useCallback((goals: PerformanceGoal[]) => {
    debugLog('📊 updatePerformanceGoals called with:', goals);
    setGoalData(prev => {
      const newData = { ...prev, performanceGoals: goals };
      return newData;
    });
    
    // NOTE: Removed trackGoalChange calls to prevent infinite loops
    // Goal tracking is now handled externally by components when user makes changes
  }, []);

  const updateCompetencyGoals = useCallback((goals: CompetencyGoal[]) => {
    debugLog('🧠 updateCompetencyGoals called with:', goals);
    setGoalData(prev => {
      const newData = { ...prev, competencyGoals: goals };
      return newData;
    });
    
    // NOTE: Removed trackGoalChange calls to prevent infinite loops
    // Goal tracking is now handled externally by components when user makes changes
  }, []);

  // Load goals from server data and set up proper baseline tracking
  const loadGoalsFromServer = useCallback((performanceGoals: PerformanceGoal[], competencyGoals: CompetencyGoal[]) => {
    debugLog('🔄 loadGoalsFromServer called - setting up baseline tracking');
    
    // Update state first
    setGoalData({
      performanceGoals,
      competencyGoals,
    });
    
    // Set up baseline tracking for loaded goals (not as changes, but as original state)
    performanceGoals.forEach(goal => {
      goalTracking.trackGoalLoad(goal.id, 'performance', goal);
    });
    competencyGoals.forEach(goal => {
      goalTracking.trackGoalLoad(goal.id, 'competency', goal);
    });
    
    debugLog(`✅ Loaded and tracked ${performanceGoals.length} performance + ${competencyGoals.length} competency goals`);
  }, [goalTracking]);

  const resetGoalData = useCallback(() => {
    debugLog('🧹 resetGoalData called');
    setGoalData(initialGoalData);
    clearChanges(); // Clear all change tracking
  }, [clearChanges]);

  // Convert server goal data to frontend format and replace temporary IDs
  const replaceGoalWithServerData = useCallback((tempId: string, serverGoal: GoalResponse, goalType: 'performance' | 'competency') => {
    if (goalType === 'performance') {
      setGoalData(prev => ({
        ...prev,
        performanceGoals: prev.performanceGoals.map(goal => 
          goal.id === tempId ? {
            id: serverGoal.id,
            type: serverGoal.performanceGoalType || 'quantitative',
            title: serverGoal.title || '',
            specificGoal: serverGoal.specificGoalText || '',
            achievementCriteria: serverGoal.achievementCriteriaText || '',
            method: serverGoal.meansMethodsText || '',
            weight: serverGoal.weight,
          } : goal
        )
      }));
    } else if (goalType === 'competency') {
      setGoalData(prev => ({
        ...prev,
        competencyGoals: prev.competencyGoals.map(goal => 
          goal.id === tempId ? {
            id: serverGoal.id,
            selectedCompetencyId: serverGoal.competencyId || '',
            actionPlan: serverGoal.actionPlan || '',
          } : goal
        )
      }));
    }
  }, []);

  return {
    goalData,
    updatePerformanceGoals,
    updateCompetencyGoals,
    loadGoalsFromServer,
    resetGoalData,
    replaceGoalWithServerData,
    goalTracking,
  };
}