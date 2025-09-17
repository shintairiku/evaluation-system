'use client';

import { useEffect, useState } from 'react';

/**
 * Custom hook to manage SSR/CSR hydration
 * Centralizes mounting logic to prevent hydration mismatches
 */
export function useHydration() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
}