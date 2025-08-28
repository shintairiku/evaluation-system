"use client";

import React, { useMemo, useCallback } from 'react';
import HierarchyEditCard from '@/feature/user-profiles/components/HierarchyEditCard';
import type { UserDetailResponse, UserProfileOption, Role } from '@/api/types/user';
import { UserStatus } from '@/api/types/user';
import { useUser } from '@clerk/nextjs';
import { getPotentialSupervisors as getPotentialSupervisorsUtil, getPotentialSubordinates as getPotentialSubordinatesUtil } from '@/utils/hierarchy';

interface HierarchySetupWrapperProps {
  users: UserProfileOption[];
  selectedRoles: string[]; // Role IDs
  allRoles: Role[];
  selectedSupervisor: string;
  selectedSubordinates: string[];
  onSupervisorChange: (supervisorId: string) => void;
  onSubordinatesChange: (subordinateIds: string[]) => void;
  disabled?: boolean;
}

// Custom hook for role-based hierarchy filtering in setup context
function useRoleBasedHierarchyEdit(
  user: UserDetailResponse,
  allUsers: UserDetailResponse[],
  selectedRoles: string[],
  allRoles: Role[]
) {
  // Role hierarchy mapping for role-based restrictions
  const getRoleHierarchy = useCallback((roleName: string): number => {
    const hierarchyMap: Record<string, number> = {
      'admin': 1,      // 管理者 - highest
      'manager': 2,    // 部門マネジャー
      'supervisor': 3, // 上司・チームリーダー  
      'employee': 4,   // 従業員
      'viewer': 5,     // 閲覧者
      'parttime': 6    // パートタイム - lowest
    };
    return hierarchyMap[roleName.toLowerCase()] || 999;
  }, []);

  // Get the highest hierarchy level from selected roles
  const getHighestRoleHierarchy = useCallback((roleIds: string[]): number => {
    if (roleIds.length === 0) return 999;
    
    const selectedRoleObjects = allRoles.filter(role => roleIds.includes(role.id));
    const hierarchyLevels = selectedRoleObjects.map(role => getRoleHierarchy(role.name));
    return Math.min(...hierarchyLevels);
  }, [allRoles, getRoleHierarchy]);

  // Role-based potential supervisors
  const getPotentialSupervisors = useCallback(() => {
    if (selectedRoles.length === 0) return [];
    
    const currentUserHierarchy = getHighestRoleHierarchy(selectedRoles);
    
    // Get base potential supervisors (without role filtering)
    const baseSupervisors = getPotentialSupervisorsUtil(allUsers, user.id);
    
    // Apply role-based filtering
    return baseSupervisors.filter(potentialSupervisor => {
      if (!potentialSupervisor.roles || potentialSupervisor.roles.length === 0) return false;
      
      const supervisorRoleIds = potentialSupervisor.roles.map(role => role.id);
      const supervisorHierarchy = getHighestRoleHierarchy(supervisorRoleIds);
      
      // Role-based rules for supervisors:
      // 1. Admin can only have subordinates (no supervisor)
      const currentIsAdmin = selectedRoles.some(roleId => {
        const role = allRoles.find(r => r.id === roleId);
        return role && getRoleHierarchy(role.name) === 1;
      });
      if (currentIsAdmin) return false; // Admin cannot have supervisor
      
      // 2. Only users with higher or equal hierarchy can be supervisors
      return supervisorHierarchy <= currentUserHierarchy;
    });
  }, [allUsers, user.id, selectedRoles, allRoles, getRoleHierarchy, getHighestRoleHierarchy]);

  // Role-based potential subordinates
  const getPotentialSubordinates = useCallback(() => {
    if (selectedRoles.length === 0) return [];
    
    const currentUserHierarchy = getHighestRoleHierarchy(selectedRoles);
    
    // Get base potential subordinates (without role filtering)
    const baseSubordinates = getPotentialSubordinatesUtil(allUsers, user.id);
    
    // Apply role-based filtering
    return baseSubordinates.filter(potentialSubordinate => {
      if (!potentialSubordinate.roles || potentialSubordinate.roles.length === 0) return false;
      
      const subordinateRoleIds = potentialSubordinate.roles.map(role => role.id);
      const subordinateHierarchy = getHighestRoleHierarchy(subordinateRoleIds);
      
      // Role-based rules for subordinates:
      // 1. Employee/Viewer/Parttime can only be supervised (no subordinates)
      const currentIsEmployeeOrLower = selectedRoles.some(roleId => {
        const role = allRoles.find(r => r.id === roleId);
        return role && getRoleHierarchy(role.name) >= 4;
      });
      if (currentIsEmployeeOrLower) return false; // Employee cannot have subordinates
      
      // 2. Only users with lower hierarchy can be subordinates
      return subordinateHierarchy > currentUserHierarchy;
    });
  }, [allUsers, user.id, selectedRoles, allRoles, getRoleHierarchy, getHighestRoleHierarchy]);

  return {
    getPotentialSupervisors,
    getPotentialSubordinates
  };
}

