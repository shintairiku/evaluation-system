import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { updateGoalAction, getGoalByIdAction } from '@/api/server-actions/goals';
import type { UUID, GoalUpdateRequest } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Options for the useGoalAutoSave hook
 */
interface UseGoalAutoSaveOptions {
  /** Goal ID to auto-save to */
  goalId?: UUID;
  /** Debounce delay in milliseconds (default: 2000) */
  debounceDelay?: number;
  /** Status clear timeout in milliseconds (default: 3000) */
  statusClearTimeout?: number;
  /** Callback to get current form data */
  getFormData: () => GoalUpdateRequest;
  /** Callback to set form data (for loading drafts) */
  setFormData: (data: Partial<GoalUpdateRequest>) => void;
}

/**
 * Return type for useGoalAutoSave hook
 */
interface UseGoalAutoSaveReturn {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last successfully saved data */
  lastSavedData: GoalUpdateRequest | null;
  /** Manual save function */
  save: (formData: GoalUpdateRequest) => Promise<void>;
  /** Debounced save function (use for onChange events) */
  debouncedSave: (formData: GoalUpdateRequest) => void;
  /** Whether draft has been loaded */
  isDraftLoaded: boolean;
}

/**
 * Custom hook to handle auto-save functionality for goal editing.
 *
 * Features:
 * - Debounced auto-save (2 seconds default)
 * - Manual save on blur
 * - Load existing draft on mount
 * - Save before page unload
 * - Visual save status indicators
 *
 * @param options - Configuration options
 * @returns Object containing save functions and status
 *
 * @example
 * ```tsx
 * const { saveStatus, debouncedSave, save } = useGoalAutoSave({
 *   goalId: '123',
 *   getFormData: () => ({ title: 'example', ... }),
 *   setFormData: (data) => setPerformanceFormData(prev => ({ ...prev, ...data }))
 * });
 *
 * // In form onChange
 * <input onChange={(e) => {
 *   setFormData({ ...formData, title: e.target.value });
 *   debouncedSave({ ...formData, title: e.target.value });
 * }} />
 *
 * // In form onBlur
 * <input onBlur={() => save(getFormData())} />
 * ```
 */
export function useGoalAutoSave({
  goalId,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  getFormData,
  setFormData
}: UseGoalAutoSaveOptions): UseGoalAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedData, setLastSavedData] = useState<GoalUpdateRequest | null>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check if form data has changed since last save
   */
  const hasFormDataChanged = useCallback((currentData: GoalUpdateRequest): boolean => {
    if (!lastSavedData) return true;

    // Compare all fields
    return JSON.stringify(currentData) !== JSON.stringify(lastSavedData);
  }, [lastSavedData]);

  /**
   * Core save function - saves goal data as draft
   */
  const save = useCallback(async (formData: GoalUpdateRequest) => {
    if (!goalId) {
      return; // Don't save if no goalId
    }

    // Check if data has changed
    if (!hasFormDataChanged(formData)) {
      return; // Don't save if unchanged
    }

    if (saveStatus === 'saving') {
      return; // Prevent concurrent saves
    }

    setSaveStatus('saving');

    try {
      const result = await updateGoalAction(goalId, formData);

      if (result.success) {
        setLastSavedData(formData);
        setSaveStatus('saved');

        // Clear status after timeout
        setTimeout(() => setSaveStatus('idle'), statusClearTimeout);
      } else {
        setSaveStatus('error');
        console.error('Auto-save failed:', result.error);
      }
    } catch (error) {
      setSaveStatus('error');
      console.error('Auto-save error:', error);
    }
  }, [goalId, hasFormDataChanged, saveStatus, statusClearTimeout]);

  /**
   * Debounced save function - use for onChange events
   */
  const debouncedSave = useCallback((formData: GoalUpdateRequest) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      save(formData);
    }, debounceDelay);
  }, [save, debounceDelay]);

  /**
   * Load existing draft on mount
   */
  useEffect(() => {
    const loadExistingDraft = async () => {
      if (!goalId || isDraftLoaded) return;

      try {
        const result = await getGoalByIdAction(goalId);

        if (result.success && result.data) {
          const goal = result.data;

          // Only load if status is draft
          if (goal.status === 'draft') {
            // Extract form data based on goal category
            if (goal.goalCategory === '業績目標') {
              const performanceData = {
                title: goal.title,
                specificGoalText: goal.specificGoalText,
                achievementCriteriaText: goal.achievementCriteriaText,
                meansMethodsText: goal.meansMethodsText,
                performanceGoalType: goal.performanceGoalType
              };
              setFormData(performanceData);
              setLastSavedData(performanceData);
            } else if (goal.goalCategory === 'コンピテンシー') {
              const competencyData = {
                actionPlan: goal.actionPlan
              };
              setFormData(competencyData);
              setLastSavedData(competencyData);
            }

            setIsDraftLoaded(true);

            toast.info('下書きが読み込まれました', {
              description: '前回保存した内容が復元されました'
            });
          }
        }
      } catch (error) {
        // Silent fail - draft loading is not critical
        console.error('Failed to load draft:', error);
      }
    };

    loadExistingDraft();
  }, [goalId, isDraftLoaded, setFormData]);

  /**
   * Save before page unload
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentFormData = getFormData();

      if (hasFormDataChanged(currentFormData)) {
        // Try to save synchronously
        save(currentFormData);

        // Show warning if there are unsaved changes
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [getFormData, hasFormDataChanged, save]);

  /**
   * Cleanup debounce timer on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveStatus,
    lastSavedData,
    save,
    debouncedSave,
    isDraftLoaded
  };
}
