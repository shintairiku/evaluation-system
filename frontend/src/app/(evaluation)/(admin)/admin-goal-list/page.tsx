import AdminGoalListPage from '@/feature/evaluation/admin/admin-goal-list/display';

/**
 * Admin Goal List Page Route
 *
 * Route: /admin-goal-list
 * Access: Admin only (GOAL_READ_ALL permission)
 *
 * This page provides system-wide visibility of all goals across the organization.
 * It is read-only (no editing or approving) and optimized for monitoring and analytics.
 *
 * Features:
 * - View ALL users' goals in organization
 * - Multiple filters: status, category, department, user
 * - Client-side pagination (50 items per page)
 * - Performance optimized with batch fetching
 */
export default function Page() {
  return <AdminGoalListPage />;
}