export default function HierarchySetupWrapper({ 
  users,
  selectedRoles,
  allRoles,
  selectedSupervisor,
  selectedSubordinates,
  onSupervisorChange,
  onSubordinatesChange,
  disabled = false
}: HierarchySetupWrapperProps) {
  const { user: clerkUser } = useUser();

  // Convert UserProfileOption[] to UserDetailResponse[] format expected by HierarchyEditCard
  const convertedUsers = useMemo(() => {
    return users.map(user => ({
      id: user.id,
      clerk_user_id: '', // UserProfileOption doesn't have this
      employee_code: user.employee_code,
      name: user.name,
      email: user.email,
      status: UserStatus.ACTIVE, // Use enum instead of string
      job_title: user.job_title,
      department: undefined, // UserProfileOption doesn't have this
      stage: undefined, // UserProfileOption doesn't have this
      roles: user.roles,
      supervisor: undefined, // UserProfileOption doesn't have this
      subordinates: [] // UserProfileOption doesn't have this
    } as UserDetailResponse));
  }, [users]);

  // Create a mock current user for the setup context
  const mockCurrentUser = useMemo((): UserDetailResponse => {
    // Get selected role objects
    const selectedRoleObjects = allRoles.filter(role => selectedRoles.includes(role.id));
    
    // Find supervisor and subordinate users
    const supervisorUser = selectedSupervisor ? convertedUsers.find(u => u.id === selectedSupervisor) : undefined;
    const subordinateUsers = convertedUsers.filter(u => selectedSubordinates.includes(u.id));

    return {
      id: 'temp-setup-user', // Temporary ID for setup
      clerk_user_id: clerkUser?.id || '',
      employee_code: 'SETUP',
      name: clerkUser?.firstName && clerkUser?.lastName 
        ? `${clerkUser.lastName} ${clerkUser.firstName}` 
        : clerkUser?.fullName || 'Setup User',
      email: clerkUser?.primaryEmailAddress?.emailAddress || '',
      status: UserStatus.ACTIVE, // Use enum instead of string
      job_title: undefined,
      department: undefined,
      stage: undefined,
      roles: selectedRoleObjects,
      supervisor: supervisorUser as any, // Type assertion to avoid complex type conversion
      subordinates: subordinateUsers as any // Type assertion to avoid complex type conversion
    };
  }, [selectedRoles, allRoles, selectedSupervisor, selectedSubordinates, convertedUsers, clerkUser]);

  // Use custom role-based hierarchy hook
  const { getPotentialSupervisors, getPotentialSubordinates } = useRoleBasedHierarchyEdit(
    mockCurrentUser,
    convertedUsers,
    selectedRoles,
    allRoles
  );

  // Handle updates from HierarchyEditCard
  const handleUserUpdate = useCallback((updatedUser: UserDetailResponse) => {
    // Extract supervisor change
    const newSupervisorId = updatedUser.supervisor?.id || '';
    if (newSupervisorId !== selectedSupervisor) {
      onSupervisorChange(newSupervisorId);
    }

    // Extract subordinate changes
    const newSubordinateIds = updatedUser.subordinates?.map(sub => sub.id) || [];
    if (JSON.stringify(newSubordinateIds.sort()) !== JSON.stringify(selectedSubordinates.sort())) {
      onSubordinatesChange(newSubordinateIds);
    }
  }, [selectedSupervisor, selectedSubordinates, onSupervisorChange, onSubordinatesChange]);

  // Don't render if no roles selected
  if (selectedRoles.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
        役職を選択してください
      </div>
    );
  }

  return (
    <HierarchyEditCard
      user={mockCurrentUser}
      allUsers={convertedUsers}
      isLoading={disabled}
      onUserUpdate={handleUserUpdate}
      forceCanEdit={true} // Force edit permission for setup context
      customGetPotentialSupervisors={getPotentialSupervisors}
      customGetPotentialSubordinates={getPotentialSubordinates}
      // Don't need onPendingChanges for setup - changes are immediate
    />
  );
}
