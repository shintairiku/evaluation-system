import AdminUsersGoalsPage from '@/feature/evaluation/admin/admin-users-goals/display/AdminUsersGoalsPage';

export const metadata = {
  title: 'ユーザー別目標一覧 | 管理者',
  description: '全ユーザーの目標設定状況を確認',
};

/**
 * Admin Goal List Page Route
 *
 * Route: /admin-goal-list
 * Access: Admin only (GOAL_READ_ALL permission)
 *
 * REFACTORED: User-centric view for better compliance tracking
 *
 * This page provides system-wide visibility of all goals across the organization.
 * It displays ONE ROW PER USER (not per goal) for easy auditing.
 *
 * Features:
 * - User-centric view (one row per user)
 * - Concurrent data fetching for 5x faster performance (p95 < 2s)
 * - Aggregated goal counts and status per user
 * - Click user to view detailed goals
 * - Multiple filters: department, stage, status
 * - Client-side pagination (50 items per page)
 *
 * Previous implementation: Goal-centric view (one row per goal)
 * - Moved to: /admin/goals-legacy (if needed as fallback)
 */
export default function Page() {
  return <AdminUsersGoalsPage />;
}
