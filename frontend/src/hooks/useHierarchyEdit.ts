'use client';

import { useMemo, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';
import { useErrorHandler } from '@/utils/error-handling';
import { updateUserAction } from '@/api/server-actions/users';
import type { UserDetailResponse } from '@/api/types';


interface UseHierarchyEditOptions {
  user: UserDetailResponse;
  allUsers: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

interface UseHierarchyEditReturn {
  // Permission checking
  canEditHierarchy: boolean;
  currentUser: UserDetailResponse | null;
  
  // Optimistic state
  optimisticState: UserDetailResponse;
  hasPendingChanges: boolean;
  isPending: boolean;
  
  // Actions
  changeSupervisor: (newSupervisorId: string | null) => Promise<void>;
  addSubordinate: (subordinateId: string) => Promise<void>;
  removeSubordinate: (subordinateId: string) => Promise<void>;
  rollbackChanges: () => void;
  saveAllChanges: () => Promise<UserDetailResponse>;
  
  // Helpers
  getPotentialSupervisors: () => UserDetailResponse[];
  getPotentialSubordinates: () => UserDetailResponse[];
  validateHierarchyChange: (targetUserId: string, newSupervisorId: string | null) => string | null;
}

/**
 * Custom hook for managing hierarchy edits with optimistic updates
 * Follows the project's architecture using existing hooks
 */
export function useHierarchyEdit({
  user,
  allUsers,
  onUserUpdate
}: UseHierarchyEditOptions): UseHierarchyEditReturn {
  const { user: clerkUser } = useUser();
  const { handleError } = useErrorHandler();

  // Find current user based on Clerk email
  const currentUser = useMemo(() => {
    if (!clerkUser?.emailAddresses?.[0]?.emailAddress) return null;
    const email = clerkUser.emailAddresses[0].emailAddress;
    return allUsers.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }, [clerkUser, allUsers]);

  // Check if current user can edit hierarchies
  const canEditHierarchy = useMemo(() => {
    if (!currentUser?.roles) return false;
    
    return currentUser.roles.some(role => {
      const roleName = role.name.toLowerCase();
      return roleName.includes('admin') || 
             roleName.includes('manager') || 
             roleName.includes('supervisor');
    });
  }, [currentUser]);

  // Get potential supervisors (excluding self and subordinates to prevent circular hierarchy)
  const getPotentialSupervisors = useCallback(() => {
    const getSubordinateIds = (userId: string): Set<string> => {
      const subordinateIds = new Set<string>();
      const collectSubordinates = (currentUserId: string) => {
        allUsers.forEach(u => {
          if (u.supervisor?.id === currentUserId) {
            subordinateIds.add(u.id);
            collectSubordinates(u.id);
          }
        });
      };
      collectSubordinates(userId);
      return subordinateIds;
    };

    const subordinateIds = getSubordinateIds(user.id);
    
    return allUsers.filter(u => 
      u.id !== user.id && // Not self
      !subordinateIds.has(u.id) && // Not a subordinate
      u.status === 'active' // Only active users
    );
  }, [user.id, allUsers]);

  // Get potential subordinates
  const getPotentialSubordinates = useCallback(() => {
    const wouldCreateCircularHierarchy = (supervisorId: string, potentialSubordinateId: string): boolean => {
      let currentId: string | undefined = supervisorId;
      const visited = new Set<string>();
      
      while (currentId && !visited.has(currentId)) {
        if (currentId === potentialSubordinateId) {
          return true;
        }
        visited.add(currentId);
        const currentUserData = allUsers.find(u => u.id === currentId);
        currentId = currentUserData?.supervisor?.id;
      }
      
      return false;
    };

    return allUsers.filter(u => 
      u.id !== user.id && // Not self
      u.supervisor?.id !== user.id && // Not already a subordinate
      u.status === 'active' && // Only active users
      !wouldCreateCircularHierarchy(user.id, u.id) // Prevent circular hierarchy
    );
  }, [user, allUsers]);

  // Validation function
  const validateHierarchyChange = useCallback((targetUserId: string, newSupervisorId: string | null): string | null => {
    if (targetUserId === newSupervisorId) {
      return "ユーザーは自分自身の上司になることはできません";
    }

    if (newSupervisorId) {
      const wouldCreateCircle = (checkUserId: string, targetSupervisorId: string): boolean => {
        const checkUser = allUsers.find(u => u.id === checkUserId);
        if (!checkUser?.supervisor?.id) return false;
        if (checkUser.supervisor.id === targetSupervisorId) return true;
        return wouldCreateCircle(checkUser.supervisor.id, targetSupervisorId);
      };

      if (wouldCreateCircle(newSupervisorId, targetUserId)) {
        return "この変更は循環参照を作成するため許可されません";
      }
    }

    return null;
  }, [allUsers]);

  // Use optimistic update for comprehensive hierarchy changes
  const hierarchyUpdate = useOptimisticUpdate(user, {
    optimisticUpdate: (currentUser) => currentUser, // Will be set by specific actions
    asyncOperation: async () => {
      // Will be overridden by specific operations
      return user;
    },
    successMessage: '階層変更が正常に保存されました',
    errorMessage: '階層変更の保存に失敗しました',
    onSuccess: (updatedUser) => {
      onUserUpdate?.(updatedUser);
    },
    onError: (error) => {
      handleError(error, 'hierarchy-edit');
    }
  });

  // Change supervisor
  const changeSupervisor = useCallback(async (newSupervisorId: string | null): Promise<void> => {
    if (!canEditHierarchy) {
      throw new Error('階層編集権限がありません');
    }

    const validationError = validateHierarchyChange(user.id, newSupervisorId);
    if (validationError) {
      throw new Error(validationError);
    }

    const newSupervisor = newSupervisorId 
      ? allUsers.find(u => u.id === newSupervisorId) || null
      : null;

    // Configure the optimistic update
    hierarchyUpdate.reset({
      ...user,
      supervisor: newSupervisor as UserDetailResponse['supervisor'] // Type assertion to handle type mismatch
    });

    // Execute with the proper async operation
    const result = await updateUserAction(user.id, { supervisor_id: newSupervisorId || undefined });
    if (!result.success) {
      throw new Error('上司の変更に失敗しました');
    }
    // Update callback handled by the hook's onSuccess
  }, [canEditHierarchy, validateHierarchyChange, user, allUsers, hierarchyUpdate]);

  // Add subordinate
  const addSubordinate = useCallback(async (subordinateId: string): Promise<void> => {
    if (!canEditHierarchy) {
      throw new Error('階層編集権限がありません');
    }

    const subordinate = allUsers.find(u => u.id === subordinateId);
    if (!subordinate) {
      throw new Error('ユーザーが見つかりません');
    }

    const validationError = validateHierarchyChange(subordinateId, user.id);
    if (validationError) {
      throw new Error(validationError);
    }

    // Execute API call to set this user as supervisor for the subordinate
    const result = await updateUserAction(subordinateId, { supervisor_id: user.id });
    
    if (!result.success) {
      throw new Error('部下の追加に失敗しました');
    }

    // Update local state optimistically - let the parent component handle the update
    // The API call success will be handled by the optimistic update hook
    onUserUpdate?.(user);
  }, [canEditHierarchy, validateHierarchyChange, user, allUsers, onUserUpdate]);

  // Remove subordinate
  const removeSubordinate = useCallback(async (subordinateId: string): Promise<void> => {
    if (!canEditHierarchy) {
      throw new Error('階層編集権限がありません');
    }

    // Execute API call to remove supervisor for the subordinate
    const result = await updateUserAction(subordinateId, { supervisor_id: undefined });
    
    if (!result.success) {
      throw new Error('部下の削除に失敗しました');
    }

    // Update local state optimistically - let the parent component handle the update
    // The API call success will be handled by the optimistic update hook
    onUserUpdate?.(user);
  }, [canEditHierarchy, user, onUserUpdate]);

  return {
    // Permission checking
    canEditHierarchy,
    currentUser,
    
    // Optimistic state
    optimisticState: hierarchyUpdate.state,
    hasPendingChanges: hierarchyUpdate.isPending,
    isPending: hierarchyUpdate.isPending,
    
    // Actions
    changeSupervisor,
    addSubordinate,
    removeSubordinate,
    rollbackChanges: hierarchyUpdate.rollback,
    saveAllChanges: hierarchyUpdate.execute,
    
    // Helpers
    getPotentialSupervisors,
    getPotentialSubordinates,
    validateHierarchyChange
  };
}