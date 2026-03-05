import { updateCoreValueFeedbackAction } from '@/api/server-actions/core-values';
import { useCoreValueAutoSave, coreValueFeedbackFlushers } from '@/feature/evaluation/shared/core-value/useCoreValueAutoSave';
import type { CoreValueFeedbackStatus } from '@/api/types';

export type { SaveStatus } from '@/feature/evaluation/shared/types';
export type { CoreValueSaveData as CoreValueFeedbackSaveData } from '@/feature/evaluation/shared/core-value/useCoreValueAutoSave';

export const flushCoreValueFeedbackAutoSaves = coreValueFeedbackFlushers.flushAll;

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
  });
}
