'use server';

import { revalidateTag } from 'next/cache';
import { usersApi } from '../../endpoints/users';
import { CACHE_TAGS } from '../../utils/cache';
import type {
  UserDetailResponse,
  UserCreate,
  UserUpdate,
  UUID,
  BulkUserStatusUpdateItem,
  BulkUserStatusUpdateResponse,
  UserGoalWeightUpdate,
} from '../../types';

export async function createUserAction(userData: UserCreate): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await usersApi.createUser(userData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create user',
      };
    }

    revalidateTag(CACHE_TAGS.USERS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create user action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating user',
    };
  }
}

export async function updateUserAction(
  userId: UUID,
  updateData: UserUpdate,
): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await usersApi.updateUser(userId, updateData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to update user',
      };
    }

    revalidateTag(CACHE_TAGS.USERS);
    revalidateTag(`${CACHE_TAGS.USERS}:${userId}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update user action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating user',
    };
  }
}

export async function updateUserStageAction(userId: UUID, stageId: UUID): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await usersApi.updateUserStage(userId, { stage_id: stageId });

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to update user stage',
      };
    }

    revalidateTag(CACHE_TAGS.USERS);
    revalidateTag(`${CACHE_TAGS.USERS}:${userId}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update user stage action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating user stage',
    };
  }
}

export async function updateUserGoalWeightsAction(
  userId: UUID,
  payload: UserGoalWeightUpdate,
): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await usersApi.updateUserGoalWeights(userId, payload);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to update user goal weights',
      };
    }

    revalidateTag(CACHE_TAGS.USERS);
    revalidateTag(`${CACHE_TAGS.USERS}:${userId}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update user goal weights action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating goal weights',
    };
  }
}

export async function updateUserStagesAction(changes: { userId: UUID; toStageId: UUID }[]): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!changes.length) {
      return { success: true };
    }

    const updateResults = await Promise.allSettled(
      changes.map(async (change) => {
        const result = await usersApi.updateUserStage(change.userId, {
          stage_id: change.toStageId,
        });

        if (!result.success) {
          throw new Error(`Failed to update user ${change.userId}: ${result.error}`);
        }

        return result;
      }),
    );

    const failures = updateResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason);

    if (failures.length > 0) {
      console.error('Stage update failures:', failures);
      return {
        success: false,
        error: `${failures.length} updates failed. Check server logs for details.`,
      };
    }

    revalidateTag(CACHE_TAGS.USERS);
    revalidateTag(CACHE_TAGS.STAGES);

    return { success: true };
  } catch (error) {
    console.error('Server action error (updateUserStagesAction):', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function bulkUpdateUserStatusesAction(
  items: BulkUserStatusUpdateItem[],
): Promise<{
  success: boolean;
  data?: BulkUserStatusUpdateResponse;
  error?: string;
}> {
  try {
    if (!items.length) {
      return {
        success: true,
        data: {
          results: [],
          successCount: 0,
          failureCount: 0,
        },
      };
    }

    const response = await usersApi.bulkUpdateStatus(items);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to bulk update user statuses',
      };
    }

    revalidateTag(CACHE_TAGS.USERS);

    const uniqueUserIds = new Set(items.map((item) => item.userId));
    uniqueUserIds.forEach((userId) => {
      revalidateTag(`${CACHE_TAGS.USERS}:${userId}`);
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Bulk update user statuses action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating user statuses',
    };
  }
}

export async function deleteUserAction(userId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await usersApi.deleteUser(userId);

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to delete user',
      };
    }

    revalidateTag(CACHE_TAGS.USERS);
    revalidateTag(`${CACHE_TAGS.USERS}:${userId}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete user action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting user',
    };
  }
}

