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
  permissionGroups?: PermissionGroup[];
  groupedCatalogWarning?: string;
}

export function PermissionsTab({
  roles,
  rolePermissions,
  permissionCatalog,
  permissionGroups,
  groupedCatalogWarning,
}: PermissionsTabProps) {
  const { hasRole, isLoading, error } = useUserRoles();
  const isAdmin = !isLoading && hasRole('admin');
  const safePermissionGroups = permissionGroups ?? [];

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
      {groupedCatalogWarning && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-700">
          <AlertTitle>権限グループを読み込めませんでした</AlertTitle>
          <AlertDescription>
            {groupedCatalogWarning} 権限一覧はフラット表示で利用できます。
          </AlertDescription>
        </Alert>
      )}
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
        initialGroupedCatalog={safePermissionGroups}
      />
    </div>
  );
}
