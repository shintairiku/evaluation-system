'use server';

import { cache } from 'react';
import { revalidatePath } from 'next/cache';
import { employeeDashboardApi } from '../endpoints/employee-dashboard';
import type { ApiResponse } from '../types';
import type {
  EmployeeDashboardData,
  PersonalProgressData,
  TodoTasksData,
  DeadlineAlertsData,
  HistoryAccessData
} from '../types/employee-dashboard';

/**
 * Employee Dashboard Server Actions
 * Server-side data fetching with React cache for deduplication
 */

/**
 * Get complete employee dashboard data
 * Uses React cache for automatic request deduplication during SSR
 */
export const getEmployeeDashboardDataAction = cache(
  async (): Promise<ApiResponse<EmployeeDashboardData>> => {
    try {
      // The endpoint already transforms the data from backend format to frontend format
      // No need for additional transformation here
      const response = await employeeDashboardApi.getEmployeeDashboardData();

      console.log('[Employee Dashboard Server Action] Response:', {
        success: response.success,
        hasData: !!response.data,
        error: response.error
      });

      if (response.success && response.data) {
        console.log('[Employee Dashboard Server Action] Data structure:', {
          hasCurrentPeriod: !!response.data.currentPeriod,
          hasPersonalProgress: !!response.data.personalProgress,
          hasTodoTasks: !!response.data.todoTasks,
          hasDeadlineAlerts: !!response.data.deadlineAlerts,
          hasHistoryAccess: !!response.data.historyAccess
        });

        // Just add the lastUpdated timestamp
        return {
          success: true,
          data: {
            ...response.data,
            lastUpdated: new Date().toISOString()
          }
        };
      }

      console.error('[Employee Dashboard Server Action] Failed response:', response);
      return response;
    } catch (error) {
      console.error('[Employee Dashboard Server Action] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch employee dashboard data'
      };
    }
  }
);

/**
 * Get personal progress data only
 */
export const getPersonalProgressAction = cache(
  async (): Promise<ApiResponse<PersonalProgressData>> => {
    try {
      const response = await employeeDashboardApi.getPersonalProgress();
      return response;
    } catch (error) {
      console.error('Failed to fetch personal progress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch personal progress'
      };
    }
  }
);

/**
 * Get TODO tasks only
 */
export const getTodoTasksAction = cache(
  async (): Promise<ApiResponse<TodoTasksData>> => {
    try {
      const response = await employeeDashboardApi.getTodoTasks();
      return response;
    } catch (error) {
      console.error('Failed to fetch TODO tasks:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch TODO tasks'
      };
    }
  }
);

/**
 * Get deadline alerts only
 */
export const getDeadlineAlertsAction = cache(
  async (): Promise<ApiResponse<DeadlineAlertsData>> => {
    try {
      const response = await employeeDashboardApi.getDeadlineAlerts();
      return response;
    } catch (error) {
      console.error('Failed to fetch deadline alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch deadline alerts'
      };
    }
  }
);

/**
 * Get history access data only
 */
export const getHistoryAccessAction = cache(
  async (): Promise<ApiResponse<HistoryAccessData>> => {
    try {
      const response = await employeeDashboardApi.getHistoryAccess();
      return response;
    } catch (error) {
      console.error('Failed to fetch history access data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch history access data'
      };
    }
  }
);

/**
 * Revalidate employee dashboard cache
 */
export async function revalidateEmployeeDashboardAction(): Promise<void> {
  revalidatePath('/(evaluation)/(employee)');
  revalidatePath('/(evaluation)/(employee)/dashboard');
}

/**
 * Revalidate specific employee dashboard sections
 */
export async function revalidateEmployeeDashboardSectionAction(
  section: 'progress' | 'todos' | 'deadlines' | 'history'
): Promise<void> {
  switch (section) {
    case 'progress':
      revalidatePath('/(evaluation)/(employee)/dashboard/progress');
      break;
    case 'todos':
      revalidatePath('/(evaluation)/(employee)/dashboard/todos');
      break;
    case 'deadlines':
      revalidatePath('/(evaluation)/(employee)/dashboard/deadlines');
      break;
    case 'history':
      revalidatePath('/(evaluation)/(employee)/dashboard/history');
      break;
  }
}