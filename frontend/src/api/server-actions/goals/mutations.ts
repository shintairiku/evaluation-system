'use server';

import { revalidateTag } from 'next/cache';
import { goalsApi } from '../../endpoints/goals';
import { CACHE_TAGS } from '../../utils/cache';
import type {
  GoalCreateRequest,
  GoalResponse,
  GoalUpdateRequest,
  UUID,
} from '../../types';

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

    revalidateTag(CACHE_TAGS.GOALS);
    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);

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
