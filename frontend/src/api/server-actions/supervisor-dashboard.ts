'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { supervisorDashboardApi } from '../endpoints/supervisor-dashboard';
import { CACHE_TAGS } from '../utils/cache';
import { convertKeysToCamelCase } from '../utils/case-converter';
import type {
  SupervisorDashboardResponse,
  SupervisorDashboardData,
  ApiResponse
} from '../types';

/**
 * Server action to get complete supervisor dashboard data
 * This function runs on the server side for SSR and is memoized.
 */
export const getSupervisorDashboardDataAction = cache(
  async (): Promise<ApiResponse<SupervisorDashboardData>> => {
    try {
      const response = await supervisorDashboardApi.getSupervisorDashboardData();

      if (!response.success || !response.data) {
        return {
          success: false,
          errorMessage: response.errorMessage || 'Failed to fetch supervisor dashboard data',
        };
      }

      // Transform snake_case from backend to camelCase for frontend
      const rawData = response.data as any;
      const converted = convertKeysToCamelCase(rawData);

      // Create synthetic items array for pending approvals
      const pendingTasksData = converted.pendingTasks || {};
      const items = [];

      if (pendingTasksData.goalApprovalsPending > 0) {
        items.push({
          type: 'goal' as const,
          count: pendingTasksData.goalApprovalsPending,
          priority: pendingTasksData.overdueApprovals > 0 ? 'high' as const : 'medium' as const,
          label: '目標承認',
          href: '/supervisor/goals?status=pending',
          overdueCount: pendingTasksData.overdueApprovals || 0
        });
      }

      if (pendingTasksData.evaluationFeedbacksPending > 0) {
        items.push({
          type: 'feedback' as const,
          count: pendingTasksData.evaluationFeedbacksPending,
          priority: pendingTasksData.overdueFeedbacks > 0 ? 'high' as const : 'medium' as const,
          label: '評価フィードバック',
          href: '/supervisor/evaluations?status=pending',
          overdueCount: pendingTasksData.overdueFeedbacks || 0
        });
      }

      // Map backend field names to frontend expectations
      const dashboardData: SupervisorDashboardData = {
        teamProgress: converted.teamProgress,
        pendingApprovals: {
          items,
          totalPending: pendingTasksData.totalPending || 0,
          lastUpdated: new Date().toISOString()
        },
        subordinatesList: converted.subordinates, // Backend uses 'subordinates'
        currentPeriod: converted.currentPeriod,
        lastUpdated: new Date().toISOString()
      };

      return {
        success: true,
        data: dashboardData,
      };
    } catch (error) {
      console.error('Server action error in getSupervisorDashboardDataAction:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
);

/**
 * Server action to get team progress only
 */
export const getTeamProgressAction = cache(
  async (): Promise<ApiResponse<SupervisorDashboardResponse['teamProgress']>> => {
    try {
      const response = await supervisorDashboardApi.getTeamProgress();

      if (!response.success || !response.data) {
        return {
          success: false,
          errorMessage: response.errorMessage || 'Failed to fetch team progress',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Server action error in getTeamProgressAction:', error);
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
export const getSupervisorPendingApprovalsAction = cache(
  async (): Promise<ApiResponse<SupervisorDashboardResponse['pendingApprovals']>> => {
    try {
      const response = await supervisorDashboardApi.getPendingApprovals();

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
      console.error('Server action error in getSupervisorPendingApprovalsAction:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
);

/**
 * Server action to get subordinates list only
 */
export const getSubordinatesListAction = cache(
  async (): Promise<ApiResponse<SupervisorDashboardResponse['subordinatesList']>> => {
    try {
      const response = await supervisorDashboardApi.getSubordinatesList();

      if (!response.success || !response.data) {
        return {
          success: false,
          errorMessage: response.errorMessage || 'Failed to fetch subordinates list',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Server action error in getSubordinatesListAction:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
);

/**
 * Revalidate supervisor dashboard cache
 */
export async function revalidateSupervisorDashboardAction(): Promise<void> {
  revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);
  revalidateTag(CACHE_TAGS.SUPERVISOR_FEEDBACKS);
}