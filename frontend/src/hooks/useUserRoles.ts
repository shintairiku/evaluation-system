'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getRoleHierarchyLevel } from '@/utils/hierarchy';
import type { UserDetailResponse } from '@/api/types';
import { useOptionalCurrentUserContext } from '@/context/CurrentUserContext';
import { checkUserExistsAction, getUserByIdAction } from '@/api/server-actions/users';

export interface UserRole {
  role: string;
  label: string;
  hierarchyLevel: number;
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
 * - Fetches user details including roles from the backend
 * - Provides role checking utilities
 * - Determines available dashboard views based on user's role hierarchy
 * - Manages loading and error states
 */
export function useUserRoles(): UseUserRolesReturn {
  const router = useRouter();
  const { userId } = useAuth();
  const optionalContext = useOptionalCurrentUserContext();
  const [currentUser, setCurrentUser] = useState<UserDetailResponse | null>(optionalContext?.user ?? null);
  const [isLoading, setIsLoading] = useState(!optionalContext);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!userId) {
      setError('認証されていません');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const exists = await checkUserExistsAction(userId);
      if (!exists.success || !exists.data?.exists || !exists.data.user_id) {
        setError('ユーザーが見つかりません');
        setIsLoading(false);
        return;
      }

      const detail = await getUserByIdAction(exists.data.user_id);
      if (!detail.success || !detail.data) {
        setError('ユーザー詳細の取得に失敗しました');
        setIsLoading(false);
        return;
      }

      setCurrentUser(detail.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ユーザー情報の取得中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Convert backend roles to dashboard-compatible format
  const userRoles = useMemo((): UserRole[] => {
    if (!currentUser?.roles) return [];

    const availableRoles: UserRole[] = [];

    // Determine which dashboard views the user can access based on their roles
    const userHierarchyLevels = currentUser.roles.map(role => getRoleHierarchyLevel(role.name));
    const highestLevel = Math.min(...userHierarchyLevels);

    // Admin view: only for admin (level 1) or manager (level 2) roles
    if (highestLevel <= 2) {
      availableRoles.push({
        role: 'admin',
        label: DASHBOARD_ROLE_MAPPING.admin,
        hierarchyLevel: 1
      });
    }

    // Supervisor view: for admin, manager, or supervisor roles (level 1-3)
    if (highestLevel <= 3) {
      availableRoles.push({
        role: 'supervisor',
        label: DASHBOARD_ROLE_MAPPING.supervisor,
        hierarchyLevel: 3
      });
    }

    // Employee view: for all authenticated users
    availableRoles.push({
      role: 'employee',
      label: DASHBOARD_ROLE_MAPPING.employee,
      hierarchyLevel: 4
    });

    return availableRoles;
  }, [currentUser?.roles]);

  useEffect(() => {
    if (optionalContext) {
      setCurrentUser(optionalContext.user);
      setError(null);
      setIsLoading(false);
    } else {
      // Fallback: fetch user data when no provider is present
      fetchUserData();
    }
  }, [optionalContext, fetchUserData]);

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
    if (optionalContext) {
      router.refresh();
    } else {
      await fetchUserData();
    }
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
