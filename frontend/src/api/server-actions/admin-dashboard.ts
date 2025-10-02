'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { adminDashboardApi } from '../endpoints/admin-dashboard';
import { CACHE_TAGS } from '../utils/cache';
import type {
  AdminDashboardResponse,
  AdminDashboardData,
  ApiResponse
} from '../types';

/**
 * Server action to get complete admin dashboard data
 * This function runs on the server side for SSR and is memoized.
 */
export const getAdminDashboardDataAction = cache(
  async (): Promise<ApiResponse<AdminDashboardData>> => {
    try {
      const response = await adminDashboardApi.getAdminDashboardData();

      if (!response.success || !response.data) {
        return {
          success: false,
          errorMessage: response.errorMessage || 'Failed to fetch admin dashboard data',
        };
      }

      // Transform snake_case from backend to camelCase for frontend
      const rawData = response.data as any;
      const dashboardData: AdminDashboardData = {
        systemStats: {
          totalUsers: rawData.systemStats?.total_users ?? 0,
          activeUsers: rawData.systemStats?.active_users ?? 0,
          totalDepartments: rawData.systemStats?.total_departments ?? 0,
          activeEvaluationPeriods: rawData.systemStats?.active_evaluation_periods ?? 0,
          totalGoals: rawData.systemStats?.total_goals ?? 0,
          totalEvaluations: rawData.systemStats?.total_evaluations ?? 0,
        },
        pendingApprovals: {
          items: [
            ...(rawData.pendingApprovals?.pending_users > 0 ? [{
              id: 'pending-users',
              type: 'user_approval' as const,
              title: 'ユーザー承認',
              count: rawData.pendingApprovals.pending_users,
              priority: 'high' as const,
              url: '/admin/users?status=pending'
            }] : []),
            ...(rawData.pendingApprovals?.pending_goals > 0 ? [{
              id: 'pending-goals',
              type: 'goal_approval' as const,
              title: '目標承認',
              count: rawData.pendingApprovals.pending_goals,
              priority: 'medium' as const,
              url: '/admin/goals?status=pending'
            }] : []),
            ...(rawData.pendingApprovals?.pending_evaluations > 0 ? [{
              id: 'pending-evaluations',
              type: 'evaluation_review' as const,
              title: '評価レビュー',
              count: rawData.pendingApprovals.pending_evaluations,
              priority: 'medium' as const,
              url: '/admin/evaluations?status=pending'
            }] : [])
          ],
          totalPending: rawData.pendingApprovals?.total_pending ?? 0,
        },
        systemAlerts: {
          alerts: rawData.systemAlerts?.alerts ?? [],
          totalAlerts: rawData.systemAlerts?.total_alerts ?? 0,
          criticalCount: rawData.systemAlerts?.critical_count ?? 0,
          warningCount: rawData.systemAlerts?.warning_count ?? 0,
        },
        lastUpdated: rawData.lastUpdated || new Date().toISOString()
      };

      return {
        success: true,
        data: dashboardData,
      };
    } catch (error) {
      console.error('Server action error in getAdminDashboardDataAction:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
);

/**
 * Server action to get system statistics only
 */
export const getSystemStatsAction = cache(
  async (): Promise<ApiResponse<AdminDashboardResponse['systemStats']>> => {
    try {
      const response = await adminDashboardApi.getSystemStats();

      if (!response.success || !response.data) {
        return {
          success: false,
          errorMessage: response.errorMessage || 'Failed to fetch system stats',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Server action error in getSystemStatsAction:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
);

/**
 * Server action to get pending approvals only
 */
export const getPendingApprovalsAction = cache(
  async (): Promise<ApiResponse<AdminDashboardResponse['pendingApprovals']>> => {
    try {
      const response = await adminDashboardApi.getPendingApprovals();

      if (!response.success || !response.data) {
        return {
          success: false,
          errorMessage: response.errorMessage || 'Failed to fetch pending approvals',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Server action error in getPendingApprovalsAction:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
);

/**
 * Server action to get system alerts only
 */
export const getSystemAlertsAction = cache(
  async (): Promise<ApiResponse<AdminDashboardResponse['systemAlerts']>> => {
    try {
      const response = await adminDashboardApi.getSystemAlerts();

      if (!response.success || !response.data) {
        return {
          success: false,
          errorMessage: response.errorMessage || 'Failed to fetch system alerts',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Server action error in getSystemAlertsAction:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
);

/**
 * Server action to dismiss a system alert
 */
export async function dismissAlertAction(alertId: string): Promise<ApiResponse<void>> {
  try {
    const response = await adminDashboardApi.dismissAlert(alertId);

    if (!response.success) {
      return {
        success: false,
        errorMessage: response.errorMessage || 'Failed to dismiss alert',
      };
    }

    // Revalidate admin dashboard data after dismissing alert
    revalidateTag(CACHE_TAGS.ADMIN_DASHBOARD);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Server action error in dismissAlertAction:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Revalidate admin dashboard cache
 */
export async function revalidateAdminDashboardAction(): Promise<void> {
  revalidateTag(CACHE_TAGS.ADMIN_DASHBOARD);
}