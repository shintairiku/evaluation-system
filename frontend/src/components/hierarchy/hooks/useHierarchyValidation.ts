'use client';

import { useCallback } from 'react';
import { validateHierarchyChange } from '@/utils/hierarchy';
import type { UserDetailResponse } from '@/api/types';

interface UseHierarchyValidationOptions {
  allUsers: UserDetailResponse[];
}

export function useHierarchyValidation({ allUsers }: UseHierarchyValidationOptions) {
  
  // Validation function wrapper
  const validateChange = useCallback((targetUserId: string, newSupervisorId: string | null): string | null => {
    return validateHierarchyChange(allUsers, targetUserId, newSupervisorId);
  }, [allUsers]);

  // Check if a user can be a supervisor
  const canBeSupervisor = useCallback((userId: string, targetUserId: string): boolean => {
    const validationError = validateChange(targetUserId, userId);
    return validationError === null;
  }, [validateChange]);

  // Check if a user can be a subordinate
  const canBeSubordinate = useCallback((userId: string, supervisorId: string): boolean => {
    const validationError = validateChange(userId, supervisorId);
    return validationError === null;
  }, [validateChange]);

  return {
    validateChange,
    canBeSupervisor,
    canBeSubordinate,
  };
}