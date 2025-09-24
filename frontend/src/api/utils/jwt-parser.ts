/**
 * JWT parsing utilities for extracting organization information
 * Used to get org_slug from Clerk JWT tokens for organization-scoped API routes
 */

interface JWTPayload {
  // Organization fields
  organization_id?: string;
  organization_slug?: string;
  organization_name?: string;

  // Role fields
  roles?: string[];     // User roles array from public_metadata
  org_role?: string;    // Organization membership role

  // User identification
  internal_user_id?: string;  // User's ID in our database

  // Standard JWT claims
  sub?: string;         // Clerk user ID
  iat?: number;         // Issued at
  exp?: number;         // Expires at
  iss?: string;         // Issuer
  aud?: string;         // Audience
}

/**
 * Parse JWT token and extract payload (client-side only, no verification)
 * Note: This is for extracting org info only, not for security validation
 */
export function parseJWTPayload(token: string): JWTPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid JWT format');
      return null;
    }

    // Decode base64url payload
    const payload = parts[1];
    // Handle base64url padding
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JWTPayload;
  } catch (error) {
    console.warn('Failed to parse JWT payload:', error);
    return null;
  }
}

/**
 * Extract organization slug from JWT token
 * Required for building organization-scoped API URLs
 */
export function getOrgSlugFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const payload = parseJWTPayload(token);
  if (!payload) {
    return null;
  }

  return payload.organization_slug || null;
}

/**
 * Extract organization ID from JWT token
 */
export function getOrgIdFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const payload = parseJWTPayload(token);
  if (!payload) {
    return null;
  }

  return payload.organization_id || null;
}

/**
 * Extract user's internal database ID from JWT token
 */
export function getInternalUserIdFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const payload = parseJWTPayload(token);
  if (!payload) {
    return null;
  }

  return payload.internal_user_id || null;
}

/**
 * Extract full organization context from JWT token
 */
export function getOrgContextFromToken(token: string | null): {
  orgId: string | null;
  orgSlug: string | null;
  orgName: string | null;
  userRoles: string[] | null;
  orgRole: string | null;
  internalUserId: string | null;
} {
  if (!token) {
    return {
      orgId: null,
      orgSlug: null,
      orgName: null,
      userRoles: null,
      orgRole: null,
      internalUserId: null
    };
  }

  const payload = parseJWTPayload(token);
  if (!payload) {
    return {
      orgId: null,
      orgSlug: null,
      orgName: null,
      userRoles: null,
      orgRole: null,
      internalUserId: null
    };
  }

  return {
    orgId: payload.organization_id || null,
    orgSlug: payload.organization_slug || null,
    orgName: payload.organization_name || null,
    userRoles: payload.roles || null,
    orgRole: payload.org_role || null,
    internalUserId: payload.internal_user_id || null,
  };
}

/**
 * React hook-friendly version to get organization context from current auth token
 * This should be used in React components that have access to Clerk's useAuth
 */
export async function getCurrentOrgContext(): Promise<{
  orgId: string | null;
  orgSlug: string | null;
  orgName: string | null;
  userRoles: string[] | null;
  orgRole: string | null;
  internalUserId: string | null;
}> {
  try {
    // Try to get token from Clerk (client-side)
    if (typeof window !== 'undefined') {
      const clerk = (window as { Clerk?: { session?: { getToken: (options: { template: string }) => Promise<string> } } }).Clerk;
      if (clerk && clerk.session) {
        const token = await clerk.session.getToken({ template: 'org-jwt' });
        return getOrgContextFromToken(token);
      }
    }

    // Fallback: try to get from stored token
    const { ClientAuth } = await import('../client/auth-helper');
    const token = ClientAuth.getToken();
    return getOrgContextFromToken(token);
  } catch (error) {
    console.warn('Failed to get current org context:', error);
    return {
      orgId: null,
      orgSlug: null,
      orgName: null,
      userRoles: null,
      orgRole: null,
      internalUserId: null
    };
  }
}

/**
 * Server-side utility to extract organization slug from Clerk token
 * Used in server actions to get org context for API calls
 */
export async function getCurrentOrgSlug(): Promise<string | null> {
  try {
    // Import Clerk server-side auth
    const { auth } = await import('@clerk/nextjs/server');
    const { getToken } = await auth();
    const token = await getToken({ template: 'org-jwt' });

    if (!token) {
      console.warn('No auth token found in server action');
      return null;
    }

    // Parse JWT payload to extract org_slug
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid JWT format');
      return null;
    }

    const payload = parts[1];
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'));
    const jwtPayload = JSON.parse(decoded);

    return jwtPayload.organization_slug || null;
  } catch (error) {
    console.warn('Failed to get org slug from token:', error);
    return null;
  }
}
