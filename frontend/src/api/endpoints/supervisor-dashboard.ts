import { getHttpClient } from '../client/http-client';
import type { ApiResponse, SupervisorDashboardResponse } from '../types';

const httpClient = getHttpClient();

/**
 * Supervisor Dashboard API endpoints
 * Provides supervisor-specific dashboard data including team progress, pending approvals, and subordinates list
 */
export const supervisorDashboardApi = {
  /**
   * Get complete supervisor dashboard data
   */
  getSupervisorDashboardData: async (): Promise<ApiResponse<SupervisorDashboardResponse>> => {
    try {
      const response = await httpClient.get<SupervisorDashboardResponse>('/supervisor/dashboard');
      return response;
    } catch (error) {
      console.error('Failed to fetch supervisor dashboard data:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to fetch supervisor dashboard data'
      };
    }
  },

  /**
   * Get team progress data only
   */
  getTeamProgress: async (): Promise<ApiResponse<SupervisorDashboardResponse['teamProgress']>> => {
    try {
      const response = await httpClient.get<SupervisorDashboardResponse['teamProgress']>('/supervisor/dashboard/team-progress');
      return response;
    } catch (error) {
      console.error('Failed to fetch team progress:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to fetch team progress'
      };
    }
  },

  /**
   * Get pending approvals only
   */
  getPendingApprovals: async (): Promise<ApiResponse<SupervisorDashboardResponse['pendingApprovals']>> => {
    try {
      const response = await httpClient.get<SupervisorDashboardResponse['pendingApprovals']>('/supervisor/dashboard/pending-approvals');
      return response;
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to fetch pending approvals'
      };
    }
  },

  /**
   * Get subordinates list only
   */
  getSubordinatesList: async (): Promise<ApiResponse<SupervisorDashboardResponse['subordinatesList']>> => {
    try {
      const response = await httpClient.get<SupervisorDashboardResponse['subordinatesList']>('/supervisor/dashboard/subordinates');
      return response;
    } catch (error) {
      console.error('Failed to fetch subordinates list:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to fetch subordinates list'
      };
    }
  }
};