'use client';

import { useEffect, useRef } from 'react';

interface UseAutoSaveOptions<T = unknown> {
  data: T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (changedData: any) => Promise<boolean>;
  delay?: number;
  enabled?: boolean;
  autoSaveReady?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changeDetector?: () => any; // Function that returns changed items only
  dataKey?: unknown; // Lightweight key to detect changes instead of full data JSON
}

export function useAutoSave<T>({ data, onSave, delay = 3000, enabled = true, autoSaveReady = true, changeDetector, dataKey }: UseAutoSaveOptions<T>) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastSavedDataRef = useRef<string | undefined>(undefined);
  const isInitialMount = useRef(true);
  const wasAutoSaveReady = useRef(false);

  useEffect(() => {
    if (!enabled || !autoSaveReady) {
      if (isInitialMount.current) {
        // Only log if auto-save is actually supposed to be enabled
        if (enabled && process.env.NODE_ENV !== 'production') {
          console.debug('🔧 Auto-save: skipping initial mount');
        }
        isInitialMount.current = false;
      } else if (!enabled) {
        // Don't log when completely disabled (no period selected)
        // Intentionally silent
      } else if (!autoSaveReady) {
        if (process.env.NODE_ENV !== 'production') console.debug('🔧 Auto-save: not ready via autoSaveReady flag');
      }
      return;
    }

    // When auto-save becomes ready for the first time, set baseline without triggering save
    if (!wasAutoSaveReady.current && autoSaveReady) {
      console.log('🚀 Auto-save: Now ready! Setting baseline data without triggering save');
      lastSavedDataRef.current = JSON.stringify(dataKey ?? data);
      wasAutoSaveReady.current = true;
      isInitialMount.current = false;
      return;
    }

    // Skip if still on initial mount (should not happen due to above logic, but safety check)
    if (isInitialMount.current) {
      console.log('🔧 Auto-save: skipping initial mount (fallback)');
      isInitialMount.current = false;
      return;
    }

    const currentDataString = JSON.stringify(dataKey ?? data);

    // Don't save if data hasn't changed
    if (currentDataString === lastSavedDataRef.current) {
      if (process.env.NODE_ENV !== 'production') console.debug('🔧 Auto-save: data unchanged, skipping');
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      if (process.env.NODE_ENV !== 'production') console.debug('🔧 Auto-save: cleared existing timeout');
    }

    if (process.env.NODE_ENV !== 'production') console.debug(`⏱️ Auto-save: scheduling save in ${delay}ms`);

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(async () => {
      try {
        // Use change detector if provided, otherwise use full data
        const dataToSave = changeDetector ? changeDetector() : data;

        // Only proceed if there are actual changes to save
        if (changeDetector && (!dataToSave || (Array.isArray(dataToSave) && dataToSave.length === 0))) {
          if (process.env.NODE_ENV !== 'production') console.debug('🔧 Auto-save: No changes detected, skipping save');
          return;
        }

        const success = await onSave(dataToSave);
        if (success) {
          lastSavedDataRef.current = currentDataString;
          if (process.env.NODE_ENV !== 'production') console.debug('💾 Auto-saved successfully');
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.error('❌ Auto-save failed:', error);
      }
    }, delay);

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, onSave, delay, enabled, autoSaveReady, changeDetector, dataKey]);

  // Cleanup on unmount and reset when auto-save becomes disabled
  useEffect(() => {
    if (!autoSaveReady) {
      wasAutoSaveReady.current = false;
    }
  }, [autoSaveReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}