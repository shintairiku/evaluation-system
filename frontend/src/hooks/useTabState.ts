'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUserRoles } from './useUserRoles';

export interface UseTabStateOptions {
  /** URL parameter name for the active tab (default: 'role') */
  paramName?: string;
  /** Default role to show if none specified */
  defaultRole?: string;
  /** Enable URL synchronization (default: true) */
  syncWithUrl?: boolean;
  /** Enable browser history (back/forward) support (default: true) */
  enableHistory?: boolean;
  /** Replace URL instead of pushing new history entry (default: false) */
  replaceUrl?: boolean;
  /** Validate role changes against user permissions (default: true) */
  validateRole?: boolean;
}

export interface UseTabStateReturn {
  /** Currently active role */
  activeRole: string;
  /** Change the active role */
  setActiveRole: (role: string) => void;
  /** Available roles for the current user */
  availableRoles: string[];
  /** Whether the tab state is loading */
  isLoading: boolean;
  /** Any error in tab state management */
  error: string | null;
  /** Reset to default role */
  resetToDefault: () => void;
  /** Check if a role is valid for the current user */
  isValidRole: (role: string) => boolean;
}

/**
 * Custom hook for managing tab state with URL synchronization
 *
 * This hook:
 * - Syncs active tab with URL parameters
 * - Supports browser back/forward navigation
 * - Validates role changes against user permissions
 * - Provides fallback handling for invalid roles
 * - Manages loading and error states
 *
 * Usage:
 * const { activeRole, setActiveRole, availableRoles } = useTabState({
 *   defaultRole: 'employee',
 *   paramName: 'view'
 * });
 */
export function useTabState(options: UseTabStateOptions = {}): UseTabStateReturn {
  const {
    paramName = 'role',
    defaultRole,
    syncWithUrl = true,
    enableHistory = true,
    replaceUrl = false,
    validateRole = true
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userRoles, isLoading: rolesLoading, error: rolesError } = useUserRoles();

  // Get available roles
  const availableRoles = useMemo(() => {
    return userRoles.map(role => role.role);
  }, [userRoles]);

  // Determine default role
  const defaultRoleValue = useMemo(() => {
    if (defaultRole && availableRoles.includes(defaultRole)) {
      return defaultRole;
    }
    return availableRoles[0] || 'employee';
  }, [defaultRole, availableRoles]);

  // Get initial role from URL or default
  const getInitialRole = useCallback((): string => {
    if (!syncWithUrl) {
      return defaultRoleValue;
    }

    const urlRole = searchParams.get(paramName);

    if (urlRole && availableRoles.includes(urlRole)) {
      return urlRole;
    }

    return defaultRoleValue;
  }, [syncWithUrl, searchParams, paramName, availableRoles, defaultRoleValue]);

  const [activeRole, setActiveRoleState] = useState<string>(() => getInitialRole());
  const [error, setError] = useState<string | null>(null);

  // Update active role when URL changes (browser navigation)
  useEffect(() => {
    if (!syncWithUrl || rolesLoading) return;

    const urlRole = searchParams.get(paramName);

    if (urlRole && availableRoles.includes(urlRole) && urlRole !== activeRole) {
      setActiveRoleState(urlRole);
      setError(null);
    } else if (!urlRole && activeRole !== defaultRoleValue) {
      // No role in URL, reset to default
      setActiveRoleState(defaultRoleValue);
      setError(null);
    }
  }, [searchParams, paramName, availableRoles, syncWithUrl, rolesLoading, activeRole, defaultRoleValue]);

  // Update URL when active role changes
  const updateUrl = useCallback((role: string, force = false) => {
    if (!syncWithUrl && !force) return;

    const current = new URLSearchParams(Array.from(searchParams.entries()));

    if (role === defaultRoleValue) {
      // Remove parameter for default role to keep URL clean
      current.delete(paramName);
    } else {
      current.set(paramName, role);
    }

    const search = current.toString();
    const query = search ? `?${search}` : '';
    const url = `${pathname}${query}`;

    if (enableHistory && !replaceUrl) {
      router.push(url);
    } else {
      router.replace(url);
    }
  }, [syncWithUrl, searchParams, paramName, defaultRoleValue, pathname, router, enableHistory, replaceUrl]);

  // Update active role when available roles change (user roles loaded/changed)
  useEffect(() => {
    if (rolesLoading || availableRoles.length === 0) return;

    // Check if current active role is still valid
    if (!availableRoles.includes(activeRole)) {
      const newRole = defaultRoleValue;
      setActiveRoleState(newRole);

      if (syncWithUrl) {
        updateUrl(newRole, true); // Force URL update for invalid role
      }
    }
  }, [availableRoles, activeRole, defaultRoleValue, rolesLoading, syncWithUrl, updateUrl]);

  // Validate if a role is available for the user
  const isValidRole = useCallback((role: string): boolean => {
    return availableRoles.includes(role);
  }, [availableRoles]);

  // Set active role with validation and URL sync
  const setActiveRole = useCallback((role: string) => {
    setError(null);

    // Validate role if enabled
    if (validateRole && !isValidRole(role)) {
      setError(`ロール「${role}」へのアクセス権限がありません`);
      return;
    }

    // Update state
    setActiveRoleState(role);

    // Update URL
    updateUrl(role);
  }, [validateRole, isValidRole, updateUrl]);

  // Reset to default role
  const resetToDefault = useCallback(() => {
    setActiveRole(defaultRoleValue);
  }, [setActiveRole, defaultRoleValue]);

  // Handle errors from user roles hook
  useEffect(() => {
    if (rolesError) {
      setError(rolesError);
    }
  }, [rolesError]);

  return {
    activeRole,
    setActiveRole,
    availableRoles,
    isLoading: rolesLoading,
    error,
    resetToDefault,
    isValidRole
  };
}

/**
 * Hook for URL-only tab state (no role validation)
 * Useful for simpler tab scenarios without role permissions
 */
export function useSimpleTabState(options: {
  paramName?: string;
  defaultValue?: string;
  availableValues: string[];
} = { availableValues: [] }) {
  const {
    paramName = 'tab',
    defaultValue,
    availableValues
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultVal = defaultValue || availableValues[0] || '';

  const [activeTab, setActiveTabState] = useState<string>(() => {
    const urlTab = searchParams.get(paramName);
    return (urlTab && availableValues.includes(urlTab)) ? urlTab : defaultVal;
  });

  const setActiveTab = useCallback((tab: string) => {
    if (!availableValues.includes(tab)) {
      console.warn(`Invalid tab value: ${tab}`);
      return;
    }

    setActiveTabState(tab);

    const current = new URLSearchParams(Array.from(searchParams.entries()));

    if (tab === defaultVal) {
      current.delete(paramName);
    } else {
      current.set(paramName, tab);
    }

    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${pathname}${query}`);
  }, [availableValues, defaultVal, searchParams, paramName, pathname, router]);

  // Sync with URL changes
  useEffect(() => {
    const urlTab = searchParams.get(paramName);

    if (urlTab && availableValues.includes(urlTab) && urlTab !== activeTab) {
      setActiveTabState(urlTab);
    } else if (!urlTab && activeTab !== defaultVal) {
      setActiveTabState(defaultVal);
    }
  }, [searchParams, paramName, availableValues, activeTab, defaultVal]);

  return {
    activeTab,
    setActiveTab,
    availableValues
  };
}