"use client";

import React, { useMemo, useCallback } from 'react';
import HierarchyEditCard from '@/feature/user-profiles/components/HierarchyEditCard';
import type { UserDetailResponse, UserProfileOption, Role } from '@/api/types/user';
import { useUser } from '@clerk/nextjs';
import { 
  getRoleBasedPotentialSupervisors, 
  getRoleBasedPotentialSubordinates 
} from '@/utils/hierarchy';
import { convertToUserDetailResponse, createSetupUserMock } from '@/utils/userConversions';

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

  // Convert UserProfileOption[] to UserDetailResponse[] for compatibility
  const convertedUsers = useMemo(() => {
    return users.map(user => convertToUserDetailResponse(user));
  }, [users]);

  // Get selected role objects
  const selectedRoleObjects = useMemo(() => {
    return allRoles.filter(role => selectedRoles.includes(role.id));
  }, [allRoles, selectedRoles]);

  // Find supervisor and subordinate users for hierarchy construction
  const supervisorUser = selectedSupervisor 
    ? users.find(u => u.id === selectedSupervisor) 
    : undefined;
  
  const subordinateUsers = users.filter(u => 
    selectedSubordinates.includes(u.id)
  );

  // Create a mock "current user" for setup context using type-safe conversion
  const mockCurrentUser = useMemo((): UserDetailResponse => {
    const userName = clerkUser?.firstName && clerkUser?.lastName
      ? `${clerkUser.lastName} ${clerkUser.firstName}` 
      : clerkUser?.fullName || 'Setup User';
    const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';
    
    return createSetupUserMock(
      clerkUser?.id || '',
      userName,
      userEmail,
      selectedRoleObjects,
      supervisorUser,
      subordinateUsers
    );
  }, [selectedRoleObjects, supervisorUser, subordinateUsers, clerkUser]);

  // Use centralized role-based hierarchy functions
  const getPotentialSupervisors = useCallback(() => {
    return getRoleBasedPotentialSupervisors(convertedUsers, mockCurrentUser.id, selectedRoleObjects);
  }, [convertedUsers, mockCurrentUser.id, selectedRoleObjects]);

  const getPotentialSubordinates = useCallback(() => {
    return getRoleBasedPotentialSubordinates(convertedUsers, mockCurrentUser.id, selectedRoleObjects);
  }, [convertedUsers, mockCurrentUser.id, selectedRoleObjects]);

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
