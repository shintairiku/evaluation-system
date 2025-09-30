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
      const response = await employeeDashboardApi.getEmployeeDashboardData();
      return response;
    } catch (error) {
      console.error('Failed to fetch employee dashboard data:', error);
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