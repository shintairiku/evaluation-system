import { useState, useCallback, useRef, useEffect } from 'react';
import { updateSupervisorFeedbackAction } from '@/api/server-actions/supervisor-feedbacks';
import type { RatingCode, SupervisorFeedbackStatus, CompetencyRatingData } from '@/api/types';

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Data to save for a supervisor feedback
 */
export interface SupervisorFeedbackSaveData {
  supervisorRatingCode?: RatingCode;
  supervisorComment?: string;
  /** Per-action ratings for competency goals */
  ratingData?: CompetencyRatingData;
}

/**
 * Options for the useSupervisorFeedbackAutoSave hook
 */
interface UseSupervisorFeedbackAutoSaveOptions {
  /** Supervisor feedback ID to auto-save to */
  feedbackId?: string;
  /** Initial rating code (from server) */
  initialRatingCode?: RatingCode;
  /** Initial comment (from server) */
  initialComment?: string;
  /** Initial per-action ratings for competency goals (from server) */
  initialRatingData?: CompetencyRatingData;
  /** Initial status - only allow edits if not submitted */
  initialStatus?: SupervisorFeedbackStatus;
  /** Debounce delay in milliseconds (default: 2000) */
  debounceDelay?: number;
  /** Status clear timeout in milliseconds (default: 3000) */
  statusClearTimeout?: number;
  /** Callback when save succeeds - use to refresh parent data */
  onSaveSuccess?: () => void;
}

/**
 * Return type for useSupervisorFeedbackAutoSave hook
 */
interface UseSupervisorFeedbackAutoSaveReturn {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last successfully saved data */
  lastSavedData: SupervisorFeedbackSaveData;
  /** Manual save function */
  save: (data: SupervisorFeedbackSaveData) => Promise<void>;
  /** Debounced save function (use for onChange events) */
  debouncedSave: (data: SupervisorFeedbackSaveData) => void;
  /** Whether initial data has been loaded */
  isInitialized: boolean;
  /** Whether the feedback is editable (not submitted) */
  isEditable: boolean;
}

/**
 * Custom hook to handle auto-save functionality for supervisor feedback ratings and comments.
 *
 * Features:
 * - Debounced auto-save (2 seconds default)
 * - Manual save on blur
 * - Visual save status indicators
 * - Only editable when status is not 'submitted'
 *
 * @param options - Configuration options
 * @returns Object containing save functions and status
 */
export function useSupervisorFeedbackAutoSave({
  feedbackId,
  initialRatingCode,
  initialComment,
  initialRatingData,
  initialStatus,
  debounceDelay = 2000,
  statusClearTimeout = 3000,
  onSaveSuccess
}: UseSupervisorFeedbackAutoSaveOptions): UseSupervisorFeedbackAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedData, setLastSavedData] = useState<SupervisorFeedbackSaveData>({
    supervisorRatingCode: initialRatingCode,
    supervisorComment: initialComment,
    ratingData: initialRatingData
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusClearTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if feedback is editable (incomplete or draft, not submitted)
  const isEditable = initialStatus !== 'submitted';

  /**
   * Check if data has changed from last saved
   */
  const hasDataChanged = useCallback((data: SupervisorFeedbackSaveData): boolean => {
    const ratingCodeChanged = data.supervisorRatingCode !== lastSavedData.supervisorRatingCode;
    const commentChanged = data.supervisorComment?.trim() !== lastSavedData.supervisorComment?.trim();
    const ratingDataChanged = JSON.stringify(data.ratingData) !== JSON.stringify(lastSavedData.ratingData);
    return ratingCodeChanged || commentChanged || ratingDataChanged;
  }, [lastSavedData]);

  /**
   * Core save function - saves rating and comment to supervisor feedback
   */
  const save = useCallback(async (data: SupervisorFeedbackSaveData) => {
    if (!feedbackId || !isEditable) {
      return;
    }

    // Don't save if no changes
    if (!hasDataChanged(data)) {
      return;
    }

    // Prevent concurrent saves
    if (saveStatus === 'saving') {
      return;
    }

    setSaveStatus('saving');

    // Clear any pending status clear timer
    if (statusClearTimerRef.current) {
      clearTimeout(statusClearTimerRef.current);
    }

    try {
      const result = await updateSupervisorFeedbackAction(feedbackId, {
        supervisorRatingCode: data.supervisorRatingCode,
        supervisorComment: data.supervisorComment,
      });

      if (result.success) {
        setLastSavedData({
          supervisorRatingCode: data.supervisorRatingCode,
          supervisorComment: data.supervisorComment?.trim(),
          ratingData: data.ratingData
        });
        setSaveStatus('saved');

        // Notify parent that data was saved
        onSaveSuccess?.();

        // Clear status after timeout
        statusClearTimerRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, statusClearTimeout);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, [feedbackId, isEditable, hasDataChanged, saveStatus, statusClearTimeout, onSaveSuccess]);

  /**
   * Debounced save function - use for onChange events
   */
  const debouncedSave = useCallback((data: SupervisorFeedbackSaveData) => {
    if (!isEditable) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      save(data);
    }, debounceDelay);
  }, [save, debounceDelay, isEditable]);

  /**
   * Initialize with server data
   */
  useEffect(() => {
    if (feedbackId && !isInitialized) {
      setLastSavedData({
        supervisorRatingCode: initialRatingCode,
        supervisorComment: initialComment?.trim(),
        ratingData: initialRatingData
      });
      setIsInitialized(true);
    }
  }, [feedbackId, initialRatingCode, initialComment, initialRatingData, isInitialized]);

  /**
   * Reset when feedback ID changes
   */
  useEffect(() => {
    setIsInitialized(false);
    setSaveStatus('idle');
  }, [feedbackId]);

  /**
   * Cleanup timers on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (statusClearTimerRef.current) {
        clearTimeout(statusClearTimerRef.current);
      }
    };
  }, []);

  return {
    saveStatus,
    lastSavedData,
    save,
    debouncedSave,
    isInitialized,
    isEditable
  };
}
