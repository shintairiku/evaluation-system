"use client";

import { useUser } from '@clerk/nextjs';
import { useMemo } from 'react';

interface UserPermissions {
  canManageHierarchy: boolean;
  canManageUsers: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  userRoles: string[];
}

/**
 * Hook to get current user's permissions based on their roles
 * Integrates with Clerk authentication to determine user capabilities
 */
export function useUserPermissions(): UserPermissions {
  const { user } = useUser();

  const permissions = useMemo(() => {
    // Default permissions for unauthenticated users
    const defaultPermissions: UserPermissions = {
      canManageHierarchy: false,
      canManageUsers: false,
      isAdmin: false,
      isManager: false,
      isSupervisor: false,
      userRoles: [],
    };

    if (!user?.publicMetadata) {
      return defaultPermissions;
    }

    // Extract roles from user metadata
    const userRoles = (user.publicMetadata.roles as string[]) || [];
    const roleNames = userRoles.map(role => role.toLowerCase());

    const isAdmin = roleNames.includes('admin');
    const isManager = roleNames.includes('manager');
    const isSupervisor = roleNames.includes('supervisor');

    // Determine permissions based on roles
    const canManageHierarchy = isAdmin || isManager || isSupervisor;
    const canManageUsers = isAdmin;

    return {
      canManageHierarchy,
      canManageUsers,
      isAdmin,
      isManager,
      isSupervisor,
      userRoles: roleNames,
    };
  }, [user?.publicMetadata]);

  return permissions;
}