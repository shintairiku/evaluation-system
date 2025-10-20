/**
 * React hook to synchronize Clerk auth state with the unified HTTP client
 * This ensures client-side API calls have the proper auth token
 */

'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { ClientAuth } from '../client/auth-helper';

export function useAuthSync() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    const syncToken = async () => {
      if (isSignedIn) {
        try {
          // Request org-jwt template to include organization data
          const token = await getToken({ template: 'org-jwt' });
          ClientAuth.setToken(token);
        } catch (error) {
          console.warn('Failed to sync auth token:', error);
          ClientAuth.clearToken();
        }
      } else {
        ClientAuth.clearToken();
      }
    };

    syncToken();
  }, [getToken, isSignedIn]);

  return {
    isSignedIn,
    syncToken: async () => {
      if (isSignedIn) {
        // Request org-jwt template to include organization data
        const token = await getToken({ template: 'org-jwt' });
        ClientAuth.setToken(token);
        return token;
      }
      return null;
    }
  };
}