import { useState, useCallback, useRef, useEffect } from 'react';
import { updatePeerReviewEvaluationAction } from '@/api/server-actions/peer-reviews';
import type { PeerReviewStatus } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Data to save for a peer review evaluation
 */
export interface PeerReviewSaveData {
  scores?: Record<string, string>;
  comment?: string;
}

interface UsePeerReviewAutoSaveOptions {
  evaluationId?: string;
  initialScores?: Record<string, string> | null;
  initialComment?: string | null;
  initialStatus?: PeerReviewStatus;
  debounceDelay?: number;
  statusClearTimeout?: number;
  onSaveSuccess?: () => void;
}

interface UsePeerReviewAutoSaveReturn {
  saveStatus: SaveStatus;
  lastSavedData: PeerReviewSaveData;
  save: (data: PeerReviewSaveData) => Promise<void>;
  debouncedSave: (data: PeerReviewSaveData) => void;
  isInitialized: boolean;
  isEditable: boolean;
}

const peerReviewSaveFlushers = new Set<() => Promise<void>>();

export async function flushPeerReviewAutoSaves(): Promise<void> {
  await Promise.allSettled(
    Array.from(peerReviewSaveFlushers, (flush) => flush())
  );
}

/**
 * Custom hook to handle auto-save functionality for peer review evaluation scores and comment.
 * Mirrors useCoreValueEvaluationAutoSave, calling updatePeerReviewEvaluationAction.
 */
export function usePeerReviewAutoSave({
  evaluationId,
  initialScores,
  initialComment,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  onSaveSuccess,
}: UsePeerReviewAutoSaveOptions): UsePeerReviewAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const initialData: PeerReviewSaveData = {
    scores: initialScores ?? undefined,
    comment: initialComment ?? undefined,
  };
  const [lastSavedData, setLastSavedData] = useState<PeerReviewSaveData>({
    ...initialData,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusClearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef<PeerReviewSaveData | null>(null);
  const debouncedDataRef = useRef<PeerReviewSaveData | null>(null);
  const lastSavedDataRef = useRef<PeerReviewSaveData>(initialData);

  const isEditable = initialStatus === 'draft';

  const hasDataChanged = useCallback((data: PeerReviewSaveData): boolean => {
    const last = lastSavedDataRef.current;
    const scoresChanged = JSON.stringify(data.scores) !== JSON.stringify(last.scores);
    const commentChanged = data.comment?.trim() !== last.comment?.trim();
    return scoresChanged || commentChanged;
  }, []);

  const save = useCallback(async (data: PeerReviewSaveData) => {
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
          const result = await updatePeerReviewEvaluationAction(evaluationId, {
            scores: nextData.scores,
            comment: nextData.comment,
          });

          if (result.success) {
            const normalizedData: PeerReviewSaveData = {
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

  const debouncedSave = useCallback((data: PeerReviewSaveData) => {
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

  const saveQueuedDataWithoutState = useCallback(async (data: PeerReviewSaveData) => {
    if (!evaluationId || !isEditable) {
      return;
    }

    if (!hasDataChanged(data)) {
      return;
    }

    try {
      await updatePeerReviewEvaluationAction(evaluationId, {
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
    peerReviewSaveFlushers.add(flushPendingSave);
    return () => {
      peerReviewSaveFlushers.delete(flushPendingSave);
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
