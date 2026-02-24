import { useState, useCallback, useRef, useEffect } from 'react';
import { updateSupervisorFeedbackAction } from '@/api/server-actions/supervisor-feedbacks';
import type { RatingCode, SupervisorFeedbackStatus, CompetencyRatingData } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Data to save for a supervisor feedback
 */
export interface SupervisorFeedbackSaveData {
  supervisorRatingCode?: RatingCode;
  supervisorComment?: string;
  /** Per-action ratings for competency goals */
  ratingData?: CompetencyRatingData;
}

/**
 * Options for the useSupervisorFeedbackAutoSave hook
 */
interface UseSupervisorFeedbackAutoSaveOptions {
  /** Supervisor feedback ID to auto-save to */
  feedbackId?: string;
  /** Initial rating code (from server) */
  initialRatingCode?: RatingCode;
  /** Initial comment (from server) */
  initialComment?: string;
  /** Initial per-action ratings for competency goals (from server) */
  initialRatingData?: CompetencyRatingData;
  /** Initial status - only allow edits if not submitted */
  initialStatus?: SupervisorFeedbackStatus;
  /** Debounce delay in milliseconds (default: 2000) */
  debounceDelay?: number;
  /** Status clear timeout in milliseconds (default: 3000) */
  statusClearTimeout?: number;
  /** Callback when save succeeds - use to refresh parent data */
  onSaveSuccess?: () => void;
}

/**
 * Return type for useSupervisorFeedbackAutoSave hook
 */
interface UseSupervisorFeedbackAutoSaveReturn {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last successfully saved data */
  lastSavedData: SupervisorFeedbackSaveData;
  /** Manual save function */
  save: (data: SupervisorFeedbackSaveData) => Promise<void>;
  /** Debounced save function (use for onChange events) */
  debouncedSave: (data: SupervisorFeedbackSaveData) => void;
  /** Whether initial data has been loaded */
  isInitialized: boolean;
  /** Whether the feedback is editable (not submitted) */
  isEditable: boolean;
}

const supervisorFeedbackSaveFlushers = new Set<() => Promise<void>>();

export async function flushSupervisorFeedbackAutoSaves(): Promise<void> {
  const results = await Promise.allSettled(
    Array.from(supervisorFeedbackSaveFlushers, (flush) => flush())
  );

  const failedFlushes = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failedFlushes.length > 0) {
    throw new Error('Failed to flush supervisor feedback auto-saves');
  }
}

/**
 * Custom hook to handle auto-save functionality for supervisor feedback ratings and comments.
 *
 * Features:
 * - Debounced auto-save (2 seconds default)
 * - Manual save on blur
 * - Visual save status indicators
 * - Only editable when status is not 'submitted'
 * - Save queue to prevent race conditions
 * - Flush pending saves before submit
 *
 * @param options - Configuration options
 * @returns Object containing save functions and status
 */
