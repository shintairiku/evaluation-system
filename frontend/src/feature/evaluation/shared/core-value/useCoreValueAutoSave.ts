import { useState, useCallback, useRef, useEffect } from 'react';
import type { SaveStatus } from '../types';

/**
 * Data shape for core value auto-save (identical for evaluation and feedback).
 */
export interface CoreValueSaveData {
  scores?: Record<string, string>;
  comment?: string;
}

/**
 * Server action signature for saving core value data.
 */
type SaveAction = (
  entityId: string,
  data: { scores?: Record<string, string>; comment?: string }
) => Promise<{ success: boolean }>;

/**
 * Function to determine if the entity is editable based on its status.
 */
type EditableCheck = (status: string | undefined) => boolean;

/**
 * Creates a flusher set for a specific domain (evaluation or feedback).
 * Each domain needs its own flusher set so submit buttons can flush the correct saves.
 */
export function createAutoSaveFlusherSet() {
  const flushers = new Set<() => Promise<void>>();
  return {
    flushers,
    flushAll: async () => {
      await Promise.allSettled(Array.from(flushers, (fn) => fn()));
    },
  };
}

// Pre-created flusher sets for each domain
export const coreValueEvaluationFlushers = createAutoSaveFlusherSet();
export const coreValueFeedbackFlushers = createAutoSaveFlusherSet();

interface UseCoreValueAutoSaveOptions {
  entityId?: string;
  initialScores?: Record<string, string> | null;
  initialComment?: string | null;
  initialStatus?: string;
  debounceDelay?: number;
  statusClearTimeout?: number;
  onSaveSuccess?: () => void;
  saveAction: SaveAction;
  isEditableCheck: EditableCheck;
  flusherSet: Set<() => Promise<void>>;
}

interface UseCoreValueAutoSaveReturn {
  saveStatus: SaveStatus;
  lastSavedData: CoreValueSaveData;
  save: (data: CoreValueSaveData) => Promise<void>;
  debouncedSave: (data: CoreValueSaveData) => void;
  isInitialized: boolean;
  isEditable: boolean;
}

/**
 * Generic auto-save hook for core value evaluation and feedback.
 * Parameterized by save action and editable check to eliminate duplication.
 */
export function useCoreValueAutoSave({
  entityId,
  initialScores,
  initialComment,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  onSaveSuccess,
  saveAction,
  isEditableCheck,
  flusherSet,
}: UseCoreValueAutoSaveOptions): UseCoreValueAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const initialData: CoreValueSaveData = {
    scores: initialScores ?? undefined,
    comment: initialComment ?? undefined,
  };
  const [lastSavedData, setLastSavedData] = useState<CoreValueSaveData>({
    ...initialData,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusClearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef<CoreValueSaveData | null>(null);
  const debouncedDataRef = useRef<CoreValueSaveData | null>(null);
  const lastSavedDataRef = useRef<CoreValueSaveData>(initialData);

  const isEditable = isEditableCheck(initialStatus);

  const hasDataChanged = useCallback((data: CoreValueSaveData): boolean => {
    const last = lastSavedDataRef.current;
    const scoresChanged = JSON.stringify(data.scores) !== JSON.stringify(last.scores);
    const commentChanged = data.comment?.trim() !== last.comment?.trim();
    return scoresChanged || commentChanged;
  }, []);

  const save = useCallback(async (data: CoreValueSaveData) => {
    if (!entityId || !isEditable) {
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
          const result = await saveAction(entityId, {
            scores: nextData.scores,
            comment: nextData.comment,
          });

          if (result.success) {
            const normalizedData: CoreValueSaveData = {
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
  }, [entityId, isEditable, hasDataChanged, statusClearTimeout, onSaveSuccess, saveAction]);

  const debouncedSave = useCallback((data: CoreValueSaveData) => {
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

  const saveQueuedDataWithoutState = useCallback(async (data: CoreValueSaveData) => {
    if (!entityId || !isEditable) {
      return;
    }

    if (!hasDataChanged(data)) {
      return;
    }

    try {
      await saveAction(entityId, {
        scores: data.scores,
        comment: data.comment,
      });
    } catch {
      // Best-effort save during unmount
    }
  }, [entityId, isEditable, hasDataChanged, saveAction]);

  // Initialize with server data
  useEffect(() => {
    if (entityId && !isInitialized) {
      const data = {
        scores: initialScores ?? undefined,
        comment: initialComment?.trim() ?? undefined,
      };
      lastSavedDataRef.current = data;
      setLastSavedData(data);
      setIsInitialized(true);
    }
  }, [entityId, initialScores, initialComment, isInitialized]);

  // Reset when entity ID changes
  useEffect(() => {
    setIsInitialized(false);
    setSaveStatus('idle');
    pendingSaveRef.current = null;
    debouncedDataRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [entityId]);

  // Register/unregister flush function for global flush before submit
  useEffect(() => {
    flusherSet.add(flushPendingSave);
    return () => {
      flusherSet.delete(flushPendingSave);
    };
  }, [flushPendingSave, flusherSet]);

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
