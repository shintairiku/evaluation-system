import { getUsersAction } from '@/api/server-actions/users';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import { getRolesAction } from '@/api/server-actions/roles';
import { getStagesAction } from '@/api/server-actions/stages';
import { OrgManagementContainer } from '@/feature/org-management';
import {
  getAllRolePermissionsAction,
  getPermissionCatalogGroupedAction,
  getPermissionCatalogAction,
} from '@/api/server-actions/permissions';

export const metadata = {
  title: '組織管理 | 人事評価システム',
  description: 'ユーザー・部門・ロールを一元管理し、ステータスを一括更新します',
};

export default async function OrgManagementPage() {
  // Fetch users first to leverage admin-only API guard (403 handled by middleware fallback)
  const usersResult = await getUsersAction({
    limit: 50,
    page: 1,
    withCount: false,
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

  const [
    departmentsResult,
    rolesResult,
    stagesResult,
    permissionCatalogResult,
    permissionCatalogGroupedResult,
    rolePermissionsResult,
  ] = await Promise.all([
    getDepartmentsAction(),
    getRolesAction(),
    getStagesAction(),
    getPermissionCatalogAction(),
    getPermissionCatalogGroupedAction(),
    getAllRolePermissionsAction(),
  ]);

  if (
    !departmentsResult.success ||
    !rolesResult.success ||
    !stagesResult.success ||
    !permissionCatalogResult.success ||
    !rolePermissionsResult.success
  ) {
    throw new Error(
      [
        !departmentsResult.success ? departmentsResult.error || 'Failed to load departments' : null,
        !rolesResult.success ? rolesResult.error || 'Failed to load roles' : null,
        !stagesResult.success ? stagesResult.error || 'Failed to load stages' : null,
        !permissionCatalogResult.success ? permissionCatalogResult.error || 'Failed to load permission catalog' : null,
        !rolePermissionsResult.success ? rolePermissionsResult.error || 'Failed to load role permissions' : null,
      ]
        .filter(Boolean)
        .join(' | ') || 'Failed to load organization management resources',
    );
  }

  const permissionCatalogGrouped = permissionCatalogGroupedResult.success
    ? permissionCatalogGroupedResult.data?.groups ?? []
    : [];
  const permissionCatalogGroupedWarning = permissionCatalogGroupedResult.success
    ? null
    : (permissionCatalogGroupedResult.error ?? '権限グループの読み込みに失敗しました。');

  return (
    <div className="container mx-auto px-6 py-10">
      <OrgManagementContainer
        initialUsers={usersResult.data?.items ?? []}
        totalUsers={usersResult.data?.total ?? 0}
        initialDepartments={departmentsResult.data ?? []}
        initialRoles={rolesResult.data ?? []}
        initialStages={stagesResult.data ?? []}
        initialRolePermissions={rolePermissionsResult.data ?? []}
        permissionCatalog={permissionCatalogResult.data ?? []}
        permissionCatalogGrouped={permissionCatalogGrouped}
        permissionCatalogGroupedWarning={permissionCatalogGroupedWarning}
      />
    </div>
  );
}
