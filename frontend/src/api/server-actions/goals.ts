'use server';

import { goalsApi } from '../endpoints/goals';
import type { 
  UUID,
  GoalCreateRequest,
  GoalUpdateRequest,
  GoalListResponse,
  GoalResponse,
} from '../types';


/**
 * Server action to get goals with optional filtering and pagination
 */
export async function getGoalsAction(params?: {
  periodId?: UUID;
  userId?: UUID;
  goalCategory?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> {
  try {
    const response = await goalsApi.getGoals(params);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch goals',
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

/**
 * Server action to create a new goal
 */
export async function createGoalAction(data: GoalCreateRequest): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const response = await goalsApi.createGoal(data);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create goal',
      };
    }
    
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
 * Server action to update an existing goal
 */
export async function updateGoalAction(id: UUID, data: GoalUpdateRequest): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const response = await goalsApi.updateGoal(id, data);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to update goal',
      };
    }
    
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
 * Server action to delete a goal
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
        error: response.error || 'Failed to delete goal',
      };
    }
    
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
 * Server action to submit a goal with status change
 */
export async function submitGoalAction(id: UUID, status: 'draft' | 'pending_approval'): Promise<{
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
 * Server action to approve a pending goal (supervisor action)
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
 * Server action to reject a pending goal with reason (supervisor action)
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
  