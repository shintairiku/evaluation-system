/**
 * Server-side JWT parsing utilities
 * Uses Next.js server-only APIs to get JWT from Clerk
 *
 * IMPORTANT: This file should only be imported on the server side
 */

import { auth } from '@clerk/nextjs/server';

interface JWTPayload {
  organization_id?: string;
  organization_slug?: string;
  organization_name?: string;
  roles?: string[];
  org_role?: string;
  internal_user_id?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Parse JWT token payload (server-side)
 * @param token - JWT token string
 * @returns Parsed JWT payload or null
 */
function parseJWTPayload(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = Buffer.from(
      paddedPayload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8');

    return JSON.parse(decoded) as JWTPayload;
  } catch (error) {
    console.error('Failed to parse JWT payload:', error);
    return null;
  }
}

/**
 * Get current organization slug from server-side auth context
 * Uses Clerk's auth() helper to get the JWT token
 *
 * @returns Organization slug or null
 */
export async function getCurrentOrgSlug(): Promise<string | null> {
  try {
    const { getToken } = await auth();

    if (!getToken) {
      console.warn('[jwt-parser-server] No getToken function available');
      return null;
    }

    const token = await getToken({ template: 'org-jwt' });

    if (!token) {
      console.warn('[jwt-parser-server] No token available');
      return null;
    }

    const payload = parseJWTPayload(token);
    if (!payload) {
      console.warn('[jwt-parser-server] Failed to parse token payload');
      return null;
    }

    return payload.organization_slug || null;
  } catch (error) {
    console.error('[jwt-parser-server] Error getting organization slug:', error);
    return null;
  }
}

/**
 * Get current organization ID from server-side auth context
 *
 * @returns Organization ID or null
 */
export async function getCurrentOrgId(): Promise<string | null> {
  try {
    const { getToken } = await auth();

    if (!getToken) {
      return null;
    }

    const token = await getToken({ template: 'org-jwt' });

    if (!token) {
      return null;
    }

    const payload = parseJWTPayload(token);
    return payload?.organization_id || null;
  } catch (error) {
    console.error('[jwt-parser-server] Error getting organization ID:', error);
    return null;
  }
}

/**
 * Get full organization context from server-side auth
 *
 * @returns Organization context object
 */
export async function getCurrentOrgContext(): Promise<{
  orgId: string | null;
  orgSlug: string | null;
  orgName: string | null;
  userRoles: string[] | null;
  orgRole: string | null;
  internalUserId: string | null;
}> {
  const defaultContext = {
    orgId: null,
    orgSlug: null,
    orgName: null,
    userRoles: null,
    orgRole: null,
    internalUserId: null
  };

  try {
    const { getToken } = await auth();

    if (!getToken) {
      return defaultContext;
    }

    const token = await getToken({ template: 'org-jwt' });

    if (!token) {
      return defaultContext;
    }

    const payload = parseJWTPayload(token);

    if (!payload) {
      return defaultContext;
    }

    return {
      orgId: payload.organization_id || null,
      orgSlug: payload.organization_slug || null,
      orgName: payload.organization_name || null,
      userRoles: payload.roles || null,
      orgRole: payload.org_role || null,
      internalUserId: payload.internal_user_id || null
    };
  } catch (error) {
    console.error('[jwt-parser-server] Error getting organization context:', error);
    return defaultContext;
  }
}

/**
 * Get internal user ID from server-side auth context
 *
 * @returns Internal user ID or null
 */
export async function getCurrentInternalUserId(): Promise<string | null> {
  try {
    const { getToken } = await auth();

    if (!getToken) {
      return null;
    }

    const token = await getToken({ template: 'org-jwt' });

    if (!token) {
      return null;
    }

    const payload = parseJWTPayload(token);
    return payload?.internal_user_id || null;
  } catch (error) {
    console.error('[jwt-parser-server] Error getting internal user ID:', error);
    return null;
  }
}
