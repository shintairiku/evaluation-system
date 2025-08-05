"use client";

import { useUser } from '@clerk/nextjs';
import { useMemo, useEffect, useState } from 'react';
import { getUserByIdAction } from '@/api/server-actions/users';

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
  const [backendUserData, setBackendUserData] = useState<any>(null);

  // Fetch user data from backend to get roles
  useEffect(() => {
    if (user?.publicMetadata?.users_table_id) {
      // Use users_table_id if available
      getUserByIdAction(user.publicMetadata.users_table_id as string)
        .then(result => {
          if (result.success && result.data) {
            setBackendUserData(result.data);
          }
        })
        .catch(err => console.error('Error fetching user data by ID:', err));
    } else if (user?.id) {
      // Fallback: use existing backend endpoints to get user data
      // Step 1: Check if user exists and get user_id
      fetch(`http://localhost:8000/api/v1/users/exists/${user.id}`)
        .then(res => res.json())
        .then(existsData => {
          if (existsData.exists && existsData.user_id) {
            // Step 2: Get full user details with roles
            return getUserByIdAction(existsData.user_id);
          } else {
            throw new Error('User not found in backend');
          }
        })
        .then(userResult => {
          if (userResult.success && userResult.data) {
            setBackendUserData(userResult.data);
          }
        })
        .catch(err => {
          console.error('Error fetching user via exists endpoint:', err);
        });
    }
  }, [user?.publicMetadata?.users_table_id, user?.id]);

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

    if (!user) {
      return defaultPermissions;
    }
    
    // Try to get roles from backend first, then fallback to Clerk metadata
    let roleNames: string[] = [];
    
    // Method 1: Backend user data (preferred)
    if (backendUserData?.roles) {
      roleNames = backendUserData.roles.map((role: any) => role.name.toLowerCase());
    }
    
    // Method 2: publicMetadata.roles (fallback)
    if (!roleNames.length && user.publicMetadata?.roles) {
      const roles = user.publicMetadata.roles as string[];
      roleNames = roles.map(role => role.toLowerCase());
    }
    
    // Method 3: publicMetadata.role (fallback)
    if (!roleNames.length && user.publicMetadata?.role) {
      roleNames = [String(user.publicMetadata.role).toLowerCase()];
    }

    const isAdmin = roleNames.includes('admin');
    const isManager = roleNames.includes('manager');
    const isSupervisor = roleNames.includes('supervisor');

    // Permission logic based on roles
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
  }, [user, backendUserData]);

  return permissions;
}