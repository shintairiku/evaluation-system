import { useState, useCallback, useRef, useEffect } from 'react';
import { updateSupervisorReviewAction } from '@/api/server-actions/supervisor-reviews';
import { SupervisorAction, SubmissionStatus } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Options for the useAutoSave hook
 */
interface UseAutoSaveOptions {
  /** Supervisor review ID to auto-save to */
  reviewId?: string;
  /** Initial draft comment to populate into the form (avoid per-card fetch) */
  initialComment?: string;
  /** Initial draft status (avoid per-card fetch) */
  initialStatus?: SubmissionStatus;
  /** Debounce delay in milliseconds (default: 2000) */
  debounceDelay?: number;
  /** Status clear timeout in milliseconds (default: 3000) */
  statusClearTimeout?: number;
  /** Callback to get current comment value */
  getComment: () => string;
  /** Callback to set comment value (for loading drafts) */
  setComment: (comment: string) => void;
}

/**
 * Return type for useAutoSave hook
 */
interface UseAutoSaveReturn {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last successfully saved comment */
  lastSavedComment: string;
  /** Manual save function */
  save: (comment: string) => Promise<void>;
  /** Debounced save function (use for onChange events) */
  debouncedSave: (comment: string) => void;
  /** Whether draft has been loaded */
  isDraftLoaded: boolean;
}

/**
 * Custom hook to handle auto-save functionality for goal review comments.
 *
 * Features:
 * - Debounced auto-save (2 seconds default)
 * - Manual save on blur
 * - Populate initial draft comment from server-loaded review
 * - Save before page unload
 * - Visual save status indicators
 *
 * @param options - Configuration options
 * @returns Object containing save functions and status
 *
 * @example
 * ```tsx
 * const { saveStatus, debouncedSave, save } = useAutoSave({
 *   reviewId: '123',
 *   getComment: () => formRef.current?.getComment() || '',
 *   setComment: (comment) => formRef.current?.setComment(comment)
 * });
 *
 * // In form onChange
 * <Textarea onChange={(e) => debouncedSave(e.target.value)} />
 *
 * // In form onBlur
 * <Textarea onBlur={(e) => save(e.target.value)} />
 * ```
 */
export function useAutoSave({
  reviewId,
  initialComment,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  getComment,
  setComment
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedComment, setLastSavedComment] = useState<string>('');
  const [loadedDraftReviewId, setLoadedDraftReviewId] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Core save function - saves comment as draft to supervisor review
   */
  const save = useCallback(async (comment: string) => {
    const nextComment = comment?.trim();
    if (!reviewId || !nextComment || nextComment === lastSavedComment) {
      return; // Don't save if no reviewId, empty, or unchanged
    }

    if (saveStatus === 'saving') {
      return; // Prevent concurrent saves
    }

    setSaveStatus('saving');

    try {
      const result = await updateSupervisorReviewAction(reviewId, {
        action: SupervisorAction.PENDING,
        comment: nextComment,
        status: SubmissionStatus.DRAFT
      });

      if (result.success) {
        setLastSavedComment(nextComment);
        setSaveStatus('saved');

        // Clear status after timeout
        setTimeout(() => setSaveStatus('idle'), statusClearTimeout);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, [reviewId, lastSavedComment, saveStatus, statusClearTimeout]);

  /**
   * Debounced save function - use for onChange events
   */
  const debouncedSave = useCallback((comment: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      save(comment);
    }, debounceDelay);
  }, [save, debounceDelay]);

  /**
   * Populate initial draft comment (avoid per-card fetch)
   */
  useEffect(() => {
    if (!reviewId || loadedDraftReviewId === reviewId) return;

    if (initialStatus === SubmissionStatus.DRAFT && initialComment?.trim()) {
      setComment(initialComment);
      setLastSavedComment(initialComment.trim());
    }

    setLoadedDraftReviewId(reviewId);
  }, [reviewId, loadedDraftReviewId, initialComment, initialStatus, setComment]);

  /**
   * Save before page unload
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentComment = getComment();
      if (currentComment && currentComment !== lastSavedComment && currentComment.trim()) {
        // Try to save synchronously
        save(currentComment);

        // Show warning if there are unsaved changes
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lastSavedComment, save, getComment]);

  /**
   * Cleanup debounce timer on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveStatus,
    lastSavedComment,
    save,
    debouncedSave,
    isDraftLoaded: Boolean(reviewId && loadedDraftReviewId === reviewId)
  };
}
