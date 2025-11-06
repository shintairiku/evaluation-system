import AdminUserGoalsDetailPage from '@/feature/evaluation/admin/admin-users-goals/display/AdminUserGoalsDetailPage';

export const metadata = {
  title: 'ユーザー目標詳細 | 管理者',
};

interface PageProps {
  params: {
    userId: string;
  };
  searchParams: {
    periodId?: string;
  };
}

/**
 * Admin User Goals Detail Page Route
 *
 * Route: /admin-goal-list/{userId}
 * Access: Admin only (GOAL_READ_ALL permission)
 *
 * Shows all goals for a specific user with summary statistics
 *
 * Features:
 * - User information card
 * - Goal summary statistics (total, by category, by status)
 * - Complete list of user's goals in table format
 * - Back button to return to user list
 *
 * Reuses:
 * - EmployeeInfoCard for user details
 * - AdminGoalListTable for goal list (filtered to this user)
 */
export default function Page({ params, searchParams }: PageProps) {
  return <AdminUserGoalsDetailPage userId={params.userId} periodId={searchParams.periodId} />;
}
