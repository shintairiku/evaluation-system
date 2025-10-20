/**
 * Custom hook for managing organization context initialization
 * Ensures org slug is set before making API calls
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

export interface OrgContextState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  orgSlug: string | null;
}

/**
 * Hook to initialize and manage organization context from JWT token
 * Use this before making organization-scoped API calls
 */
export function useOrgContext(): OrgContextState {
  const [state, setState] = useState<OrgContextState>({
    isInitialized: false,
    isLoading: true,
    error: null,
    orgSlug: null
  });
  const { getToken } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Get organization slug from JWT token
        const { getOrgSlugFromToken } = await import('@/api/utils/jwt-parser');
        const { getHttpClientBrowser } = await import('@/api/client/http-client-browser');

        // IMPORTANT: Request the 'org-jwt' template to get organization data
        const token = await getToken({ template: 'org-jwt' });

        if (!isMounted) return;

        if (!token) {
          setState({
            isInitialized: false,
            isLoading: false,
            error: '認証情報が見つかりません',
            orgSlug: null
          });
          return;
        }

        const orgSlug = getOrgSlugFromToken(token);

        if (!orgSlug) {
          setState({
            isInitialized: false,
            isLoading: false,
            error: '組織情報が見つかりません',
            orgSlug: null
          });
          return;
        }

        // Set org slug in HTTP client
        const httpClient = getHttpClientBrowser();
        httpClient.setOrgSlug(orgSlug);

        if (!isMounted) return;

        setState({
          isInitialized: true,
          isLoading: false,
          error: null,
          orgSlug
        });
      } catch (error) {
        if (!isMounted) return;

        setState({
          isInitialized: false,
          isLoading: false,
          error: '組織情報の初期化に失敗しました',
          orgSlug: null
        });
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [getToken]);

  return state;
}
