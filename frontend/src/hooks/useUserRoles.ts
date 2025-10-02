'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getUserByIdAction, checkUserExistsAction } from '@/api/server-actions/users';
import { getRoleHierarchyLevel } from '@/utils/hierarchy';
import type { UserDetailResponse } from '@/api/types';

export interface UserRole {
  role: string;
  label: string;
  hierarchyLevel: number;
}

export interface UseUserRolesOptions {
  /** Pre-fetched user data to avoid duplicate API calls */
  initialUserData?: UserDetailResponse | null;
  /** Skip fetching if initial data is provided (default: true) */
  skipFetchIfInitialData?: boolean;
}

export interface UseUserRolesReturn {
  userRoles: UserRole[];
  isLoading: boolean;
  error: string | null;
  currentUser: UserDetailResponse | null;
  hasRole: (role: string) => boolean;
  getHighestHierarchyLevel: () => number;
  canAccessRole: (targetRole: string) => boolean;
  refetch: () => Promise<void>;
}

// Role mapping constants with Japanese labels
export const ROLE_MAPPING: Record<string, string> = {
  'admin': '管理者',
  'manager': '部門マネジャー',
  'supervisor': '上司',
  'employee': '従業員',
  'viewer': '閲覧者',
  'parttime': 'パートタイム'
};

// Dashboard role mapping for tab labels
export const DASHBOARD_ROLE_MAPPING: Record<string, string> = {
  'admin': '管理者視点',
  'supervisor': '上司視点',
  'employee': '従業員視点'
};

/**
 * Custom hook for managing user roles and multi-role dashboard functionality
 *
 * This hook:
 * - Fetches user details including roles from the backend (or uses provided data)
 * - Provides role checking utilities
 * - Determines available dashboard views based on user's role hierarchy
 * - Manages loading and error states
 *
 * OPTIMIZATION: Accepts pre-fetched user data to eliminate duplicate API calls
 */
export function useUserRoles(options: UseUserRolesOptions = {}): UseUserRolesReturn {
  const { initialUserData = null, skipFetchIfInitialData = true } = options;
  const { userId } = useAuth();
  const [currentUser, setCurrentUser] = useState<UserDetailResponse | null>(initialUserData);
  const [isLoading, setIsLoading] = useState(!initialUserData);
  const [error, setError] = useState<string | null>(null);

  // Convert backend roles to dashboard-compatible format
  const userRoles = useMemo((): UserRole[] => {
    if (!currentUser?.roles) return [];

    const availableRoles: UserRole[] = [];

    // Determine which dashboard views the user can access based on their roles
    const userHierarchyLevels = currentUser.roles.map(role => getRoleHierarchyLevel(role.name));
    const highestLevel = Math.min(...userHierarchyLevels);

    // Dashboard view logic:
    // - Show ONLY ONE dashboard tab per hierarchy tier
    // - Admin view (管理者視点): for admin or manager roles (level 1-2)
    // - Supervisor view (上司視点): for supervisor role (level 3)
    // - Employee view (従業員視点): for all other roles (level 4+)

    if (highestLevel <= 2) {
      // User has admin or manager role -> show admin view only
      availableRoles.push({
        role: 'admin',
        label: DASHBOARD_ROLE_MAPPING.admin,
        hierarchyLevel: 1
      });
    } else if (highestLevel === 3) {
      // User has supervisor role (but not admin/manager) -> show supervisor view only
      availableRoles.push({
        role: 'supervisor',
        label: DASHBOARD_ROLE_MAPPING.supervisor,
        hierarchyLevel: 3
      });
    }

    // Employee view: always available for all authenticated users
    availableRoles.push({
      role: 'employee',
      label: DASHBOARD_ROLE_MAPPING.employee,
      hierarchyLevel: 4
    });

    return availableRoles;
  }, [currentUser?.roles]);

  const fetchUserData = async () => {
    if (!userId) {
      setError('認証されていません');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First check if user exists and get basic info
      const userExistsResult = await checkUserExistsAction(userId);

      if (!userExistsResult.success || !userExistsResult.data?.exists || !userExistsResult.data.user_id) {
        setError('ユーザーが見つかりません');
        return;
      }

      // Get full user details including roles
      const userDetailResult = await getUserByIdAction(userExistsResult.data.user_id);

      if (!userDetailResult.success || !userDetailResult.data) {
        setError('ユーザー詳細の取得に失敗しました');
        return;
      }

      setCurrentUser(userDetailResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ユーザー情報の取得中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Skip fetching if initial data provided and skipFetchIfInitialData is true
    if (initialUserData && skipFetchIfInitialData) {
      return;
    }
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, initialUserData, skipFetchIfInitialData]);

  // Utility functions
  const hasRole = (role: string): boolean => {
    if (!currentUser?.roles) return false;
    return currentUser.roles.some(userRole => userRole.name.toLowerCase() === role.toLowerCase());
  };

  const getHighestHierarchyLevel = (): number => {
    if (!currentUser?.roles || currentUser.roles.length === 0) return 999;
    const hierarchyLevels = currentUser.roles.map(role => getRoleHierarchyLevel(role.name));
    return Math.min(...hierarchyLevels);
  };

  const canAccessRole = (targetRole: string): boolean => {
    return userRoles.some(role => role.role === targetRole);
  };

  const refetch = async () => {
    await fetchUserData();
  };

  return {
    userRoles,
    isLoading,
    error,
    currentUser,
    hasRole,
    getHighestHierarchyLevel,
    canAccessRole,
    refetch
  };
}