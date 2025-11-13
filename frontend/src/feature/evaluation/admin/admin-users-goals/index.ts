/**
 * Admin Users Goals Feature
 *
 * User-centric view of all goals in the organization for admin monitoring
 *
 * Features:
 * - One row per user (not per goal) for easy compliance tracking
 * - Concurrent data fetching for 5x faster performance
 * - Client-side aggregation and filtering
 * - Click user to view detailed goals
 */

export { default as AdminUsersGoalsPage } from './display/AdminUsersGoalsPage';
export { default as AdminUserGoalsDetailPage } from './display/AdminUserGoalsDetailPage';
export { AdminUsersGoalsTable } from './components/AdminUsersGoalsTable';
export { AdminUsersGoalsFilters } from './components/AdminUsersGoalsFilters';
export { useAdminUsersGoalsData } from './hooks/useAdminUsersGoalsData';
export type { UserGoalSummary, StatusFilterOption } from './types';
