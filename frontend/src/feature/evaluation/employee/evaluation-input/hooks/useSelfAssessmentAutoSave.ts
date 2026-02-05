import { useState, useCallback, useRef, useEffect } from 'react';
import { updateSelfAssessmentAction } from '@/api/server-actions/self-assessments';
import type { RatingCode, SelfAssessmentStatus, CompetencyRatingData } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Data to save for a self-assessment
 */
export interface SelfAssessmentSaveData {
  selfRatingCode?: RatingCode;
  selfComment?: string;
  /** Per-action ratings for competency goals */
  ratingData?: CompetencyRatingData;
}

/**
 * Options for the useSelfAssessmentAutoSave hook
 */
interface UseSelfAssessmentAutoSaveOptions {
  /** Self-assessment ID to auto-save to */
  assessmentId?: string;
  /** Initial rating code (from server) */
  initialRatingCode?: RatingCode;
  /** Initial comment (from server) */
  initialComment?: string;
  /** Initial per-action ratings for competency goals (from server) */
  initialRatingData?: CompetencyRatingData;
  /** Initial status - only allow edits if draft */
  initialStatus?: SelfAssessmentStatus;
  /** Debounce delay in milliseconds (default: 2000) */
  debounceDelay?: number;
  /** Status clear timeout in milliseconds (default: 3000) */
  statusClearTimeout?: number;
  /** Callback when save succeeds - use to refresh parent data */
  onSaveSuccess?: () => void;
}

/**
 * Return type for useSelfAssessmentAutoSave hook
 */
interface UseSelfAssessmentAutoSaveReturn {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last successfully saved data */
  lastSavedData: SelfAssessmentSaveData;
  /** Manual save function */
  save: (data: SelfAssessmentSaveData) => Promise<void>;
  /** Debounced save function (use for onChange events) */
  debouncedSave: (data: SelfAssessmentSaveData) => void;
  /** Whether initial data has been loaded */
  isInitialized: boolean;
  /** Whether the assessment is editable (draft status) */
  isEditable: boolean;
}

/**
 * Custom hook to handle auto-save functionality for self-assessment ratings and comments.
 *
 * Features:
 * - Debounced auto-save (2 seconds default)
 * - Manual save on blur
 * - Visual save status indicators
 * - Only editable when status is 'draft'
 * - Save before page unload
 *
 * @param options - Configuration options
 * @returns Object containing save functions and status
 *
 * @example
 * ```tsx
 * const { saveStatus, debouncedSave, save, isEditable } = useSelfAssessmentAutoSave({
 *   assessmentId: assessment.id,
 *   initialRatingCode: assessment.selfRatingCode,
 *   initialComment: assessment.selfComment,
 *   initialStatus: assessment.status
 * });
 *
 * // In rating onChange
 * <RadioGroup onChange={(value) => debouncedSave({ selfRatingCode: value, selfComment })} />
 *
 * // In comment onChange
 * <Textarea onChange={(e) => debouncedSave({ selfRatingCode, selfComment: e.target.value })} />
 *
 * // In comment onBlur
 * <Textarea onBlur={(e) => save({ selfRatingCode, selfComment: e.target.value })} />
 * ```
 */
export function useSelfAssessmentAutoSave({
  assessmentId,
  initialRatingCode,
  initialComment,
  initialRatingData,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  onSaveSuccess
}: UseSelfAssessmentAutoSaveOptions): UseSelfAssessmentAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedData, setLastSavedData] = useState<SelfAssessmentSaveData>({
    selfRatingCode: initialRatingCode,
    selfComment: initialComment,
    ratingData: initialRatingData
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusClearTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if assessment is editable (only draft status)
  const isEditable = initialStatus === 'draft';

  /**
   * Check if data has changed from last saved
   */
  const hasDataChanged = useCallback((data: SelfAssessmentSaveData): boolean => {
    const ratingCodeChanged = data.selfRatingCode !== lastSavedData.selfRatingCode;
    const commentChanged = data.selfComment?.trim() !== lastSavedData.selfComment?.trim();
    const ratingDataChanged = JSON.stringify(data.ratingData) !== JSON.stringify(lastSavedData.ratingData);
    return ratingCodeChanged || commentChanged || ratingDataChanged;
  }, [lastSavedData]);

  /**
   * Core save function - saves rating and comment to self-assessment
   */
  const save = useCallback(async (data: SelfAssessmentSaveData) => {
    if (!assessmentId || !isEditable) {
      return;
    }

    // Don't save if no changes
    if (!hasDataChanged(data)) {
      return;
    }

    // Prevent concurrent saves
    if (saveStatus === 'saving') {
      return;
    }

    setSaveStatus('saving');

    // Clear any pending status clear timer
    if (statusClearTimerRef.current) {
      clearTimeout(statusClearTimerRef.current);
    }

    try {
      const result = await updateSelfAssessmentAction(assessmentId, {
        selfRatingCode: data.selfRatingCode,
        selfComment: data.selfComment,
        ratingData: data.ratingData
      });

      if (result.success) {
        setLastSavedData({
          selfRatingCode: data.selfRatingCode,
          selfComment: data.selfComment?.trim(),
          ratingData: data.ratingData
        });
        setSaveStatus('saved');

        // Notify parent that data was saved (for refreshing validation state)
        onSaveSuccess?.();

        // Clear status after timeout
        statusClearTimerRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, statusClearTimeout);
      } else {
        console.error('Failed to save self-assessment:', result.error);
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving self-assessment:', error);
      setSaveStatus('error');
    }
  }, [assessmentId, isEditable, hasDataChanged, saveStatus, statusClearTimeout, onSaveSuccess]);

  /**
   * Debounced save function - use for onChange events
   */
  const debouncedSave = useCallback((data: SelfAssessmentSaveData) => {
    if (!isEditable) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      save(data);
    }, debounceDelay);
  }, [save, debounceDelay, isEditable]);

  /**
   * Initialize with server data
   */
  useEffect(() => {
    if (assessmentId && !isInitialized) {
      setLastSavedData({
        selfRatingCode: initialRatingCode,
        selfComment: initialComment?.trim(),
        ratingData: initialRatingData
      });
      setIsInitialized(true);
    }
  }, [assessmentId, initialRatingCode, initialComment, initialRatingData, isInitialized]);

  /**
   * Reset when assessment ID changes
   */
  useEffect(() => {
    setIsInitialized(false);
    setSaveStatus('idle');
  }, [assessmentId]);

  /**
   * Cleanup timers on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (statusClearTimerRef.current) {
        clearTimeout(statusClearTimerRef.current);
      }
    };
  }, []);

  return {
    saveStatus,
    lastSavedData,
    save,
    debouncedSave,
    isInitialized,
    isEditable
  };
}
