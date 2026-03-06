import { updatePeerReviewEvaluationAction } from '@/api/server-actions/peer-reviews';
import { useCoreValueAutoSave, createAutoSaveFlusherSet } from '@/feature/evaluation/shared/core-value/useCoreValueAutoSave';
import type { PeerReviewStatus } from '@/api/types';

export type { SaveStatus } from '@/feature/evaluation/shared/types';
export type { CoreValueSaveData as PeerReviewSaveData } from '@/feature/evaluation/shared/core-value/useCoreValueAutoSave';

const peerReviewFlushers = createAutoSaveFlusherSet();

export const flushPeerReviewAutoSaves = peerReviewFlushers.flushAll;

/**
 * Auto-save hook for peer review evaluation scores and comment.
 * Thin wrapper around the shared useCoreValueAutoSave hook.
 */
export function usePeerReviewAutoSave(options: {
  evaluationId?: string;
  initialScores?: Record<string, string> | null;
  initialComment?: string | null;
  initialStatus?: PeerReviewStatus;
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
    saveAction: updatePeerReviewEvaluationAction,
    isEditableCheck: (status) => status === 'draft',
    flusherSet: peerReviewFlushers.flushers,
  });
}
