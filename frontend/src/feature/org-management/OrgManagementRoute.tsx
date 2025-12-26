import { getUserDirectoryBasePageDataAction } from '@/api/server-actions/users';
import { OrgManagementContainer } from './OrgManagementContainer';
import {
  getAllRolePermissionsAction,
  getPermissionCatalogGroupedAction,
  getPermissionCatalogAction,
} from '@/api/server-actions/permissions';

export default async function OrgManagementRoute() {
  const usersResult = await getUserDirectoryBasePageDataAction({
    limit: 50,
    page: 1,
  });

  if (!usersResult.success) {
    return (
      <div className="container mx-auto py-12">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center space-y-4">
          <h1 className="text-2xl font-semibold text-destructive">アクセス権限エラー</h1>
          <p className="text-muted-foreground">
            組織管理ページのデータを読み込めませんでした。管理者権限をご確認のうえ、もう一度お試しください。
          </p>
          {usersResult.error && (
            <p className="text-sm text-muted-foreground">
              詳細: {usersResult.error}
            </p>
          )}
        </div>
      </div>
    );
  }

  const filters = usersResult.data?.filters;

  const [
    permissionCatalogResult,
    permissionCatalogGroupedResult,
    rolePermissionsResult,
  ] = await Promise.all([
    getPermissionCatalogAction(),
    getPermissionCatalogGroupedAction(),
    getAllRolePermissionsAction(),
  ]);

  if (
    !permissionCatalogResult.success ||
    !rolePermissionsResult.success
  ) {
    throw new Error(
      [
        !usersResult.success ? usersResult.error || 'Failed to load users' : null,
        !permissionCatalogResult.success ? permissionCatalogResult.error || 'Failed to load permission catalog' : null,
        !rolePermissionsResult.success ? rolePermissionsResult.error || 'Failed to load role permissions' : null,
      ]
        .filter(Boolean)
        .join(' | ') || 'Failed to load organization management resources',
    );
  }

  const initialRoles = (filters?.roles ?? []).map((role) => {
    const matchingPermissions = (rolePermissionsResult.data ?? []).find(
      (rp) => rp.role_id === role.id || rp.roleId === role.id,
    );

    return {
      ...role,
      permissions: matchingPermissions?.permissions ?? [],
    };
  });

  const permissionCatalogGrouped = permissionCatalogGroupedResult.success
    ? permissionCatalogGroupedResult.data?.groups ?? []
    : [];
  const permissionCatalogGroupedWarning = permissionCatalogGroupedResult.success
    ? null
    : (permissionCatalogGroupedResult.error ?? '権限グループの読み込みに失敗しました。');

  return (
    <div className="container mx-auto px-6 py-10">
      <OrgManagementContainer
        initialUsers={usersResult.data?.users ?? []}
        totalUsers={usersResult.data?.meta.total ?? 0}
        initialDepartments={filters?.departments ?? []}
        initialRoles={initialRoles}
        initialStages={filters?.stages ?? []}
        initialRolePermissions={rolePermissionsResult.data ?? []}
        permissionCatalog={permissionCatalogResult.data ?? []}
        permissionCatalogGrouped={permissionCatalogGrouped}
        permissionCatalogGroupedWarning={permissionCatalogGroupedWarning}
      />
    </div>
  );
}

