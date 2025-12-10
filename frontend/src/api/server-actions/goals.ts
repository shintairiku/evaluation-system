'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { goalsApi } from '../endpoints/goals';
import { CACHE_TAGS } from '../utils/cache';
import type {
  UUID,
  GoalCreateRequest,
  GoalUpdateRequest,
  GoalListResponse,
  GoalResponse,
} from '../types';


/**
 * Server action to get goals with optional filtering, pagination, and caching
 */
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

export const getGoalsAction = cache(async (params?: {
  periodId?: UUID;
  userId?: UUID;
  goalCategory?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
  includeReviews?: boolean;
  includeRejectionHistory?: boolean;
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> => {
  return _getGoalsAction(params);
});


/**
 * Server action to get a single goal by ID with caching
 */
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
/**
 * Server action to create a new goal with cache revalidation
 */
export async function createGoalAction(data: GoalCreateRequest): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const response = await goalsApi.createGoal(data);
    
    if (!response.success || !response.data) {
      const errorMessage = response.error || response.errorMessage || 'Failed to create goal';
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    // Revalidate goals and related caches after successful creation
    revalidateTag(CACHE_TAGS.GOALS);
    revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS);
    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create goal action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating goal',
    };
  }
}

/**
 * Server action to update an existing goal with cache revalidation
 */
export async function updateGoalAction(id: UUID, data: GoalUpdateRequest): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const response = await goalsApi.updateGoal(id, data);
    
    if (!response.success || !response.data) {
      const errorMessage = response.error || response.errorMessage || 'Failed to update goal';
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    // Revalidate goals and related caches after successful update
    revalidateTag(CACHE_TAGS.GOALS);
    revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS);
    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update goal action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating goal',
    };
  }
}

/**
 * Server action to delete a goal with cache revalidation
 */
export async function deleteGoalAction(id: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await goalsApi.deleteGoal(id);
    
    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete goal',
      };
    }
    
    // Revalidate goals and related caches after successful deletion
    revalidateTag(CACHE_TAGS.GOALS);
    revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS);
    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete goal action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting goal',
    };
  }
}

/**
 * Server action to submit a goal with status change and cache revalidation
 */
export async function submitGoalAction(id: UUID, status: 'draft' | 'submitted'): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const response = await goalsApi.submitGoal(id, status);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to submit goal',
      };
    }
    
    // Revalidate goals cache after status change
    revalidateTag(CACHE_TAGS.GOALS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Submit goal action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while submitting goal',
    };
  }
}

/**
 * Server action to approve a pending goal (supervisor action) with cache revalidation
 */
export async function approveGoalAction(goalId: UUID): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const response = await goalsApi.approveGoal(goalId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to approve goal',
      };
    }
    
    // Revalidate goals cache after approval
    revalidateTag(CACHE_TAGS.GOALS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Approve goal action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while approving goal',
    };
  }
}
/**
 * Server action to reject a pending goal with reason (supervisor action) and cache revalidation
 */
export async function rejectGoalAction(goalId: UUID, reason: string): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const response = await goalsApi.rejectGoal(goalId, reason);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to reject goal',
      };
    }
    
    // Revalidate goals cache after rejection
    revalidateTag(CACHE_TAGS.GOALS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Reject goal action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while rejecting goal',
    };
  }
}

/**
 * Server action to get all goals for admin visualization (admin-only)
 *
 * This action fetches ALL users' goals in the organization.
 * Performance: includeReviews defaults to true for batch optimization
 */
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
