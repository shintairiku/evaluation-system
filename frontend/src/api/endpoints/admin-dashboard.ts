import { getHttpClient } from '../client/http-client';
import type { ApiResponse, AdminDashboardResponse } from '../types';

const httpClient = getHttpClient();

/**
 * Admin Dashboard API endpoints
 * Provides admin-specific dashboard data including system stats, pending approvals, and alerts
 */
export const adminDashboardApi = {
  /**
   * Get complete admin dashboard data
   */
  getAdminDashboardData: async (): Promise<ApiResponse<AdminDashboardResponse>> => {
    try {
      const response = await httpClient.get<AdminDashboardResponse>('/admin/dashboard');
      return response;
    } catch (error) {
      console.error('Failed to fetch admin dashboard data:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to fetch admin dashboard data'
      };
    }
  },

  /**
   * Get system statistics only
   */
  getSystemStats: async (): Promise<ApiResponse<AdminDashboardResponse['systemStats']>> => {
    try {
      const response = await httpClient.get<AdminDashboardResponse['systemStats']>('/admin/dashboard/stats');
      return response;
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to fetch system stats'
      };
    }
  },

  /**
   * Get pending approvals only
   */
  getPendingApprovals: async (): Promise<ApiResponse<AdminDashboardResponse['pendingApprovals']>> => {
    try {
      const response = await httpClient.get<AdminDashboardResponse['pendingApprovals']>('/admin/dashboard/approvals');
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
   * Get system alerts only
   */
  getSystemAlerts: async (): Promise<ApiResponse<AdminDashboardResponse['systemAlerts']>> => {
    try {
      const response = await httpClient.get<AdminDashboardResponse['systemAlerts']>('/admin/dashboard/alerts');
      return response;
    } catch (error) {
      console.error('Failed to fetch system alerts:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to fetch system alerts'
      };
    }
  },

  /**
   * Dismiss a system alert
   */
  dismissAlert: async (alertId: string): Promise<ApiResponse<void>> => {
    try {
      const response = await httpClient.post<void>(`/admin/dashboard/alerts/${alertId}/dismiss`);
      return response;
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to dismiss alert'
      };
    }
  }
};