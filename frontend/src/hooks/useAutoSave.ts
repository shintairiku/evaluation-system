'use client';

import { useEffect, useRef } from 'react';

interface UseAutoSaveOptions {
  data: any;
  onSave: (data: any) => Promise<boolean>;
  delay?: number;
  enabled?: boolean;
}

export function useAutoSave({ data, onSave, delay = 3000, enabled = true }: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastSavedDataRef = useRef<string | undefined>(undefined);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!enabled || isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const currentDataString = JSON.stringify(data);
    
    // Don't save if data hasn't changed
    if (currentDataString === lastSavedDataRef.current) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(async () => {
      try {
        const success = await onSave(data);
        if (success) {
          lastSavedDataRef.current = currentDataString;
          console.log('💾 Auto-saved successfully');
        }
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
      }
    }, delay);

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, onSave, delay, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}