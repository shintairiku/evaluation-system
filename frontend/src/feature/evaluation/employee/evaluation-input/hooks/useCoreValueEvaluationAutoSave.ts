import { useState, useCallback, useRef, useEffect } from 'react';
import { updateCoreValueEvaluationAction } from '@/api/server-actions/core-values';
import type { CoreValueEvaluationStatus } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Data to save for a core value evaluation
 */
export interface CoreValueEvaluationSaveData {
  scores?: Record<string, string>;
  comment?: string;
}

/**
 * Options for the useCoreValueEvaluationAutoSave hook
 */
interface UseCoreValueEvaluationAutoSaveOptions {
  evaluationId?: string;
  initialScores?: Record<string, string> | null;
  initialComment?: string | null;
  initialStatus?: CoreValueEvaluationStatus;
  debounceDelay?: number;
  statusClearTimeout?: number;
  onSaveSuccess?: () => void;
}

/**
 * Return type for useCoreValueEvaluationAutoSave hook
 */
interface UseCoreValueEvaluationAutoSaveReturn {
  saveStatus: SaveStatus;
  lastSavedData: CoreValueEvaluationSaveData;
  save: (data: CoreValueEvaluationSaveData) => Promise<void>;
  debouncedSave: (data: CoreValueEvaluationSaveData) => void;
  isInitialized: boolean;
  isEditable: boolean;
}

const coreValueEvaluationSaveFlushers = new Set<() => Promise<void>>();

export async function flushCoreValueEvaluationAutoSaves(): Promise<void> {
  await Promise.allSettled(
    Array.from(coreValueEvaluationSaveFlushers, (flush) => flush())
  );
}

/**
 * Custom hook to handle auto-save functionality for core value evaluation scores and comment.
 * Follows the same pattern as useSelfAssessmentAutoSave.
 */
export function useCoreValueEvaluationAutoSave({
  evaluationId,
  initialScores,
  initialComment,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  onSaveSuccess,
}: UseCoreValueEvaluationAutoSaveOptions): UseCoreValueEvaluationAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const initialData: CoreValueEvaluationSaveData = {
    scores: initialScores ?? undefined,
    comment: initialComment ?? undefined,
  };
  const [lastSavedData, setLastSavedData] = useState<CoreValueEvaluationSaveData>({
    ...initialData,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusClearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef<CoreValueEvaluationSaveData | null>(null);
  const debouncedDataRef = useRef<CoreValueEvaluationSaveData | null>(null);
  const lastSavedDataRef = useRef<CoreValueEvaluationSaveData>(initialData);

  const isEditable = initialStatus === 'draft';

  const hasDataChanged = useCallback((data: CoreValueEvaluationSaveData): boolean => {
    const last = lastSavedDataRef.current;
    const scoresChanged = JSON.stringify(data.scores) !== JSON.stringify(last.scores);
    const commentChanged = data.comment?.trim() !== last.comment?.trim();
    return scoresChanged || commentChanged;
  }, []);

  const save = useCallback(async (data: CoreValueEvaluationSaveData) => {
    if (!evaluationId || !isEditable) {
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
          const result = await updateCoreValueEvaluationAction(evaluationId, {
            scores: nextData.scores,
            comment: nextData.comment,
          });

          if (result.success) {
            const normalizedData: CoreValueEvaluationSaveData = {
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
  }, [evaluationId, isEditable, hasDataChanged, statusClearTimeout, onSaveSuccess]);

  const debouncedSave = useCallback((data: CoreValueEvaluationSaveData) => {
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

  const saveQueuedDataWithoutState = useCallback(async (data: CoreValueEvaluationSaveData) => {
    if (!evaluationId || !isEditable) {
      return;
    }

    if (!hasDataChanged(data)) {
      return;
    }

    try {
      await updateCoreValueEvaluationAction(evaluationId, {
        scores: data.scores,
        comment: data.comment,
      });
    } catch {
      // Best-effort save during unmount
    }
  }, [evaluationId, isEditable, hasDataChanged]);

  // Initialize with server data
  useEffect(() => {
    if (evaluationId && !isInitialized) {
      const data = {
        scores: initialScores ?? undefined,
        comment: initialComment?.trim() ?? undefined,
      };
      lastSavedDataRef.current = data;
      setLastSavedData(data);
      setIsInitialized(true);
    }
  }, [evaluationId, initialScores, initialComment, isInitialized]);

  // Reset when evaluation ID changes
  useEffect(() => {
    setIsInitialized(false);
    setSaveStatus('idle');
    pendingSaveRef.current = null;
    debouncedDataRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [evaluationId]);

  // Register/unregister flush function for global flush before submit
  useEffect(() => {
    coreValueEvaluationSaveFlushers.add(flushPendingSave);
    return () => {
      coreValueEvaluationSaveFlushers.delete(flushPendingSave);
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
