'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrentUserContextPayload } from '@/api/types/current-user-context';

interface ProviderProps {
  value: CurrentUserContextPayload;
  children: ReactNode;
}

interface CurrentUserContextValue extends CurrentUserContextPayload {
  refresh: () => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ value, children }: ProviderProps) {
  const router = useRouter();
  const memoized = useMemo<CurrentUserContextValue>(() => ({
    ...value,
    refresh: () => router.refresh(),
  }), [router, value]);

  return (
    <CurrentUserContext.Provider value={memoized}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUserContext(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error('useCurrentUserContext must be used within CurrentUserProvider');
  }
  return ctx;
}

/**
 * Optional version that returns null when the provider is absent.
 * Useful for components that can operate without the shared context.
 */
export function useOptionalCurrentUserContext(): CurrentUserContextValue | null {
  return useContext(CurrentUserContext);
}