export function useSupervisorFeedbackAutoSave({
  feedbackId,
  initialRatingCode,
  initialComment,
  initialRatingData,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  onSaveSuccess
}: UseSupervisorFeedbackAutoSaveOptions): UseSupervisorFeedbackAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const initialData: SupervisorFeedbackSaveData = {
    supervisorRatingCode: initialRatingCode,
    supervisorComment: initialComment,
    ratingData: initialRatingData
  };
  const [lastSavedData, setLastSavedData] = useState<SupervisorFeedbackSaveData>({
    ...initialData
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusClearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef<SupervisorFeedbackSaveData | null>(null);
  const debouncedDataRef = useRef<SupervisorFeedbackSaveData | null>(null);
  const lastSavedDataRef = useRef<SupervisorFeedbackSaveData>(initialData);
  const saveStatusRef = useRef<SaveStatus>('idle');

  // Determine if feedback is editable (incomplete or draft, not submitted)
  const isEditable = initialStatus !== 'submitted';

  /**
   * Check if data has changed from last saved
   */
  const hasDataChanged = useCallback((data: SupervisorFeedbackSaveData): boolean => {
    const last = lastSavedDataRef.current;
    const ratingCodeChanged = data.supervisorRatingCode !== last.supervisorRatingCode;
    const commentChanged = data.supervisorComment?.trim() !== last.supervisorComment?.trim();
    const ratingDataChanged = JSON.stringify(data.ratingData) !== JSON.stringify(last.ratingData);
    return ratingCodeChanged || commentChanged || ratingDataChanged;
  }, []);

  const updateSaveStatus = useCallback((status: SaveStatus) => {
    saveStatusRef.current = status;
    setSaveStatus(status);
  }, []);

  /**
   * Core save function - saves rating and comment to supervisor feedback.
   * Uses a save queue loop to prevent race conditions.
   */
  const save = useCallback(async (data: SupervisorFeedbackSaveData) => {
    if (!feedbackId || !isEditable) {
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

        updateSaveStatus('saving');

        if (statusClearTimerRef.current) {
          clearTimeout(statusClearTimerRef.current);
        }

        try {
          const result = await updateSupervisorFeedbackAction(feedbackId, {
            supervisorRatingCode: nextData.supervisorRatingCode,
            supervisorComment: nextData.supervisorComment,
            ratingData: nextData.ratingData,
          });

          if (result.success) {
            const normalizedData: SupervisorFeedbackSaveData = {
              supervisorRatingCode: nextData.supervisorRatingCode,
              supervisorComment: nextData.supervisorComment?.trim(),
              ratingData: nextData.ratingData
            };
            lastSavedDataRef.current = normalizedData;
            setLastSavedData(normalizedData);
            updateSaveStatus('saved');
            onSaveSuccess?.();

            statusClearTimerRef.current = setTimeout(() => {
              updateSaveStatus('idle');
            }, statusClearTimeout);
          } else {
            updateSaveStatus('error');
          }
        } catch {
          updateSaveStatus('error');
        }
      }
    };

    inFlightSaveRef.current = runSaveLoop().finally(() => {
      inFlightSaveRef.current = null;
    });

    await inFlightSaveRef.current;
  }, [feedbackId, isEditable, hasDataChanged, statusClearTimeout, onSaveSuccess, updateSaveStatus]);

  /**
   * Debounced save function - use for onChange events
   */
  const debouncedSave = useCallback((data: SupervisorFeedbackSaveData) => {
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

  /**
   * Flush any pending debounced save and wait for in-flight saves to complete.
   * Throws if the last save status was an error.
   */
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

    if (saveStatusRef.current === 'error') {
      throw new Error('Supervisor feedback auto-save failed');
    }
  }, [save]);

  /**
   * Best-effort save during unmount — fires without updating React state.
   */
  const saveQueuedDataWithoutState = useCallback(async (data: SupervisorFeedbackSaveData) => {
    if (!feedbackId || !isEditable) {
      return;
    }

    if (!hasDataChanged(data)) {
      return;
    }

    try {
      await updateSupervisorFeedbackAction(feedbackId, {
        supervisorRatingCode: data.supervisorRatingCode,
        supervisorComment: data.supervisorComment,
        ratingData: data.ratingData,
      });
    } catch {
      // Best-effort save during unmount; ignore failures here.
    }
  }, [feedbackId, isEditable, hasDataChanged]);

  /**
   * Initialize with server data
   */
  useEffect(() => {
    if (feedbackId && !isInitialized) {
      const data = {
        supervisorRatingCode: initialRatingCode,
        supervisorComment: initialComment?.trim(),
        ratingData: initialRatingData
      };
      lastSavedDataRef.current = data;
      setLastSavedData(data);
      setIsInitialized(true);
    }
  }, [feedbackId, initialRatingCode, initialComment, initialRatingData, isInitialized]);

  /**
   * Reset when feedback ID changes
   */
  useEffect(() => {
    setIsInitialized(false);
    updateSaveStatus('idle');
    pendingSaveRef.current = null;
    debouncedDataRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [feedbackId, updateSaveStatus]);

  /**
   * Register/unregister flush function for global flush before submit
   */
  useEffect(() => {
    supervisorFeedbackSaveFlushers.add(flushPendingSave);
    return () => {
      supervisorFeedbackSaveFlushers.delete(flushPendingSave);
    };
  }, [flushPendingSave]);

  /**
   * Cleanup timers on unmount + best-effort save of queued data
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
