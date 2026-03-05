import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getUsersAction } from '@/api/server-actions/users';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import { PeerReviewAssignmentsPage } from '@/feature/evaluation/admin/peer-review-assignments';

export const metadata = {
  title: '同僚評価進捗管理 | 管理者',
  description: '同僚評価者の割当を管理',
};

export default async function Page() {
  const [periodsResult, usersResult, departmentsResult] = await Promise.all([
    getCategorizedEvaluationPeriodsAction(),
    getUsersAction({ include: 'department,stage,supervisor', withCount: false }),
    getDepartmentsAction(),
  ]);

  const periods = periodsResult.success && periodsResult.data
    ? periodsResult.data.all || []
    : [];
  const activePeriod = periods.find(p => p.status === 'active') || periods[0];

  const users = usersResult.success && usersResult.data?.items
    ? usersResult.data.items
    : [];

  const departments = departmentsResult.success && Array.isArray(departmentsResult.data)
    ? departmentsResult.data
    : [];

  return (
    <PeerReviewAssignmentsPage
      initialPeriods={periods}
      initialActivePeriod={activePeriod ?? null}
      initialUsers={users}
      initialDepartments={departments}
    />
  );
}
