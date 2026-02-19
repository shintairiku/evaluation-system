import { useState, useCallback, useRef, useEffect } from 'react';
import {
  createSupervisorFeedbackAction,
  getSupervisorFeedbacksByAssessmentAction,
  updateSupervisorFeedbackAction,
} from '@/api/server-actions/supervisor-feedbacks';
import type { RatingCode, SupervisorFeedbackStatus, CompetencyRatingData, UUID } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Data to save for a supervisor feedback
 */
export interface SupervisorFeedbackSaveData {
  supervisorRatingCode?: RatingCode | null;
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
  /** Self-assessment ID used to auto-create feedback if missing */
  selfAssessmentId?: string;
  /** Period ID used to auto-create feedback if missing */
  periodId?: string;
  /** Initial rating code (from server) */
  initialRatingCode?: RatingCode | null;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function findFeedbackByAssessmentWithRetry(
  selfAssessmentId: UUID,
  retryDelays: number[] = [0]
): Promise<string | undefined> {
  for (const delay of retryDelays) {
    if (delay > 0) {
      await sleep(delay);
    }

    const existingResult = await getSupervisorFeedbacksByAssessmentAction(selfAssessmentId);
    if (existingResult.success && existingResult.data?.id) {
      return existingResult.data.id;
    }
  }

  return undefined;
}

/**
 * Custom hook to handle auto-save functionality for supervisor feedback ratings and comments.
 *
 * Features:
 * - Debounced auto-save (2 seconds default)
 * - Manual save on blur
 * - Visual save status indicators
 * - Only editable when status is not 'submitted'
 *
 * @param options - Configuration options
 * @returns Object containing save functions and status
 */
export function useSupervisorFeedbackAutoSave({
  feedbackId,
  selfAssessmentId,
  periodId,
  initialRatingCode,
  initialComment,
  initialRatingData,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  onSaveSuccess
}: UseSupervisorFeedbackAutoSaveOptions): UseSupervisorFeedbackAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | undefined>(feedbackId);
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
  const ensuringFeedbackRef = useRef<Promise<string | undefined> | null>(null);

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

  const ensureFeedbackId = useCallback(async (): Promise<string | undefined> => {
    if (activeFeedbackId) {
      return activeFeedbackId;
    }

    if (!selfAssessmentId || !periodId) {
      return undefined;
    }

    if (ensuringFeedbackRef.current) {
      return ensuringFeedbackRef.current;
    }

    ensuringFeedbackRef.current = (async () => {
      const existingId = await findFeedbackByAssessmentWithRetry(
        selfAssessmentId as UUID
      );
      if (existingId) {
        setActiveFeedbackId(existingId);
        return existingId;
      }

      const createResult = await createSupervisorFeedbackAction({
        selfAssessmentId: selfAssessmentId as UUID,
        periodId: periodId as UUID,
        action: 'PENDING',
        status: 'draft',
      });

      if (createResult.success && createResult.data) {
        const createdId = createResult.data.id;
        setActiveFeedbackId(createdId);
        return createdId;
      }

      const recoveredId = await findFeedbackByAssessmentWithRetry(
        selfAssessmentId as UUID,
        [150, 300, 600]
      );
      if (recoveredId) {
        setActiveFeedbackId(recoveredId);
      }

      return recoveredId;
    })()
      .finally(() => {
        ensuringFeedbackRef.current = null;
      });

    return ensuringFeedbackRef.current;
  }, [activeFeedbackId, selfAssessmentId, periodId]);

  /**
   * Core save function - saves rating and comment to supervisor feedback
   */
  const save = useCallback(async (data: SupervisorFeedbackSaveData) => {
    if (!isEditable) {
      return;
    }

    let resolvedFeedbackId = activeFeedbackId;
    if (!resolvedFeedbackId) {
      resolvedFeedbackId = await ensureFeedbackId();
    }
    if (!resolvedFeedbackId) {
      updateSaveStatus('error');
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
          const result = await updateSupervisorFeedbackAction(resolvedFeedbackId as UUID, {
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
  }, [
    isEditable,
    activeFeedbackId,
    ensureFeedbackId,
    hasDataChanged,
    statusClearTimeout,
    onSaveSuccess,
    updateSaveStatus,
  ]);

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
        void save(queuedData).catch(() => {});
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

    if (saveStatusRef.current === 'error') {
      throw new Error('Supervisor feedback auto-save failed');
    }
  }, [save]);

  const saveQueuedDataWithoutState = useCallback(async (data: SupervisorFeedbackSaveData) => {
    if (!isEditable) {
      return;
    }

    if (!hasDataChanged(data)) {
      return;
    }

    let resolvedFeedbackId = activeFeedbackId || feedbackId;

    if (!resolvedFeedbackId) {
      if (!selfAssessmentId || !periodId) {
        return;
      }

      const existingId = await findFeedbackByAssessmentWithRetry(
        selfAssessmentId as UUID
      );
      if (existingId) {
        resolvedFeedbackId = existingId;
      } else {
        const createResult = await createSupervisorFeedbackAction({
          selfAssessmentId: selfAssessmentId as UUID,
          periodId: periodId as UUID,
          action: 'PENDING',
          status: 'draft',
        });

        if (createResult.success && createResult.data) {
          resolvedFeedbackId = createResult.data.id;
        } else {
          resolvedFeedbackId = await findFeedbackByAssessmentWithRetry(
            selfAssessmentId as UUID,
            [150, 300, 600]
          );
        }
      }
    }

    if (!resolvedFeedbackId) {
      return;
    }

    try {
      await updateSupervisorFeedbackAction(resolvedFeedbackId as UUID, {
        supervisorRatingCode: data.supervisorRatingCode,
        supervisorComment: data.supervisorComment,
        ratingData: data.ratingData,
      });
    } catch {
      // Best-effort save during unmount; ignore failures here.
    }
  }, [activeFeedbackId, feedbackId, hasDataChanged, isEditable, periodId, selfAssessmentId]);

  /**
   * Initialize with server data
   */
  useEffect(() => {
    setActiveFeedbackId(feedbackId);
  }, [feedbackId]);

  useEffect(() => {
    if (activeFeedbackId && !isInitialized) {
      const data = {
        supervisorRatingCode: initialRatingCode,
        supervisorComment: initialComment?.trim(),
        ratingData: initialRatingData
      };
      lastSavedDataRef.current = data;
      setLastSavedData(data);
      setIsInitialized(true);
    }
  }, [activeFeedbackId, initialRatingCode, initialComment, initialRatingData, isInitialized]);

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
    ensuringFeedbackRef.current = null;
  }, [feedbackId, updateSaveStatus]);

  useEffect(() => {
    supervisorFeedbackSaveFlushers.add(flushPendingSave);
    return () => {
      supervisorFeedbackSaveFlushers.delete(flushPendingSave);
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
