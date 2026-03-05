import { updateCoreValueEvaluationAction } from '@/api/server-actions/core-values';
import { useCoreValueAutoSave, coreValueEvaluationFlushers } from '@/feature/evaluation/shared/core-value/useCoreValueAutoSave';
import type { CoreValueEvaluationStatus } from '@/api/types';

export type { SaveStatus } from '@/feature/evaluation/shared/types';
export type { CoreValueSaveData as CoreValueEvaluationSaveData } from '@/feature/evaluation/shared/core-value/useCoreValueAutoSave';

export const flushCoreValueEvaluationAutoSaves = coreValueEvaluationFlushers.flushAll;

/**
 * Auto-save hook for core value evaluation scores and comment.
 * Thin wrapper around the shared useCoreValueAutoSave hook.
 */
export function useCoreValueEvaluationAutoSave(options: {
  evaluationId?: string;
  initialScores?: Record<string, string> | null;
  initialComment?: string | null;
  initialStatus?: CoreValueEvaluationStatus;
  debounceDelay?: number;
  statusClearTimeout?: number;
  onSaveSuccess?: () => void;
}) {
  return useCoreValueAutoSave({
    entityId: options.evaluationId,
    initialScores: options.initialScores,
    initialComment: options.initialComment,
    initialStatus: options.initialStatus,
    debounceDelay: options.debounceDelay,
    statusClearTimeout: options.statusClearTimeout,
    onSaveSuccess: options.onSaveSuccess,
    saveAction: updateCoreValueEvaluationAction,
    isEditableCheck: (status) => status === 'draft',
    flusherSet: coreValueEvaluationFlushers.flushers,
  });
}
