"use client";

import React, { useMemo, useCallback } from 'react';
import { HierarchySetupCard } from '@/components/hierarchy';
import type { UserProfileOption, Role } from '@/api/types/user';
import { UserStatus } from '@/api/types/user';
import { useUser } from '@clerk/nextjs';
import { 
  getRoleBasedPotentialSupervisors, 
  getRoleBasedPotentialSubordinates 
} from '@/utils/hierarchy';

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
    return users.map(user => ({
      id: user.id,
      clerk_user_id: '',
      employee_code: user.employee_code,
      name: user.name,
      email: user.email,
      status: UserStatus.ACTIVE,
      job_title: user.job_title,
      department: undefined,
      stage: undefined,
      roles: user.roles,
      supervisor: undefined,
      subordinates: undefined
    }));
  }, [users]);

  // Get selected role objects
  const selectedRoleObjects = useMemo(() => {
    return allRoles.filter(role => selectedRoles.includes(role.id));
  }, [allRoles, selectedRoles]);

  // Get current user info
  const userName = clerkUser?.firstName && clerkUser?.lastName
    ? `${clerkUser.lastName} ${clerkUser.firstName}` 
    : clerkUser?.fullName || 'Setup User';
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';

  // Use centralized role-based hierarchy functions
  const getPotentialSupervisors = useCallback(() => {
    return getRoleBasedPotentialSupervisors(convertedUsers, 'setup-user-mock', selectedRoleObjects);
  }, [convertedUsers, selectedRoleObjects]);

  const getPotentialSubordinates = useCallback(() => {
    return getRoleBasedPotentialSubordinates(convertedUsers, 'setup-user-mock', selectedRoleObjects);
  }, [convertedUsers, selectedRoleObjects]);

  // Don't render if no roles selected
  if (selectedRoles.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
        役職を選択してください
      </div>
    );
  }

  return (
    <HierarchySetupCard
      mode="setup"
      userName={userName}
      userEmail={userEmail}
      selectedRoles={selectedRoleObjects}
      allUsers={convertedUsers}
      selectedSupervisorId={selectedSupervisor}
      selectedSubordinateIds={selectedSubordinates}
      onSupervisorChange={onSupervisorChange}
      onSubordinatesChange={onSubordinatesChange}
      getPotentialSupervisors={getPotentialSupervisors}
      getPotentialSubordinates={getPotentialSubordinates}
      disabled={disabled}
    />
  );
}
