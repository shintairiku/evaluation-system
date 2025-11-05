import { Metadata } from 'next';
import { getUsersAction } from '@/api/server-actions/users';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import { getRolesAction } from '@/api/server-actions/roles';
import { getStagesAction } from '@/api/server-actions/stages';
import { OrgManagementContainer } from '@/feature/org-management';

export const metadata: Metadata = {
  title: '組織管理 | 人事評価システム',
  description: 'ユーザー・部門・ロールを一元管理し、ステータスを一括更新します',
};

export default async function OrgManagementPage() {
  // Admin access is now controlled by middleware - no need for checks here
  const [usersResult, departmentsResult, rolesResult, stagesResult] = await Promise.all([
    getUsersAction({
      limit: 100,
      page: 1,
    }),
    getDepartmentsAction(),
    getRolesAction(),
    getStagesAction(),
  ]);

  if (!usersResult.success || !departmentsResult.success || !rolesResult.success || !stagesResult.success) {
    throw new Error(
      [
        !usersResult.success ? usersResult.error || 'Failed to load users' : null,
        !departmentsResult.success ? departmentsResult.error || 'Failed to load departments' : null,
        !rolesResult.success ? rolesResult.error || 'Failed to load roles' : null,
        !stagesResult.success ? stagesResult.error || 'Failed to load stages' : null,
      ]
        .filter(Boolean)
        .join(' | ') || 'Failed to load organization management resources',
    );
  }

  return (
    <div className="container mx-auto px-6 py-10">
      <OrgManagementContainer
        initialUsers={usersResult.data?.items ?? []}
        totalUsers={usersResult.data?.total ?? 0}
        initialDepartments={departmentsResult.data ?? []}
        initialRoles={rolesResult.data ?? []}
        initialStages={stagesResult.data ?? []}
      />
    </div>
  );
}
