'use client';

import { useState, useMemo, useCallback } from 'react';
import type {
  UserDetailResponse,
  Department,
  RoleDetail,
  Stage,
  BulkUserStatusUpdateResponse,
} from '@/api/types';
import { OrgManagementView } from './OrgManagementView';
import { UsersTab } from './user-management-tab/UsersTab';
import { DepartmentsTab } from './department-management-tab/DepartmentsTab';
import { RolesTab } from './role-management-tab/RolesTab';
import { PermissionsTab } from './permission-management-tab/PermissionsTab';

interface OrgManagementContainerProps {
  initialUsers: UserDetailResponse[];
  totalUsers: number;
  initialDepartments: Department[];
  initialRoles: RoleDetail[];
  initialStages: Stage[];
}

export function OrgManagementContainer({
  initialUsers,
  totalUsers,
  initialDepartments,
  initialRoles,
  initialStages,
}: OrgManagementContainerProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'roles' | 'permissions'>('users');
  const [users, setUsers] = useState<UserDetailResponse[]>(initialUsers);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [roles] = useState<RoleDetail[]>(initialRoles);
  const [stages] = useState<Stage[]>(initialStages);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkUserStatusUpdateResponse | null>(null);

  const displayUserTotal = useMemo(() => Math.max(totalUsers, users.length), [totalUsers, users.length]);
  const totalDepartments = useMemo(() => departments.length, [departments]);
  const totalRoles = useMemo(() => roles.length, [roles]);

  const toggleUserSelection = useCallback((userId: string, checked?: boolean) => {
    setSelectedUserIds((prev) => {
      const isSelected = prev.includes(userId);
      const shouldSelect = checked ?? !isSelected;

      if (shouldSelect && !isSelected) {
        return [...prev, userId];
      }
      if (!shouldSelect && isSelected) {
        return prev.filter((id) => id !== userId);
      }
      return prev;
    });
  }, []);

  const selectAllUsers = useCallback((selectAll: boolean) => {
    setSelectedUserIds(selectAll ? users.map((user) => user.id) : []);
  }, [users]);

  const clearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  const handleUserUpdated = useCallback((updatedUser: UserDetailResponse) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
    );
  }, []);

  const handleUsersStateSync = useCallback((nextUsers: UserDetailResponse[]) => {
    setUsers(nextUsers);
  }, []);

  const handleBulkStatusComplete = useCallback((result: BulkUserStatusUpdateResponse | null) => {
    setBulkResult(result);
  }, []);

  const handleDepartmentCreated = useCallback((department: Department) => {
    setDepartments((prev) => [...prev, department]);
  }, []);

  const handleDepartmentUpdated = useCallback((department: Department) => {
    setDepartments((prev) =>
      prev.map((item) => (item.id === department.id ? { ...item, ...department } : item)),
    );
  }, []);

  const handleDepartmentDeleted = useCallback((departmentId: string) => {
    setDepartments((prev) => prev.filter((department) => department.id !== departmentId));
  }, []);

  const usersTab = (
    <UsersTab
      users={users}
      departments={departments}
      roles={roles}
      stages={stages}
      selectedUserIds={selectedUserIds}
      onToggleUserSelection={toggleUserSelection}
      onSelectAll={selectAllUsers}
      onClearSelection={clearSelection}
      onUserUpdated={handleUserUpdated}
      onBulkStatusComplete={handleBulkStatusComplete}
      onUsersStateSync={handleUsersStateSync}
    />
  );

  const departmentsTab = (
    <DepartmentsTab
      departments={departments}
      users={users}
      onDepartmentCreated={handleDepartmentCreated}
      onDepartmentUpdated={handleDepartmentUpdated}
      onDepartmentDeleted={handleDepartmentDeleted}
      onUsersStateSync={handleUsersStateSync}
    />
  );

  const rolesTab = (
    <RolesTab
      roles={roles}
      users={users}
      onUsersStateSync={handleUsersStateSync}
    />
  );

  const permissionsTab = (
    <PermissionsTab
      roles={roles}
    />
  );

  return (
    <OrgManagementView
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab)}
      totalUsers={displayUserTotal}
      totalDepartments={totalDepartments}
      totalRoles={totalRoles}
      usersTab={usersTab}
      departmentsTab={departmentsTab}
      rolesTab={rolesTab}
      permissionsTab={permissionsTab}
      bulkSummary={bulkResult}
    />
  );
}
