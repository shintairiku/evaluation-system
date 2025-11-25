'use client';

import type {
  PermissionCatalogItem,
  PermissionGroup,
  RoleDetail,
  RolePermissionResponse,
  UserDetailResponse,
  Department,
} from '@/api/types';
import { useUserRoles } from '@/hooks/useUserRoles';
import { RolePermissionMatrix } from './RolePermissionMatrix';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ViewerVisibilityPanel } from './ViewerVisibilityPanel';

interface PermissionsTabProps {
  roles: RoleDetail[];
  rolePermissions: RolePermissionResponse[];
  permissionCatalog: PermissionCatalogItem[];
  permissionGroups?: PermissionGroup[];
  groupedCatalogWarning?: string;
  users: UserDetailResponse[];
  departments: Department[];
}

export function PermissionsTab({
  roles,
  rolePermissions,
  permissionCatalog,
  permissionGroups,
  groupedCatalogWarning,
  users,
  departments,
}: PermissionsTabProps) {
  const { hasRole, isLoading, error } = useUserRoles();
  const isAdmin = !isLoading && hasRole('admin');

  if (isLoading) {
    return (
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="space-y-2 border-b border-border/60 pb-6">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">権限マトリクス</CardTitle>
          <CardDescription>管理者権限の検証が完了すると権限マトリクスが表示されます。</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          管理者権限を確認しています...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <RolePermissionMatrix
        roles={roles}
        isAdmin={isAdmin}
        initialAssignments={rolePermissions}
        initialCatalog={permissionCatalog}
        initialGroupedCatalog={permissionGroups}
        groupedCatalogWarning={groupedCatalogWarning ?? undefined}
        roleGuardError={error ?? undefined}
      />
      <ViewerVisibilityPanel
        users={users}
        departments={departments}
        canEdit={isAdmin}
        guardError={error ?? undefined}
      />
    </div>
  );
}
