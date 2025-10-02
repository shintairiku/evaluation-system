import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { updateSupervisorReviewAction, getSupervisorReviewByIdAction } from '@/api/server-actions/supervisor-reviews';
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
 * - Load existing draft on mount
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
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  getComment,
  setComment
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedComment, setLastSavedComment] = useState<string>('');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef<boolean>(false); // Prevent multiple load attempts

  /**
   * Core save function - saves comment as draft to supervisor review
   */
  const save = useCallback(async (comment: string) => {
    if (!reviewId || !comment?.trim() || comment === lastSavedComment) {
      return; // Don't save if no reviewId, empty, or unchanged
    }

    if (saveStatus === 'saving') {
      return; // Prevent concurrent saves
    }

    setSaveStatus('saving');

    try {
      const result = await updateSupervisorReviewAction(reviewId, {
        action: SupervisorAction.PENDING,
        comment: comment.trim(),
        status: SubmissionStatus.DRAFT
      });

      if (result.success) {
        setLastSavedComment(comment);
        setSaveStatus('saved');

        // Clear status after timeout
        setTimeout(() => setSaveStatus('idle'), statusClearTimeout);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
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
   * Load existing draft on mount
   * Uses useRef to prevent infinite loop caused by setComment dependency
   * hasLoadedRef prevents multiple load attempts, isDraftLoaded only indicates successful load
   */
  useEffect(() => {
    const loadExistingDraft = async () => {
      // Prevent multiple load attempts using ref (more reliable than state)
      if (!reviewId || hasLoadedRef.current) return;

      hasLoadedRef.current = true; // Mark as attempted immediately to prevent re-execution

      try {
        const result = await getSupervisorReviewByIdAction(reviewId);

        if (result.success && result.data) {
          const review = result.data;

          // Only load if status is draft and has comment
          if (review.status === 'draft' && review.comment) {
            setComment(review.comment);
            setLastSavedComment(review.comment);
            setIsDraftLoaded(true); // Mark as successfully loaded

            toast.info('下書きが読み込まれました', {
              description: '前回保存したコメントが復元されました'
            });
          }
          // No else needed - hasLoadedRef already prevents re-execution
        }
        // No else needed - hasLoadedRef already prevents re-execution
      } catch (error) {
        // Silent fail - draft loading is not critical
        // hasLoadedRef already prevents retry
      }
    };

    loadExistingDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId]); // Only depend on reviewId - setComment is stable via useRef pattern

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
    isDraftLoaded
  };
}
