'use client';

import { useAuthSync } from '@/api/hooks/useAuthSync';

/**
 * Client component that initializes auth synchronization
 * This ensures the JWT token with org-jwt template is properly retrieved and stored
 */
export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  // console.log('🔧 AuthSyncProvider: Component initialized');
  useAuthSync();

  return <>{children}</>;
}