'use server';

import { cache } from 'react';
import { goalsApi } from '../../endpoints/goals';
import type {
  GoalListResponse,
  GoalResponse,
  UUID,
} from '../../types';

async function _getGoalsAction(params?: {
  periodId?: UUID;
  userId?: UUID;
  goalCategory?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
  includeReviews?: boolean;
  includeRejectionHistory?: boolean;
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> {
  try {
    const response = await goalsApi.getGoals(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch goals',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get goals action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching goals',
    };
  }
}

export const getGoalsAction = cache(_getGoalsAction);

export const getGoalByIdAction = cache(async (goalId: UUID): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> => {
  try {
    const response = await goalsApi.getGoalById(goalId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch goal',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get goal by ID action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching goal',
    };
  }
});

async function _getAdminGoalsAction(params?: {
  periodId?: UUID;
  userId?: UUID;
  departmentId?: UUID;
  goalCategory?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
  includeReviews?: boolean;
  includeRejectionHistory?: boolean;
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> {
  try {
    const response = await goalsApi.getAdminGoals(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch admin goals',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get admin goals action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching admin goals',
    };
  }
}

export const getAdminGoalsAction = cache(_getAdminGoalsAction);

