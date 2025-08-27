"use client";

import React, { useMemo, useCallback } from 'react';
import HierarchyEditCard from '@/feature/user-profiles/components/HierarchyEditCard';
import type { UserDetailResponse, UserProfileOption, Role } from '@/api/types/user';
import { useUser } from '@clerk/nextjs';

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

  // Convert UserProfileOption[] to UserDetailResponse[] format expected by HierarchyEditCard
  const convertedUsers = useMemo(() => {
    return users.map(user => ({
      id: user.id,
      clerk_user_id: user.clerk_user_id,
      employee_code: user.employee_code,
      name: user.name,
      email: user.email,
      status: user.status,
      job_title: user.job_title,
      department: user.department,
      stage: user.stage,
      roles: user.roles,
      supervisor: user.supervisor,
      subordinates: user.subordinates
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
      status: 'active' as const,
      job_title: undefined,
      department: undefined,
      stage: undefined,
      roles: selectedRoleObjects,
      supervisor: supervisorUser,
      subordinates: subordinateUsers
    };
  }, [selectedRoles, allRoles, selectedSupervisor, selectedSubordinates, convertedUsers, clerkUser]);

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
      // Don't need onPendingChanges for setup - changes are immediate
    />
  );
}
