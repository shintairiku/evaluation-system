/**
 * Auth helper for client-side token management
 * Works with Clerk's client-side auth outside of React components
 */

// Global token store for client-side
let clientAuthToken: string | null = null;

export const ClientAuth = {
  /**
   * Set the auth token for client-side requests
   * This should be called from a React component that has access to useAuth()
   */
  setToken: (token: string | null) => {
    clientAuthToken = token;
  },

  /**
   * Get the current auth token for client-side requests
   */
  getToken: (): string | null => {
    return clientAuthToken;
  },

  /**
   * Clear the auth token
   */
  clearToken: () => {
    clientAuthToken = null;
  },

  /**
   * Initialize client-side auth from Clerk
   * This attempts to get the token from Clerk's global instance
   */
  initializeFromClerk: async (template?: string): Promise<string | null> => {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        return null;
      }

      // Try to get token from Clerk's global instance
      const clerk = (window as unknown as { Clerk?: { session?: { getToken: (opts?: { template?: string }) => Promise<string> } } }).Clerk;
      if (clerk && clerk.session) {
        const token = await clerk.session.getToken(template ? { template } : undefined);
        if (token) {
          ClientAuth.setToken(token);
          return token;
        }
      }

      // Alternative: Check for stored token in window
      const storedToken = (window as unknown as { __CLERK_AUTH_TOKEN__?: string }).__CLERK_AUTH_TOKEN__;
      if (storedToken) {
        ClientAuth.setToken(storedToken);
        return storedToken;
      }

      return null;
    } catch (error) {
      console.warn('Failed to initialize client auth from Clerk:', error);
      return null;
    }
  }
};