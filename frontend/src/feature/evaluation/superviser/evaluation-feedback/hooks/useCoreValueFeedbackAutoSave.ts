import { useState, useCallback, useRef, useEffect } from 'react';
import { updateCoreValueFeedbackAction } from '@/api/server-actions/core-values';
import type { CoreValueFeedbackStatus } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Data to save for core value feedback
 */
export interface CoreValueFeedbackSaveData {
  scores?: Record<string, string>;
  comment?: string;
}

/**
 * Options for the useCoreValueFeedbackAutoSave hook
 */
interface UseCoreValueFeedbackAutoSaveOptions {
  feedbackId?: string;
  initialScores?: Record<string, string> | null;
  initialComment?: string | null;
  initialStatus?: CoreValueFeedbackStatus;
  debounceDelay?: number;
  statusClearTimeout?: number;
  onSaveSuccess?: () => void;
}

/**
 * Return type for useCoreValueFeedbackAutoSave hook
 */
interface UseCoreValueFeedbackAutoSaveReturn {
  saveStatus: SaveStatus;
  lastSavedData: CoreValueFeedbackSaveData;
  save: (data: CoreValueFeedbackSaveData) => Promise<void>;
  debouncedSave: (data: CoreValueFeedbackSaveData) => void;
  isInitialized: boolean;
  isEditable: boolean;
}

const coreValueFeedbackSaveFlushers = new Set<() => Promise<void>>();

export async function flushCoreValueFeedbackAutoSaves(): Promise<void> {
  await Promise.allSettled(
    Array.from(coreValueFeedbackSaveFlushers, (flush) => flush())
  );
}

/**
 * Custom hook to handle auto-save functionality for core value feedback scores and comment.
 * Follows the same pattern as useSupervisorFeedbackAutoSave.
 */
export function useCoreValueFeedbackAutoSave({
  feedbackId,
  initialScores,
  initialComment,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  onSaveSuccess,
}: UseCoreValueFeedbackAutoSaveOptions): UseCoreValueFeedbackAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const initialData: CoreValueFeedbackSaveData = {
    scores: initialScores ?? undefined,
    comment: initialComment ?? undefined,
  };
  const [lastSavedData, setLastSavedData] = useState<CoreValueFeedbackSaveData>({
    ...initialData,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusClearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef<CoreValueFeedbackSaveData | null>(null);
  const debouncedDataRef = useRef<CoreValueFeedbackSaveData | null>(null);
  const lastSavedDataRef = useRef<CoreValueFeedbackSaveData>(initialData);

  // Editable when not submitted
  const isEditable = initialStatus !== 'submitted';

  const hasDataChanged = useCallback((data: CoreValueFeedbackSaveData): boolean => {
    const last = lastSavedDataRef.current;
    const scoresChanged = JSON.stringify(data.scores) !== JSON.stringify(last.scores);
    const commentChanged = data.comment?.trim() !== last.comment?.trim();
    return scoresChanged || commentChanged;
  }, []);

  const save = useCallback(async (data: CoreValueFeedbackSaveData) => {
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

        setSaveStatus('saving');

        if (statusClearTimerRef.current) {
          clearTimeout(statusClearTimerRef.current);
        }

        try {
          const result = await updateCoreValueFeedbackAction(feedbackId, {
            scores: nextData.scores,
            comment: nextData.comment,
          });

          if (result.success) {
            const normalizedData: CoreValueFeedbackSaveData = {
              scores: nextData.scores,
              comment: nextData.comment?.trim(),
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
  }, [feedbackId, isEditable, hasDataChanged, statusClearTimeout, onSaveSuccess]);

  const debouncedSave = useCallback((data: CoreValueFeedbackSaveData) => {
    if (!isEditable) return;

    debouncedDataRef.current = data;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

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

  const saveQueuedDataWithoutState = useCallback(async (data: CoreValueFeedbackSaveData) => {
    if (!feedbackId || !isEditable) {
      return;
    }

    if (!hasDataChanged(data)) {
      return;
    }

    try {
      await updateCoreValueFeedbackAction(feedbackId, {
        scores: data.scores,
        comment: data.comment,
      });
    } catch {
      // Best-effort save during unmount
    }
  }, [feedbackId, isEditable, hasDataChanged]);

  // Initialize with server data
  useEffect(() => {
    if (feedbackId && !isInitialized) {
      const data = {
        scores: initialScores ?? undefined,
        comment: initialComment?.trim() ?? undefined,
      };
      lastSavedDataRef.current = data;
      setLastSavedData(data);
      setIsInitialized(true);
    }
  }, [feedbackId, initialScores, initialComment, isInitialized]);

  // Reset when feedback ID changes
  useEffect(() => {
    setIsInitialized(false);
    setSaveStatus('idle');
    pendingSaveRef.current = null;
    debouncedDataRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [feedbackId]);

  // Register/unregister flush function for global flush before submit
  useEffect(() => {
    coreValueFeedbackSaveFlushers.add(flushPendingSave);
    return () => {
      coreValueFeedbackSaveFlushers.delete(flushPendingSave);
    };
  }, [flushPendingSave]);

  // Cleanup timers on unmount + best-effort save of queued data
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
    isEditable,
  };
}
