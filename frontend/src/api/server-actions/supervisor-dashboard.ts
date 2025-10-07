'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { supervisorDashboardApi } from '../endpoints/supervisor-dashboard';
import { CACHE_TAGS } from '../utils/cache';
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

      // Transform the response to match component expected format
      const dashboardData: SupervisorDashboardData = {
        teamProgress: response.data.teamProgress,
        pendingApprovals: response.data.pendingApprovals,
        subordinatesList: response.data.subordinatesList,
        currentPeriod: response.data.currentPeriod,
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