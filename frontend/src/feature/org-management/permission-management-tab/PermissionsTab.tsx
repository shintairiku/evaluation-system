'use client';

import type {
  PermissionCatalogItem,
  PermissionGroup,
  RoleDetail,
  RolePermissionResponse,
} from '@/api/types';
import { useUserRoles } from '@/hooks/useUserRoles';
import { RolePermissionMatrix } from './RolePermissionMatrix';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PermissionsTabProps {
  roles: RoleDetail[];
  rolePermissions: RolePermissionResponse[];
  permissionCatalog: PermissionCatalogItem[];
  permissionGroups: PermissionGroup[];
}

export function PermissionsTab({ roles, rolePermissions, permissionCatalog, permissionGroups }: PermissionsTabProps) {
  const { hasRole, isLoading, error } = useUserRoles();
  const isAdmin = !isLoading && hasRole('admin');

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        管理者権限を確認しています...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>権限情報の取得中に問題が発生しました</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <RolePermissionMatrix
        roles={roles}
        isAdmin={isAdmin}
        initialAssignments={rolePermissions}
        initialCatalog={permissionCatalog}
        initialGroupedCatalog={permissionGroups}
      />
    </div>
  );
}
