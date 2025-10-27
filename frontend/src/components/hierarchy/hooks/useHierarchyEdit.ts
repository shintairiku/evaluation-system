'use client';

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';
import { useErrorHandler } from '@/utils/error-handling';
import { updateUserAction, getUserByIdAction } from '@/api/server-actions/users';
import type { UserDetailResponse } from '@/api/types';
import {
  validateHierarchyChange as validateHierarchyChangeUtil,
  getPotentialSupervisors as getPotentialSupervisorsUtil,
  getPotentialSubordinates as getPotentialSubordinatesUtil,
} from '@/utils/hierarchy';


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
    return getPotentialSupervisorsUtil(allUsers, user.id);
  }, [user.id, allUsers]);

  // Get potential subordinates
  const getPotentialSubordinates = useCallback(() => {
    return getPotentialSubordinatesUtil(allUsers, user.id);
  }, [user.id, allUsers]);

  // Validation function
  const validateHierarchyChange = useCallback((targetUserId: string, newSupervisorId: string | null): string | null => {
    return validateHierarchyChangeUtil(allUsers, targetUserId, newSupervisorId);
  }, [allUsers]);

  // Manage pending state and queued operations for deferred save
  const [hasLocalPending, setHasLocalPending] = useState(false);
  // Prepare a dynamic async operation via ref so each action can append its own operation
  const nextOperationRef = useRef<() => Promise<UserDetailResponse>>(async () => user);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  // Use optimistic update; asyncOperation delegates to the ref set by each action
  const hierarchyUpdate = useOptimisticUpdate(user, {
    optimisticUpdate: (currentUser) => currentUser,
    asyncOperation: async () => nextOperationRef.current(),
    successMessage: '階層変更が正常に保存されました',
    errorMessage: '階層変更の保存に失敗しました',
    onSuccess: (updatedUser) => {
      onUserUpdate?.(updatedUser);
    },
    onError: (error) => {
      handleError(error, 'hierarchy-edit');
    },
  });
  const resetHierarchyState = hierarchyUpdate.reset;

  // Whenever the incoming user prop gains richer hierarchy data (e.g., detailed modal fetch),
  // ensure the optimistic state reflects it so the UI renders supervisor/subordinate lists.
  useEffect(() => {
    const supervisorId = user.supervisor?.id ?? 'none';
    const subordinateSignature = user.subordinates
      ? [...user.subordinates].map((sub) => sub.id).sort().join(',')
      : 'none';
    const signature = `${user.id}|${supervisorId}|${subordinateSignature}`;

    if (lastSyncedSignatureRef.current === signature) {
      return;
    }

    resetHierarchyState(user);
    nextOperationRef.current = async () => user;
    setHasLocalPending(false);
    lastSyncedSignatureRef.current = signature;
  }, [user, resetHierarchyState, setHasLocalPending]);

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
      ? allUsers.find((u) => u.id === newSupervisorId) || null
      : null;

    const optimisticUser: UserDetailResponse = {
      ...user,
      supervisor: (newSupervisor as UserDetailResponse['supervisor']) || undefined,
    };

    hierarchyUpdate.reset(optimisticUser);

    // Chain operation for deferred save
    const prevOp = nextOperationRef.current;
    nextOperationRef.current = async () => {
      await prevOp();
      const result = await updateUserAction(user.id, {
        supervisor_id: newSupervisorId || undefined,
      });
      if (!result.success || !result.data) {
        throw new Error('上司の変更に失敗しました');
      }
      return result.data;
    };

    setHasLocalPending(true);
  }, [canEditHierarchy, validateHierarchyChange, user, allUsers, hierarchyUpdate]);

  // Add subordinate - simple immediate execution like supervisor
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

    // Optimistic update for immediate UI feedback
    const currentSubordinates = hierarchyUpdate.state.subordinates || [];
    const subordinateWithSupervisor = {
      ...subordinate,
      supervisor: {
        id: user.id,
        name: user.name,
        email: user.email,
        employee_code: user.employee_code,
        department: user.department,
        stage: user.stage,
        roles: user.roles,
        status: user.status
      }
    };
    
    const optimisticUser: UserDetailResponse = {
      ...hierarchyUpdate.state,
      subordinates: [...currentSubordinates, subordinateWithSupervisor] as UserDetailResponse['subordinates']
    };
    hierarchyUpdate.reset(optimisticUser);

    // Queue operation for batch execution
    const prevOp = nextOperationRef.current;
    nextOperationRef.current = async () => {
      await prevOp();
      const result = await updateUserAction(subordinateId, { supervisor_id: user.id });
      if (!result.success) {
        throw new Error('部下の追加に失敗しました');
      }
      const userResult = await getUserByIdAction(user.id);
      if (!userResult.success || !userResult.data) {
        throw new Error('ユーザー情報の更新に失敗しました');
      }
      return userResult.data;
    };

    setHasLocalPending(true);
  }, [canEditHierarchy, validateHierarchyChange, user, allUsers, hierarchyUpdate]);

  // Remove subordinate - consistent with addSubordinate pattern
  const removeSubordinate = useCallback(async (subordinateId: string): Promise<void> => {
    if (!canEditHierarchy) {
      throw new Error('階層編集権限がありません');
    }

    // Optimistic update for immediate UI feedback
    const currentSubordinates = hierarchyUpdate.state.subordinates || [];
    const optimisticUser: UserDetailResponse = {
      ...hierarchyUpdate.state,
      subordinates: currentSubordinates.filter(sub => sub.id !== subordinateId)
    };
    hierarchyUpdate.reset(optimisticUser);

    // Queue operation for batch execution
    const prevOp = nextOperationRef.current;
    nextOperationRef.current = async () => {
      await prevOp();
      const result = await updateUserAction(subordinateId, { supervisor_id: undefined });
      if (!result.success) {
        throw new Error('部下の削除に失敗しました');
      }
      const userResult = await getUserByIdAction(user.id);
      if (!userResult.success || !userResult.data) {
        throw new Error('ユーザー情報の更新に失敗しました');
      }
      return userResult.data;
    };

    setHasLocalPending(true);
  }, [canEditHierarchy, hierarchyUpdate, user.id]);

  const saveAllChanges = useCallback(async (): Promise<UserDetailResponse> => {
    try {
      const result = await hierarchyUpdate.execute();
      setHasLocalPending(false);
      // Reset the queue to a no-op that returns the latest state
      nextOperationRef.current = async () => result;
      return result;
    } catch (e) {
      // keep pending state until user resolves/undoes
      throw e;
    }
  }, [hierarchyUpdate]);

  const rollbackChanges = useCallback(() => {
    hierarchyUpdate.rollback();
    setHasLocalPending(false);
    nextOperationRef.current = async () => hierarchyUpdate.state;
  }, [hierarchyUpdate]);

  return {
    // Permission checking
    canEditHierarchy,
    currentUser,
    
    // Optimistic state
    optimisticState: hierarchyUpdate.state,
    hasPendingChanges: hasLocalPending,
    isPending: hierarchyUpdate.isPending,
    
    // Actions
    changeSupervisor,
    addSubordinate,
    removeSubordinate,
    rollbackChanges,
    saveAllChanges,
    
    // Helpers
    getPotentialSupervisors,
    getPotentialSubordinates,
    validateHierarchyChange
  };
}
