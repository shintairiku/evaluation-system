'use client';

import { useRef, useCallback } from 'react';

export interface GoalChangeInfo {
  goalId: string;
  goalType: 'performance' | 'competency';
  hasChanges: boolean;
  originalData: unknown;
  currentData: unknown;
}

export interface UseGoalTrackingReturn {
  trackGoalLoad: (goalId: string, goalType: 'performance' | 'competency', data: unknown) => void;
  trackGoalChange: (goalId: string, goalType: 'performance' | 'competency', data: unknown) => void;
  getChangedGoals: () => GoalChangeInfo[];
  hasAnyChanges: () => boolean;
  clearChanges: (goalId?: string) => void;
  isGoalDirty: (goalId: string) => boolean;
  getOriginalData: (goalId: string) => unknown;
}

export function useGoalTracking(): UseGoalTrackingReturn {
  // Store original data when goals are loaded from server
  const originalDataRef = useRef<Map<string, any>>(new Map());
  
  // Store current data to detect changes
  const currentDataRef = useRef<Map<string, any>>(new Map());
  
  // Track which goals have been modified by user
  const dirtyGoalsRef = useRef<Set<string>>(new Set());
  
  // Track goal types for proper categorization
  const goalTypesRef = useRef<Map<string, 'performance' | 'competency'>>(new Map());

  /**
   * Track when a goal is loaded from server (original state)
   */
  const trackGoalLoad = useCallback((goalId: string, goalType: 'performance' | 'competency', data: unknown) => {
    const dataString = JSON.stringify(data);

    originalDataRef.current.set(goalId, dataString);
    currentDataRef.current.set(goalId, dataString);
    goalTypesRef.current.set(goalId, goalType);

    // Clear dirty flag when loading original data
    dirtyGoalsRef.current.delete(goalId);

    if (process.env.NODE_ENV !== 'production') console.debug(`🔍 Goal tracking: Loaded ${goalType} goal ${goalId}`);
  }, []);

  /**
   * Track when a goal is changed by user input
   */
  const trackGoalChange = useCallback((goalId: string, goalType: 'performance' | 'competency', data: unknown) => {
    const dataString = JSON.stringify(data);
    const originalData = originalDataRef.current.get(goalId);

    console.log(`📊 Goal tracking: ${goalType} goal ${goalId} change tracked`);
    currentDataRef.current.set(goalId, dataString);
    goalTypesRef.current.set(goalId, goalType);

    // If there's no original baseline (brand new temp goal), treat as dirty
    if (!originalData) {
      dirtyGoalsRef.current.add(goalId);
      console.log(`🆕 Goal tracking: ${goalType} goal ${goalId} marked as dirty (no baseline)`);
    } else if (originalData !== dataString) {
      // Mark as dirty if different from original
      dirtyGoalsRef.current.add(goalId);
      console.log(`🔄 Goal tracking: ${goalType} goal ${goalId} marked as dirty`);
    } else {
      dirtyGoalsRef.current.delete(goalId);
      console.log(`✅ Goal tracking: ${goalType} goal ${goalId} reverted to original state`);
    }
  }, []);

  /**
   * Get all goals that have been changed by user
   */
  const getChangedGoals = useCallback((): GoalChangeInfo[] => {
    const changedGoals: GoalChangeInfo[] = [];
    
    for (const goalId of dirtyGoalsRef.current) {
      const goalType = goalTypesRef.current.get(goalId);
      const originalData = originalDataRef.current.get(goalId);
      const currentData = currentDataRef.current.get(goalId);
      
      if (goalType && currentData) {
        changedGoals.push({
          goalId,
          goalType,
          hasChanges: true,
          originalData: originalData ? JSON.parse(originalData) : null,
          currentData: JSON.parse(currentData),
        });
      }
    }
    
    return changedGoals;
  }, []);

  /**
   * Check if any goals have been modified
   */
  const hasAnyChanges = useCallback((): boolean => {
    return dirtyGoalsRef.current.size > 0;
  }, []);

  /**
   * Clear change tracking for specific goal or all goals
   */
  const clearChanges = useCallback((goalId?: string) => {
    if (goalId) {
      dirtyGoalsRef.current.delete(goalId);
      if (process.env.NODE_ENV !== 'production') console.debug(`🧹 Goal tracking: Cleared changes for goal ${goalId}`);
    } else {
      dirtyGoalsRef.current.clear();
      if (process.env.NODE_ENV !== 'production') console.debug('🧹 Goal tracking: Cleared all changes');
    }
  }, []);

  /**
   * Check if specific goal is dirty (modified by user)
   */
  const isGoalDirty = useCallback((goalId: string): boolean => {
    return dirtyGoalsRef.current.has(goalId);
  }, []);

  /**
   * Get original data for a specific goal
   */
  const getOriginalData = useCallback((goalId: string): unknown => {
    const originalData = originalDataRef.current.get(goalId);
    return originalData ? JSON.parse(originalData) : null;
  }, []);

  return {
    trackGoalLoad,
    trackGoalChange,
    getChangedGoals,
    hasAnyChanges,
    clearChanges,
    isGoalDirty,
    getOriginalData,
  };
}