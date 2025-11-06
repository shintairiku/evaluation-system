'use client';

import { useState, useMemo, useCallback } from 'react';
import type {
  UserDetailResponse,
  Department,
  RoleDetail,
  Stage,
  BulkUserStatusUpdateResponse,
  RolePermissionResponse,
  PermissionCatalogItem,
  PermissionGroup,
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
  initialRolePermissions: RolePermissionResponse[];
  permissionCatalog: PermissionCatalogItem[];
  permissionCatalogGrouped?: PermissionGroup[];
  permissionCatalogGroupedWarning?: string | null;
}

export function OrgManagementContainer({
  initialUsers,
  totalUsers,
  initialDepartments,
  initialRoles,
  initialStages,
  initialRolePermissions,
  permissionCatalog,
  permissionCatalogGrouped,
  permissionCatalogGroupedWarning,
}: OrgManagementContainerProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'roles' | 'permissions'>('users');
  const [users, setUsers] = useState<UserDetailResponse[]>(initialUsers);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [roles, setRoles] = useState<RoleDetail[]>(initialRoles);
  const [stages] = useState<Stage[]>(initialStages);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkUserStatusUpdateResponse | null>(null);
  const safePermissionGroups = permissionCatalogGrouped ?? [];

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

  const handleRoleCreated = useCallback((role: RoleDetail) => {
    setRoles((prev) => {
      const exists = prev.some((item) => item.id === role.id);
      if (exists) {
        return prev;
      }
      return [...prev, role].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    });
  }, []);

  const handleRoleUpdated = useCallback((role: RoleDetail) => {
    setRoles((prev) =>
      prev
        .map((item) => (item.id === role.id ? role : item))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    );
  }, []);

  const handleRoleDeleted = useCallback((roleId: string) => {
    setRoles((prev) => prev.filter((role) => role.id !== roleId));
  }, []);

  const rolesTab = (
    <RolesTab
      roles={roles}
      users={users}
      onUsersStateSync={handleUsersStateSync}
      onRoleCreated={handleRoleCreated}
      onRoleUpdated={handleRoleUpdated}
      onRoleDeleted={handleRoleDeleted}
    />
  );

  const permissionsTab = (
    <PermissionsTab
      roles={roles}
      rolePermissions={initialRolePermissions}
      permissionCatalog={permissionCatalog}
      permissionGroups={safePermissionGroups}
      groupedCatalogWarning={permissionCatalogGroupedWarning ?? undefined}
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
