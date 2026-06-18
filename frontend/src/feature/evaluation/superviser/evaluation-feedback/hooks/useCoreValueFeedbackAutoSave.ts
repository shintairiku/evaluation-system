import { updateCoreValueFeedbackAction } from '@/api/server-actions/core-values';
import { useCoreValueAutoSave, coreValueFeedbackFlushers, type CoreValueSaveData } from '@/feature/evaluation/shared/core-value/useCoreValueAutoSave';
import type { CoreValueFeedbackStatus } from '@/api/types';

export type { SaveStatus } from '@/feature/evaluation/shared/types';
export type { CoreValueSaveData as CoreValueFeedbackSaveData } from '@/feature/evaluation/shared/core-value/useCoreValueAutoSave';

export const flushCoreValueFeedbackAutoSaves = coreValueFeedbackFlushers.flushAll;

/**
 * Current local (on-screen) core value feedback data for a feedbackId, or undefined
 * when no card is mounted (caller falls back to the server-derived prop). Lets the
 * submit button's completeness check read WYSIWYS instead of the stale prop.
 * Mirrors getSupervisorFeedbackSnapshot.
 */
export const getCoreValueFeedbackSnapshot = coreValueFeedbackFlushers.getSnapshot;

/**
 * Auto-save hook for core value feedback scores and comment.
 * Thin wrapper around the shared useCoreValueAutoSave hook.
 */
export function useCoreValueFeedbackAutoSave(options: {
  feedbackId?: string;
  initialScores?: Record<string, string> | null;
  initialComment?: string | null;
  initialStatus?: CoreValueFeedbackStatus;
  debounceDelay?: number;
  statusClearTimeout?: number;
  onSaveSuccess?: () => void;
  /** Stable getter for the card's live { scores, comment } (WYSIWYS submit). */
  getSnapshot?: () => CoreValueSaveData;
}) {
  return useCoreValueAutoSave({
    entityId: options.feedbackId,
    initialScores: options.initialScores,
    initialComment: options.initialComment,
    initialStatus: options.initialStatus,
    debounceDelay: options.debounceDelay,
    statusClearTimeout: options.statusClearTimeout,
    onSaveSuccess: options.onSaveSuccess,
    saveAction: updateCoreValueFeedbackAction,
    isEditableCheck: (status) => status !== 'submitted',
    flusherSet: coreValueFeedbackFlushers.flushers,
    getSnapshot: options.getSnapshot,
    snapshotRegistry: coreValueFeedbackFlushers.snapshotGetters,
  });
}
