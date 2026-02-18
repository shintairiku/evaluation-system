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
  /** Initial status - allow edits until supervisor approval */
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
  /** Whether the assessment is editable (existing record and not approved) */
  isEditable: boolean;
}

const selfAssessmentSaveFlushers = new Set<() => Promise<void>>();

export async function flushSelfAssessmentAutoSaves(): Promise<void> {
  await Promise.allSettled(
    Array.from(selfAssessmentSaveFlushers, (flush) => flush())
  );
}

/**
 * Custom hook to handle auto-save functionality for self-assessment ratings and comments.
 *
 * Features:
 * - Debounced auto-save (2 seconds default)
 * - Manual save on blur
 * - Visual save status indicators
 * - Editable while status is 'draft' or 'submitted' (locked only when 'approved')
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
  const initialData: SelfAssessmentSaveData = {
    selfRatingCode: initialRatingCode,
    selfComment: initialComment,
    ratingData: initialRatingData
  };
  const [lastSavedData, setLastSavedData] = useState<SelfAssessmentSaveData>({
    ...initialData
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusClearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef<SelfAssessmentSaveData | null>(null);
  const debouncedDataRef = useRef<SelfAssessmentSaveData | null>(null);
  const lastSavedDataRef = useRef<SelfAssessmentSaveData>(initialData);

  // Keep assessments editable until supervisor approval.
  const isEditable = Boolean(assessmentId) && initialStatus !== 'approved';

  /**
   * Check if data has changed from last saved
   */
  const hasDataChanged = useCallback((data: SelfAssessmentSaveData): boolean => {
    const last = lastSavedDataRef.current;
    const ratingCodeChanged = data.selfRatingCode !== last.selfRatingCode;
    const commentChanged = data.selfComment?.trim() !== last.selfComment?.trim();
    const ratingDataChanged = JSON.stringify(data.ratingData) !== JSON.stringify(last.ratingData);
    return ratingCodeChanged || commentChanged || ratingDataChanged;
  }, []);

  /**
   * Core save function - saves rating and comment to self-assessment
   */
  const save = useCallback(async (data: SelfAssessmentSaveData) => {
    if (!assessmentId || !isEditable) {
      return;
    }

    pendingSaveRef.current = data;

    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
      return;
    }

    const runSaveLoop = async () => {
      while (pendingSaveRef.current) {
        const nextData = pendingSaveRef.current;
        pendingSaveRef.current = null;

        if (!hasDataChanged(nextData)) {
          continue;
        }

        setSaveStatus('saving');

        if (statusClearTimerRef.current) {
          clearTimeout(statusClearTimerRef.current);
        }

        try {
          const result = await updateSelfAssessmentAction(assessmentId, {
            selfRatingCode: nextData.selfRatingCode,
            selfComment: nextData.selfComment,
            ratingData: nextData.ratingData
          });

          if (result.success) {
            const normalizedData: SelfAssessmentSaveData = {
              selfRatingCode: nextData.selfRatingCode,
              selfComment: nextData.selfComment?.trim(),
              ratingData: nextData.ratingData
            };
            lastSavedDataRef.current = normalizedData;
            setLastSavedData(normalizedData);
            setSaveStatus('saved');
            onSaveSuccess?.();

            statusClearTimerRef.current = setTimeout(() => {
              setSaveStatus('idle');
            }, statusClearTimeout);
          } else {
            setSaveStatus('error');
          }
        } catch {
          setSaveStatus('error');
        }
      }
    };

    inFlightSaveRef.current = runSaveLoop().finally(() => {
      inFlightSaveRef.current = null;
    });

    await inFlightSaveRef.current;
  }, [assessmentId, isEditable, hasDataChanged, statusClearTimeout, onSaveSuccess]);

  /**
   * Debounced save function - use for onChange events
   */
  const debouncedSave = useCallback((data: SelfAssessmentSaveData) => {
    if (!isEditable) return;

    debouncedDataRef.current = data;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      const queuedData = debouncedDataRef.current;
      debouncedDataRef.current = null;
      debounceTimerRef.current = null;
      if (queuedData) {
        void save(queuedData);
      }
    }, debounceDelay);
  }, [save, debounceDelay, isEditable]);

  const flushPendingSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const queuedData = debouncedDataRef.current;
    debouncedDataRef.current = null;

    if (queuedData) {
      await save(queuedData);
    }

    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
  }, [save]);

  const saveQueuedDataWithoutState = useCallback(async (data: SelfAssessmentSaveData) => {
    if (!assessmentId || !isEditable) {
      return;
    }

    if (!hasDataChanged(data)) {
      return;
    }

    try {
      await updateSelfAssessmentAction(assessmentId, {
        selfRatingCode: data.selfRatingCode,
        selfComment: data.selfComment,
        ratingData: data.ratingData,
      });
    } catch {
      // Best-effort save during unmount; ignore failures here.
    }
  }, [assessmentId, isEditable, hasDataChanged]);

  /**
   * Initialize with server data
   */
  useEffect(() => {
    if (assessmentId && !isInitialized) {
      const data = {
        selfRatingCode: initialRatingCode,
        selfComment: initialComment?.trim(),
        ratingData: initialRatingData
      };
      lastSavedDataRef.current = data;
      setLastSavedData(data);
      setIsInitialized(true);
    }
  }, [assessmentId, initialRatingCode, initialComment, initialRatingData, isInitialized]);

  /**
   * Reset when assessment ID changes
   */
  useEffect(() => {
    setIsInitialized(false);
    setSaveStatus('idle');
    pendingSaveRef.current = null;
    debouncedDataRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [assessmentId]);

  useEffect(() => {
    selfAssessmentSaveFlushers.add(flushPendingSave);
    return () => {
      selfAssessmentSaveFlushers.delete(flushPendingSave);
    };
  }, [flushPendingSave]);

  /**
   * Cleanup timers on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const queuedData = debouncedDataRef.current;
      debouncedDataRef.current = null;
      if (queuedData) {
        void saveQueuedDataWithoutState(queuedData);
      }
      if (statusClearTimerRef.current) {
        clearTimeout(statusClearTimerRef.current);
        statusClearTimerRef.current = null;
      }
    };
  }, [saveQueuedDataWithoutState]);

  return {
    saveStatus,
    lastSavedData,
    save,
    debouncedSave,
    isInitialized,
    isEditable
  };
}
